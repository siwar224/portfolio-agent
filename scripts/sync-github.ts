/**
 * Self-updating knowledge base.
 *
 * Reads Siwar's public GitHub repos, finds the ones that are new or changed since the last run,
 * asks Gemini to propose additions to data/projects.json (structured output, facts from the repo
 * only), validates everything with the same zod schemas as the agent, and writes:
 *   - data/projects.json   (proposed changes)
 *   - sync/state.json      (last processed commit per repo)
 *   - sync/last-run.md     (human-readable report, used as the Pull Request description)
 *
 * Nothing is published: in CI the result becomes a Pull Request that Siwar reviews and merges.
 *
 *   npm run sync:github               # write the proposals
 *   npm run sync:github -- --dry-run  # only print what would change
 *
 * Env: GEMINI_API_KEY (required), GITHUB_TOKEN (optional, raises GitHub API limits),
 *      GEMINI_SYNC_MODEL (optional, default gemini-2.5-flash)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { DATA_DIR, ProjectSchema, type Project } from "../src/data.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SYNC_DIR = join(ROOT, "sync");
const PROJECTS_FILE = join(DATA_DIR, "projects.json");
const STATE_FILE = join(SYNC_DIR, "state.json");
const REPORT_FILE = join(SYNC_DIR, "last-run.md");
const DRY_RUN = process.argv.includes("--dry-run");

try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  // CI provides the environment directly.
}

// ---------- config & state ----------
const ConfigSchema = z.object({
  github_user: z.string().min(1),
  exclude: z.array(z.string()),
  max_new_highlights_per_update: z.number().int().min(0).max(10),
  readme_max_chars: z.number().int().min(1000),
});
const config = ConfigSchema.parse(JSON.parse(readFileSync(join(SYNC_DIR, "config.json"), "utf8")));

type RepoState = { sha: string; pushed_at: string; processed_at: string };
const state: Record<string, RepoState> = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};

// ---------- GitHub ----------
interface Repo {
  name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  fork: boolean;
  archived: boolean;
  private: boolean;
  size: number;
  default_branch: string;
  created_at: string;
  pushed_at: string;
  topics?: string[];
}

async function gh<T>(path: string, accept = "application/vnd.github+json"): Promise<T> {
  const headers: Record<string, string> = { accept, "user-agent": "portfolio-agent-sync", "x-github-api-version": "2022-11-28" };
  if (process.env["GITHUB_TOKEN"]) headers["authorization"] = `Bearer ${process.env["GITHUB_TOKEN"]}`;
  const res = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return null as T;
  if (!res.ok) throw new Error(`GitHub ${path} -> ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return (accept.includes("raw") ? await res.text() : await res.json()) as T;
}

async function repoEvidence(repo: Repo) {
  const [readme, languages, commits] = await Promise.all([
    gh<string | null>(`/repos/${config.github_user}/${repo.name}/readme`, "application/vnd.github.raw+json"),
    gh<Record<string, number>>(`/repos/${config.github_user}/${repo.name}/languages`),
    gh<Array<{ sha: string; commit: { message: string; author: { name: string; date: string } }; author: { login: string } | null }>>(
      `/repos/${config.github_user}/${repo.name}/commits?per_page=60`,
    ),
  ]);
  const list = commits ?? [];
  const mine = list.filter((c) => c.author?.login?.toLowerCase() === config.github_user.toLowerCase());
  return {
    readme: (readme ?? "").slice(0, config.readme_max_chars),
    languages: Object.keys(languages ?? {}),
    headSha: list[0]?.sha ?? "",
    firstCommitDate: list.at(-1)?.commit.author.date.slice(0, 10) ?? repo.created_at.slice(0, 10),
    lastCommitDate: list[0]?.commit.author.date.slice(0, 10) ?? repo.pushed_at.slice(0, 10),
    commitCount: list.length,
    authorShare: list.length ? Math.round((mine.length / list.length) * 100) : 0,
    recentSubjects: mine.slice(0, 25).map((c) => c.commit.message.split("\n")[0]!.slice(0, 140)),
  };
}

// ---------- Gemini (structured output) ----------
const NewProjectSchema = z.object({
  is_real_project: z.boolean().describe("false if the repo is a placeholder, a template, config only or has too little substance"),
  name: z.string().describe('"<Name> - <short tagline>", like the existing projects'),
  category: z.array(z.string()).max(4),
  context: z.string().describe("e.g. 'Personal project', 'Team project (3 contributors)'"),
  pitch: z.string().describe("One sentence: what it is and for whom"),
  problem: z.string().nullable(),
  solution: z.string().nullable(),
  workflow: z.array(z.string()).max(6).nullable(),
  role: z.string().describe("What Siwar did, based on the commit share and messages"),
  highlights: z.array(z.string()).min(1).max(6),
  stack: z.array(z.string()).max(20),
  good_for_roles: z.array(z.string()).max(5),
  status: z.string().nullable().describe("e.g. 'In progress' when the README says so, else null"),
});

const UpdateSchema = z.object({
  has_meaningful_changes: z.boolean(),
  new_highlights: z.array(z.string()).describe("Only capabilities that are NOT already covered by the existing highlights"),
  stack_additions: z.array(z.string()),
  status: z.string().nullable().describe("New status if clearly stated by the repo, else null"),
  todo_resolved: z.boolean().describe("true if the existing _todo is now answered by the repo"),
  change_summary: z.string().describe("One short sentence for the reviewer"),
});

const RULES = `Rules:
- Use ONLY facts present in the evidence (README, languages, commit messages, repo metadata). Never invent numbers, users, metrics, dates or impact.
- English, third person ("Siwar"), professional and concise. Each highlight is one sentence, under 220 characters.
- Do not claim deployment, production use or results unless the evidence states it.
- Describe only what is already built. Anything presented as planned, upcoming, roadmap, TODO or "future" must NOT appear as done, and its technologies must not be listed in the stack.
- stack: only technologies the repo actually uses (its languages, or tools the README shows being used).
- role: one sentence starting with a verb, describing what Siwar did (e.g. "Designed and built ...").
- Ignore boilerplate (license text, default framework READMEs, install steps) when describing the project.`;

// JSON mode (structured output) is only available on the v1beta API.
const ai = new GoogleGenAI({ apiKey: process.env["GEMINI_API_KEY"] ?? "", apiVersion: "v1beta" });
// A different model from the chat (gemini-3.5-flash) so the weekly sync never uses the chat's free quota.
const MODEL = process.env["GEMINI_SYNC_MODEL"] || "gemini-2.5-flash";

async function generate<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema), temperature: 0.2 },
      });
      const parsed = schema.safeParse(JSON.parse(res.text ?? ""));
      if (parsed.success) return parsed.data;
      lastErr = new Error(z.prettifyError(parsed.error));
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ApiError && [429, 500, 503].includes(err.status);
      if (!retryable && !(err instanceof SyntaxError)) throw err;
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw lastErr;
}

const fmtEvidence = (repo: Repo, ev: Awaited<ReturnType<typeof repoEvidence>>) => `Repository: ${repo.name}
URL: ${repo.html_url}
Description: ${repo.description ?? "(none)"}
Homepage: ${repo.homepage || "(none)"}
Topics: ${(repo.topics ?? []).join(", ") || "(none)"}
Languages: ${ev.languages.join(", ") || "(unknown)"}
Activity: ${ev.commitCount} recent commits, ${ev.authorShare}% authored by Siwar, from ${ev.firstCommitDate} to ${ev.lastCommitDate}
Siwar's recent commit messages:
${ev.recentSubjects.map((s) => `- ${s}`).join("\n") || "(none)"}

README:
${ev.readme || "(no README)"}`;

// ---------- main ----------
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sameUrl = (a?: string | null, b?: string | null) => !!a && !!b && a.replace(/\/$/, "").toLowerCase() === b.replace(/\/$/, "").toLowerCase();

const projectsDoc = JSON.parse(readFileSync(PROJECTS_FILE, "utf8")) as { projects: Project[] } & Record<string, unknown>;
const report: string[] = [];
const added: string[] = [];
const updated: string[] = [];
const skipped: string[] = [];
let changed = false;

const repos = ((await gh<Repo[]>(`/users/${config.github_user}/repos?per_page=100&type=owner&sort=pushed`)) ?? []).filter(
  (r) => !r.fork && !r.archived && !r.private && r.size > 0 && !config.exclude.some((x) => x.toLowerCase() === r.name.toLowerCase()),
);
console.log(`Public repos considered: ${repos.map((r) => r.name).join(", ")}`);

for (const repo of repos) {
  const project = projectsDoc.projects.find((p) => Object.entries(p.links).some(([k, v]) => !k.startsWith("_") && sameUrl(v, repo.html_url)));
  const prev = state[repo.name];
  if (prev && prev.pushed_at === repo.pushed_at) continue; // nothing new since last run

  // First run on a project already curated by hand: record a baseline, propose nothing (no extra API calls).
  if (!prev && project) {
    state[repo.name] = { sha: "", pushed_at: repo.pushed_at, processed_at: new Date().toISOString() };
    console.log(`baseline  ${repo.name} -> ${project.id}`);
    continue;
  }

  const ev = await repoEvidence(repo);
  const remember = () => { state[repo.name] = { sha: ev.headSha, pushed_at: repo.pushed_at, processed_at: new Date().toISOString() }; };

  try {
    if (!project) {
      const out = await generate(NewProjectSchema, `You write portfolio entries for Siwar M'SALLEM, a software engineer.
Propose ONE new project entry for the repository below.
${RULES}
- If the repo has too little substance to describe honestly, set is_real_project to false.

${fmtEvidence(repo, ev)}`);
      if (!out.is_real_project) {
        skipped.push(`\`${repo.name}\`: not enough substance to describe`);
        remember();
        continue;
      }
      const candidate: Project = ProjectSchema.parse({
        id: slug(repo.name),
        name: out.name,
        category: out.category,
        featured: false,
        in_portfolio: false,
        ...(out.status ? { status: out.status } : {}),
        period: ev.firstCommitDate.slice(0, 7) === ev.lastCommitDate.slice(0, 7) ? ev.lastCommitDate.slice(0, 7) : `${ev.firstCommitDate.slice(0, 7)} - ${ev.lastCommitDate.slice(0, 7)}`,
        context: out.context,
        pitch: out.pitch,
        problem: out.problem,
        solution: out.solution,
        workflow: out.workflow,
        role: out.role,
        highlights: out.highlights,
        stack: out.stack,
        results: [],
        links: { demo: repo.homepage || null, repo: repo.html_url, video: null },
        portfolio: { page: null, anchor: null },
        good_for_roles: out.good_for_roles,
        source: "github-sync",
        _todo: "Added automatically from GitHub: review the wording and add results if any.",
      });
      if (projectsDoc.projects.some((p) => p.id === candidate.id)) candidate.id = `${candidate.id}-gh`;
      projectsDoc.projects.push(candidate);
      added.push(candidate.id);
      report.push(`### ➕ New project: ${candidate.name}\nRepo: ${repo.html_url} · ${ev.authorShare}% of recent commits by Siwar\n\n> ${candidate.pitch}\n\n${candidate.highlights.map((h) => `- ${h}`).join("\n")}\n\n**Stack:** ${candidate.stack.join(", ")}`);
      changed = true;
    } else {
      const out = await generate(UpdateSchema, `You maintain the portfolio entry below for Siwar M'SALLEM.
The repository changed since the entry was last reviewed. Propose ONLY additions supported by the evidence.
${RULES}
- new_highlights: at most ${config.max_new_highlights_per_update}, only for capabilities not already covered by the existing highlights. Empty list if nothing new.
- Do not rephrase existing content.

Existing entry (JSON):
${JSON.stringify({ name: project.name, pitch: project.pitch, highlights: project.highlights, stack: project.stack, status: project.status ?? null, _todo: project._todo ?? null }, null, 2)}

${fmtEvidence(repo, ev)}`);
      const newHighlights = out.new_highlights.slice(0, config.max_new_highlights_per_update)
        .filter((h) => !project.highlights.some((x) => x.toLowerCase() === h.toLowerCase()));
      const newStack = out.stack_additions.filter((s) => !project.stack.some((x) => x.toLowerCase() === s.toLowerCase()));
      const statusChange = out.status && out.status !== project.status ? out.status : null;
      const todoDone = out.todo_resolved && !!project._todo;
      if (!out.has_meaningful_changes || (!newHighlights.length && !newStack.length && !statusChange && !todoDone)) {
        skipped.push(`\`${repo.name}\`: changed, but nothing worth adding`);
        remember();
        continue;
      }
      const next: Project = ProjectSchema.parse({
        ...project,
        highlights: [...project.highlights, ...newHighlights],
        stack: [...project.stack, ...newStack],
        ...(statusChange ? { status: statusChange } : {}),
        ...(todoDone ? { _todo: undefined } : {}),
      });
      projectsDoc.projects = projectsDoc.projects.map((p) => (p.id === project.id ? next : p));
      updated.push(project.id);
      report.push([
        `### ✏️ Updated: ${project.name}`,
        `Repo: ${repo.html_url} · ${out.change_summary}`,
        ...newHighlights.map((h) => `- ➕ ${h}`),
        newStack.length ? `- Stack ➕ ${newStack.join(", ")}` : "",
        statusChange ? `- Status: ${project.status ?? "(none)"} → **${statusChange}**` : "",
        todoDone ? `- ✅ Resolved TODO: _${project._todo}_` : "",
      ].filter(Boolean).join("\n"));
      changed = true;
    }
    remember();
  } catch (err) {
    skipped.push(`\`${repo.name}\`: error, will retry next run (${err instanceof Error ? err.message.slice(0, 160) : String(err)})`);
  }
}

const summary = [
  `## Knowledge sync — ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Proposed by the GitHub sync (model \`${MODEL}\`). **Review every line before merging**: the agent will repeat these facts to recruiters.`,
  "",
  added.length || updated.length ? report.join("\n\n") : "_No changes to propose._",
  skipped.length ? `\n<details><summary>Skipped (${skipped.length})</summary>\n\n${skipped.map((s) => `- ${s}`).join("\n")}\n</details>` : "",
].join("\n");

console.log(`\n${summary}\n`);
if (DRY_RUN) {
  console.log("Dry run: no file written.");
} else {
  if (changed) writeFileSync(PROJECTS_FILE, JSON.stringify(projectsDoc, null, 2) + "\n");
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  writeFileSync(REPORT_FILE, summary + "\n");
  console.log(`Wrote ${changed ? "data/projects.json, " : ""}sync/state.json and sync/last-run.md`);
}
// Exit code 0 always; CI decides whether to open a PR from the git diff.

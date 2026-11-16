/**
 * Validates data/*.json: schemas, unique ids, cross-references, and lists what is still to fill in.
 * Exit code 1 on errors; warnings (todos, empty fields) do not fail the check.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, loadKnowledge } from "../src/data.js";

const errors: string[] = [];
const warnings: string[] = [];

const k = loadKnowledge();

// Unique ids
const projectIds = k.projects.map((p) => p.id);
const experienceIds = k.experience.map((e) => e.id);
const allIds = [...projectIds, ...experienceIds];
for (const id of new Set(allIds)) {
  if (allIds.filter((x) => x === id).length > 1) errors.push(`Duplicate id "${id}"`);
}
const known = new Set(allIds);

// Skill evidence must point to an existing project or experience
for (const group of k.skills) {
  for (const skill of group.skills) {
    for (const ref of skill.evidence) {
      if (!known.has(ref)) errors.push(`skills.json: "${skill.name}" cites unknown id "${ref}"`);
    }
    if (skill.evidence.length === 0) warnings.push(`skills.json: "${skill.name}" has no evidence`);
  }
}

// Experience -> project links
for (const e of k.experience) {
  if (e.portfolio_project_id && !projectIds.includes(e.portfolio_project_id)) {
    errors.push(`experience.json: "${e.id}" links to unknown project "${e.portfolio_project_id}"`);
  }
  for (const id of e.project_ids ?? []) {
    if (!projectIds.includes(id)) errors.push(`experience.json: "${e.id}" lists unknown project "${id}"`);
  }
}

// Agent config must list every data file it relies on
const dataFiles = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && f !== "agent.json");
for (const f of dataFiles) {
  if (!k.agent.grounding.source_files.includes(f)) {
    warnings.push(`agent.json: grounding.source_files does not list ${f}`);
  }
}

// Things still to fill in
for (const q of k.faq) if (q.answer === null) warnings.push(`faq.json: "${q.id}" has no answer`);
for (const p of k.projects) {
  if (p._todo) warnings.push(`projects.json: "${p.id}" TODO: ${p._todo}`);
  const linkTodo = p.links["_todo"];
  if (linkTodo) warnings.push(`projects.json: "${p.id}" links TODO: ${linkTodo}`);
}
for (const cv of k.profile.cv_files) if (cv._todo) warnings.push(`profile.json: CV "${cv.variant}" TODO: ${cv._todo}`);
if (!k.profile.contact.booking_link) warnings.push("profile.json: contact.booking_link is empty (needed in V5)");

// Size of the knowledge base (rough token estimate: 4 chars ≈ 1 token)
const chars = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith(".json"))
  .reduce((sum, f) => sum + readFileSync(join(DATA_DIR, f), "utf8").length, 0);

console.log(`Projects: ${k.projects.length} · Experiences: ${k.experience.length} · FAQ: ${k.faq.length}`);
console.log(`Knowledge size: ${chars} chars (~${Math.round(chars / 4)} tokens)\n`);

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log(`\nData OK (${warnings.length} warning(s)).`);

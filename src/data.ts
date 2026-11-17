import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as files from "./knowledge-files.js";

/** Absolute path of the data/ folder (used by developer scripts only, not at runtime). */
export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

const str = z.string().min(1);
const strList = z.array(str);

export const ProfileSchema = z.object({
  name: str,
  headline: str,
  location: z.object({ city: str, country: str, remote_friendly: z.boolean() }),
  status: z.object({
    open_to_opportunities: z.boolean(),
    availability: str,
    notice_period: str,
    contract_types: strList,
    work_modes: strList,
    relocation: str,
  }),
  summary: z.object({ short: str, long: str }),
  positioning: z.object({
    focus_profile: str,
    primary_profile: str,
    secondary_profile: str,
    strengths: strList,
    target_roles: strList,
  }),
  key_numbers: z.record(z.string(), z.unknown()),
  education: z.array(
    z.object({ degree: str, school: str, location: str, date: str, specialization: str }),
  ),
  languages: z.array(z.object({ language: str, level: str })),
  contact: z.object({
    email: z.email(),
    linkedin: z.url(),
    github: z.url(),
    portfolio: z.url(),
    booking_link: z.url().nullable(),
  }),
  cv_files: z.array(
    z.object({ variant: str, title: str, portfolio_path: str.nullable(), _todo: str.optional() }),
  ),
});

export const ExperienceSchema = z.object({
  experience: z.array(
    z.object({
      id: str,
      title: str,
      company: str,
      location: str,
      start: z.string().regex(/^\d{4}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
      current: z.boolean().optional(),
      type: str,
      product: str,
      delivery: str.optional(),
      team: str.optional(),
      contribution: str.optional(),
      stack: strList,
      highlights_fullstack: strList,
      highlights_devops: strList,
      stories: z
        .array(z.object({ title: str, situation: str, action: str, result: str }))
        .optional(),
      portfolio_project_id: str.nullable(),
      project_ids: strList.optional(),
    }),
  ),
});

export const ProjectSchema = z.object({
  id: str,
  name: str,
  category: strList,
  featured: z.boolean(),
  in_portfolio: z.boolean(),
  status: str.optional(),
  period: str.nullable(),
  context: str,
  pitch: str,
  problem: str.nullable(),
  solution: str.nullable(),
  workflow: strList.nullable(),
  role: str,
  highlights: strList,
  stack: strList,
  results: z.array(str),
  links: z.record(z.string(), z.string().nullable()),
  portfolio: z.object({ page: str.nullable(), anchor: str.nullable() }),
  good_for_roles: strList,
  _todo: str.optional(),
});

export const ProjectsSchema = z.object({ projects: z.array(ProjectSchema) });

export const SkillsSchema = z.object({
  groups: z.array(
    z.object({
      id: str,
      label: str,
      skills: z.array(z.object({ name: str, evidence: z.array(str) })),
    }),
  ),
});

export const FaqSchema = z.object({
  faq: z.array(
    z.object({ id: str, question: str, answer: str.nullable(), agent_policy: str.optional() }),
  ),
});

export const AgentConfigSchema = z.object({
  language: z.object({ reply_in: str, note: str }),
  tone: z.object({ style: str, rules: strList }),
  grounding: z.object({ source_files: strList, rules: strList }),
  policies: z.record(z.string(), str),
  features: z.object({
    lead_capture: z.boolean(),
    owner_notifications: z.boolean(),
    scroll_to_section: z.boolean(),
    job_description_matching: z.boolean(),
    book_call: z.boolean().optional(),
    _note: str.optional(),
  }),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Experience = z.infer<typeof ExperienceSchema>["experience"][number];
export type Project = z.infer<typeof ProjectSchema>;
export type SkillGroup = z.infer<typeof SkillsSchema>["groups"][number];
export type FaqEntry = z.infer<typeof FaqSchema>["faq"][number];
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export interface Knowledge {
  profile: Profile;
  experience: Experience[];
  projects: Project[];
  skills: SkillGroup[];
  faq: FaqEntry[];
  agent: AgentConfig;
}

function parse<T>(file: string, raw: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid data/${file}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/**
 * Validates every data file. The JSON is imported statically (see knowledge-files.ts) so that
 * bundlers such as Vercel's include it with the function: no file system access at runtime.
 * Throws with a readable message on the first invalid file.
 */
export function loadKnowledge(): Knowledge {
  return {
    profile: parse("profile.json", files.profile, ProfileSchema),
    experience: parse("experience.json", files.experience, ExperienceSchema).experience,
    projects: parse("projects.json", files.projects, ProjectsSchema).projects,
    skills: parse("skills.json", files.skills, SkillsSchema).groups,
    faq: parse("faq.json", files.faq, FaqSchema).faq,
    agent: parse("agent.json", files.agent, AgentConfigSchema),
  };
}

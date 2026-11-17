// Static imports of data/*.json so the knowledge base is bundled with the code (Vercel functions).
// Validation happens in data.ts; these are raw, untyped values.
import profileJson from "../data/profile.json" with { type: "json" };
import experienceJson from "../data/experience.json" with { type: "json" };
import projectsJson from "../data/projects.json" with { type: "json" };
import skillsJson from "../data/skills.json" with { type: "json" };
import faqJson from "../data/faq.json" with { type: "json" };
import agentJson from "../data/agent.json" with { type: "json" };

export const profile: unknown = profileJson;
export const experience: unknown = experienceJson;
export const projects: unknown = projectsJson;
export const skills: unknown = skillsJson;
export const faq: unknown = faqJson;
export const agent: unknown = agentJson;

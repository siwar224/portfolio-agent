# Portfolio Agent

AI agent that presents Siwar M'SALLEM's profile to recruiters, then records who really talked to it and where they came from.

Separate from the portfolio website: it is deployed on its own, and the portfolio will only embed a script.

- Roadmap, flow diagram and progress: [ROADMAP.md](ROADMAP.md)
- Knowledge base: [`data/`](data) (profile, experience, projects, skills, FAQ, agent behaviour)

## Setup

Requires Node.js 22+.

```bash
npm install
cp .env.example .env   # then fill in ANTHROPIC_API_KEY (needed from V1)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local test playground on http://localhost:8787 (needs `ANTHROPIC_API_KEY` in `.env`) |
| `npm run typecheck` | TypeScript check |
| `npm run check:data` | Validates `data/*.json` (schemas, ids, cross-references) and lists what is still to fill in |
| `npm run check` | Both of the above |

## Project structure

```
data/            knowledge base and agent behaviour (JSON)
src/data.ts      typed loader + schemas for data/
src/prompt.ts    system prompt built from data/
src/agent.ts     Claude call (streaming, prompt caching, refusal fallback)
scripts/         developer scripts (check-data, dev-server; later: eval)
playground/      local test page (not deployed)
```

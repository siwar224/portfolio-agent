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

## Deployment (Vercel)

The agent is its own Vercel project. `api/chat.ts` is the only public endpoint (`POST /api/chat`, NDJSON stream).
Set these environment variables in the Vercel project (see `.env.example`):

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` | Model provider key (never in the code) |
| `AGENT_PROVIDER`, `AGENT_MODEL` | Optional provider/model choice |
| `ALLOWED_ORIGINS` | Portfolio origin(s) allowed to call the API, e.g. `https://siwar-msallem.vercel.app` |
| `RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_PER_DAY`, `GLOBAL_DAILY_LIMIT` | Abuse and quota protection (defaults 6 / 40 / 500) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional: rate limits shared across instances |

## Project structure

```
data/            knowledge base and agent behaviour (JSON)
api/chat.ts      Vercel function (public endpoint)
src/server/      shared HTTP handler: CORS, rate limits, validation, streaming
src/data.ts      typed loader + schemas for data/ (JSON bundled via knowledge-files.ts)
src/prompt.ts    system prompt built from data/
src/agent.ts     Claude call (streaming, prompt caching, refusal fallback)
scripts/         developer scripts (check-data, dev-server; later: eval)
playground/      local test page (not deployed)
```

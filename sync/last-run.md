## Knowledge sync — 2026-11-23

Proposed by the GitHub sync (model `gemini-2.5-flash`). **Review every line before merging**: the agent will repeat these facts to recruiters.

### ➕ New project: GIRA WhatsApp Agent - Automated customer service and booking
Repo: https://github.com/siwar224/gira-whatsapp-agent · 100% of recent commits by Siwar

> An AI-powered WhatsApp agent for GIRA — Pasta & Mare, designed to automate customer inquiries and manage table bookings.

- Developed an AI-powered WhatsApp agent to handle customer inquiries and manage table bookings for a restaurant.
- Implemented a delayed response mechanism, allowing the restaurant team to answer first before the agent intervenes.
- Integrated with the GIRA website's booking API to facilitate real-time table reservations, cancellations, and waiting list additions.
- Configured the agent to reply in the customer's language and to handle booking confirmations with explicit user consent.
- Designed a handover mechanism for complex queries or complaints, notifying staff and pausing agent interaction.
- Enabled dynamic configuration of reply delay, agent status, and GIRA URL without requiring redeployment.

**Stack:** Python, CodeWords, Claude Sonnet 4.6

### ✏️ Updated: GIRA - Pasta & Mare
Repo: https://github.com/siwar224/GIRA · Siwar added comprehensive booking management, a staff service view, and a robust CI/CD pipeline with extensive testing and Docker packaging.
- ➕ Implemented comprehensive booking management, allowing guests to look up, modify pre-orders, or cancel reservations, and integrated a waiting list system that notifies guests when tables become available.
- ➕ Developed a dedicated "La sala" service view for restaurant staff, displaying real-time table status, guest details, occasions, and pre-ordered dishes, alongside the waiting list.
- ➕ Established a robust CI/CD pipeline with over 130 unit and integration tests (Vitest), end-to-end testing (Playwright), preview environments, and Docker packaging for reliable releases.
- Stack ➕ PostgreSQL, Neon, Resend, Vitest, Playwright, GitHub Actions, Docker, GitHub Packages
- Status: In progress → **Released**
- ✅ Resolved TODO: _Added automatically from GitHub: review the wording and add results if any._

### ✏️ Updated: PeopleKnowledge AI - RAG over HR Policies
Repo: https://github.com/siwar224/peopleknowledge-ai · The RAG pipeline, including document parsing, chunking, local embeddings, Qdrant vector store, and local LLM generation, has been implemented and tested.
- ➕ Answers HR questions with traceable sources, refusing to guess, and applies version awareness to exclude archived policies.
- ➕ Processes PDF, DOCX, and CSV documents through a pipeline of parsing, chunking, embedding with BAAI/bge-m3, and indexing into Qdrant.
- ➕ Generates grounded answers using a local Qwen 2.5 LLM via llama.cpp, ensuring strict JSON output and validating citations against provided context.
- Stack ➕ Pydantic v2, pdfplumber, python-docx, BAAI/bge-m3, sentence-transformers, Qdrant, Qwen 2.5, llama.cpp
- ✅ Resolved TODO: _Early-stage repo: complete the description once the RAG pipeline (embeddings, vector store, LLM) is implemented._

### ✏️ Updated: This portfolio
Repo: https://github.com/siwar224/portfolio · Siwar integrated an AI assistant and automated GitHub project display, alongside general code refactoring.
- Stack ➕ Claude

### ✏️ Updated: Portfolio Agent - AI assistant for recruiters
Repo: https://github.com/siwar224/portfolio-agent · Siwar enhanced the AI agent with Gemini-powered knowledge base updates, prompt caching, and a refusal fallback mechanism, and the project is now deployed.
- ➕ Utilizes Google Gemini to generate structured proposals for knowledge base updates from GitHub repository data.
- ➕ Implemented prompt caching to optimize AI agent responses.
- ➕ Developed a refusal fallback mechanism for the AI agent to handle inappropriate queries.
- Status: (none) → **Deployed**


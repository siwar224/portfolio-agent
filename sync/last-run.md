## Knowledge sync — 2026-11-17

Proposed by the GitHub sync (model `gemini-2.5-flash`). **Review every line before merging**: the agent will repeat these facts to recruiters.

### ✏️ Updated: Portfolio Agent - AI assistant for recruiters
Repo: https://github.com/siwar224/portfolio-agent · Siwar enhanced the Portfolio Agent with a human-in-the-loop knowledge base update process, distributed rate limiting, and origin-based API access control.
- ➕ Implemented a human-in-the-loop review process for knowledge base updates, requiring manual merge via Pull Request.
- ➕ Utilized Upstash Redis to implement distributed rate limiting, ensuring consistent abuse and quota protection across instances.
- ➕ Configured API access to allow calls only from specified origins, enhancing security.

### ✏️ Updated: This portfolio
Repo: https://github.com/siwar224/portfolio · Siwar added an AI assistant, automated GitHub project display, and refactored the layout for improved responsiveness.
- ➕ Automated display of GitHub projects using a custom workflow and sync script.
- ➕ Integrated an AI assistant widget across multiple pages.
- ➕ Refactored project layout using CSS Grid for enhanced accessibility and responsiveness.
- Stack ➕ GitHub Actions

### ➕ New project: GIRA - Pasta & Mare
Repo: https://github.com/siwar224/GIRA · 100% of recent commits by Siwar

> A website for an Italian restaurant, featuring a scroll-driven story, a build-your-own plate studio, and an interactive booking experience.

- Developed a scroll-scrubbed hero with 376 hand-cut frames drawn to a canvas, featuring text beats, breathing light, and particles.
- Implemented an interactive 'Crea il tuo' plate builder allowing users to pick ingredients and drag them onto a plate with live pricing and allergen information.
- Created a real-time booking experience ('Prenota') with a dynamic table setting, spiral time dial, and an interactive floor plan for table selection.
- Ensured accessibility with full keyboard support, visible focus, 44 px touch targets, WCAG AA contrast, and `prefers-reduced-motion` respected.
- Utilized Next.js 15 App Router with static rendering, React 19, and TypeScript for a robust and performant application.
- Integrated GSAP 3 (ScrollTrigger, SplitText) and Lenis for advanced scroll-driven animations and smooth scrolling.

**Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, GSAP 3, Lenis, Node.js, HTML, CSS, JavaScript

### ➕ New project: VELOURS - Cinematic Scroll Experience
Repo: https://github.com/siwar224/VELOURS · 100% of recent commits by Siwar

> A scroll-driven single-page application showcasing a cinematic presentation for a fictional luxury perfume brand.

- Implemented a scroll-driven, cinematic single-page experience for a fictional luxury perfume house.
- Developed a pinned canvas element that plays a 192-frame WebP sequence, scrubbed by user scroll.
- Choreographed real HTML text and background elements to animate precisely over the canvas sequence.
- Integrated a preloader, reduced-motion fallback, and mobile frame-set hook for optimized performance and accessibility.
- Managed frame assets with a manifest generation script, ensuring dynamic frame counting.
- Utilized GSAP with ScrollTrigger and SplitText for advanced timeline-based animations and text effects.

**Stack:** Next.js, TypeScript, Tailwind CSS, GSAP, ScrollTrigger, SplitText, Lenis, JavaScript, CSS

### ➕ New project: VELOR — Velvet Cold Coffee - Cinematic brand site and restaurant dashboard
Repo: https://github.com/siwar224/VELORA · 100% of recent commits by Siwar

> A cinematic, scroll-driven brand site for a fictional coffee shop, paired with a comprehensive restaurant dashboard for managing orders, menu, and opening hours, all built entirely on the frontend.

- Developed a scroll-scrubbed frame sequence on a pinned canvas, synchronizing 267 WebP frames 1:1 with scroll position for a cinematic effect.
- Implemented a comprehensive admin dashboard with an Orders kanban board, Menu management, and Settings, featuring search, sort, filters, and a command palette.
- Engineered a production-grade data layer using MSW v2 and TanStack Query, providing typed REST API, caching, background refetch, and cross-tab synchronization.
- Integrated optimistic updates with rollback for all admin write operations, enhancing user experience with immediate feedback and robust error handling.
- Ensured high quality through extensive accessibility features, reduced motion support, and achieving top Lighthouse scores (97-100) on desktop production builds.
- Created a realistic network simulator within the dashboard to test various latency and failure scenarios for robust frontend development.

**Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, GSAP, ScrollTrigger, SplitText, Lenis, TanStack Query v5, Zustand, zod 4, MSW v2, dnd-kit, TanStack Table, react-hook-form, Recharts, ESLint, Playwright, axe-core


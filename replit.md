# replit.md

## Overview

This is a Korean-language fortune-telling web application ("천상의 운세" / "Celestial Fortune") that provides personalized daily horoscopes and fortune readings. Users register with their Telegram ID, birth details, and gender, then receive AI-generated fortune readings powered by OpenAI. The app has a mystical/celestial dark theme with gold accents, star field animations, and Korean typography.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router) with three main routes: Home (`/`), Register (`/register`), Dashboard (`/dashboard/:telegramId`)
- **State Management**: TanStack React Query for server state (caching, mutations, queries)
- **Forms**: React Hook Form with Zod validation via `@hookform/resolvers`
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives, styled with Tailwind CSS
- **Animations**: Framer Motion for page transitions, star field effects, and card animations
- **Styling**: Tailwind CSS with CSS variables for theming. Dark mystical theme with custom colors (deep purple background, gold primary). Fonts: Cinzel (serif, headings) and Quicksand (sans-serif, body)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript (run via tsx)
- **HTTP Server**: Node.js `http.createServer` wrapping Express
- **API Pattern**: RESTful JSON API under `/api/` prefix. Routes defined in `server/routes.ts`
- **Shared Route Definitions**: `shared/routes.ts` defines API contracts (paths, methods, Zod input/output schemas) shared between client and server
- **AI Integration**: OpenAI SDK configured via Replit AI Integrations environment variables (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`) for fortune generation
- **Dev/Prod Split**: In development, Vite dev server runs as middleware with HMR. In production, pre-built static files are served from `dist/public/`
- **Build Process**: Custom build script (`script/build.ts`) uses Vite for client and esbuild for server, outputting to `dist/`

### Data Storage
- **Database**: PostgreSQL via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema** (in `shared/schema.ts`):
  - `users` table: id, telegramId (unique), telegramHandle, name, birthDate, birthTime, gender, preferredDeliveryTime, createdAt
  - `fortunes` table: id, userId (FK to users), content (text), createdAt
- **Additional Schema** (in `shared/models/chat.ts`): `conversations` and `messages` tables for Replit AI integration chat features
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)
- **Storage Layer**: `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class wrapping Drizzle queries

### Replit AI Integrations
The `server/replit_integrations/` and `client/replit_integrations/` directories contain pre-built integration modules:
- **Chat**: Conversation/message CRUD with OpenAI streaming
- **Audio**: Voice recording, playback, speech-to-text, text-to-speech via AudioWorklet
- **Image**: Image generation via `gpt-image-1`
- **Batch**: Rate-limited batch processing utility with retries

These are scaffolded utilities and may not all be actively wired into the main app routes.

### Key API Endpoints
- `POST /api/users` — Create a new user (registration)
- `GET /api/users/:telegramId` — Get user by Telegram ID
- `POST /api/fortunes/generate` — Generate a new fortune for a user (AI-powered, daily limit 1회, 3회 교차 검증)
- `GET /api/fortunes/:telegramId` — Fortune history retrieval (by userId)

### Fortune Generation Logic (Cross-Validation Voting)
1. **Daily Limit**: Each user can generate only 1 fortune per day. Returns 429 if already generated.
2. **3-Way Parallel Generation**: 3 independent fortune readings are generated simultaneously via OpenAI (gpt-4o, temperature 0.3).
3. **Structured JSON Output**: Each reading returns score, direction, caution, special notes in JSON format.
4. **Voting/Averaging**: Score is averaged across 3 readings; direction uses majority vote.
5. **Synthesis**: A final GPT call cross-validates all 3 results, only keeping content mentioned in 2+ readings.
6. **Result**: The synthesized, cross-validated fortune is saved to DB and displayed to user.

## External Dependencies

- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable. Uses `pg` (node-postgres) driver with connection pooling
- **OpenAI API**: Fortune generation and chat completions. Configured through Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`)
- **Google Fonts**: Cinzel and Quicksand fonts loaded via CDN in `index.html`
- **Replit Plugins**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` (dev-only)
- **connect-pg-simple**: Session storage (available in dependencies, may be used for session management)
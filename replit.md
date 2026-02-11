# replit.md

## Overview

This is a Korean-language fortune-telling web application ("천상의 운세" / "Celestial Fortune") that provides personalized daily horoscopes and fortune readings. Users register with their Telegram ID, birth details, gender, MBTI, and birthplace, then receive AI-generated fortune readings powered by OpenAI. The app provides three types of fortune analysis: 사주팔자 (Four Pillars), 별자리 운세 (Zodiac), and 수비학 (Numerology), all cross-validated 3 times. The app has a mystical/celestial dark theme with gold accents, star field animations, and Korean typography.

## User Preferences

Preferred communication style: Simple, everyday language.
Design preference: Apple Human Interface Guidelines style - clean, minimal.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router) with routes: Home (`/`), Register (`/register`), Dashboard (`/dashboard/:telegramId`), Settings (`/settings/:telegramId`)
- **State Management**: TanStack React Query for server state (caching, mutations, queries)
- **Forms**: React Hook Form with Zod validation via `@hookform/resolvers`
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives, styled with Tailwind CSS
- **Animations**: Framer Motion for page transitions, star field effects, score ring animations, and card animations
- **Styling**: Tailwind CSS with CSS variables for theming. Dark mystical theme with custom colors (deep purple background, gold primary). Fonts: Cinzel (serif, headings) and Quicksand (sans-serif, body)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript (run via tsx)
- **HTTP Server**: Node.js `http.createServer` wrapping Express
- **API Pattern**: RESTful JSON API under `/api/` prefix. Routes defined in `server/routes.ts`
- **Shared Route Definitions**: `shared/routes.ts` defines API contracts (paths, methods, Zod input/output schemas) shared between client and server
- **AI Integration**: OpenAI SDK configured via Replit AI Integrations environment variables (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`) for fortune generation
- **Telegram Integration**: Bot API for sending fortune messages (requires `TELEGRAM_BOT_TOKEN` secret)
- **Dev/Prod Split**: In development, Vite dev server runs as middleware with HMR. In production, pre-built static files are served from `dist/public/`
- **Build Process**: Custom build script (`script/build.ts`) uses Vite for client and esbuild for server, outputting to `dist/`

### Data Storage
- **Database**: PostgreSQL via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema** (in `shared/schema.ts`):
  - `users` table: id, telegramId (unique), telegramHandle, name, birthDate, birthTime, gender, mbti, birthCountry, birthCity, preferredDeliveryTime, createdAt
  - `fortunes` table: id, userId (FK to users), content (text), fortuneData (JSON string of FortuneData), createdAt
- **Utility functions** in `shared/schema.ts`: `getZodiacSign(birthDate)`, `getLifePathNumber(birthDate)`, `FortuneData` interface
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)
- **Storage Layer**: `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class wrapping Drizzle queries

### Key API Endpoints
- `POST /api/users` — Create a new user (registration with MBTI, birthplace)
- `GET /api/users/:telegramId` — Get user by Telegram ID
- `PUT /api/users/:telegramId` — Update user info (settings page)
- `POST /api/fortunes/generate` — Generate a new fortune (AI-powered, daily limit 1회, 9회 교차 검증: 사주x3 + 별자리x3 + 수비학x3)
- `GET /api/fortunes/:telegramId` — Fortune history retrieval (by userId)

### Fortune Generation Logic (Cross-Validation Voting)
1. **Daily Limit**: Each user can generate only 1 fortune per day (KST). Returns 429 if already generated.
2. **9-Way Parallel Generation**: 3 categories x 3 independent readings each, all generated in parallel:
   - 사주팔자 (Four Pillars): score, direction, caution, special, summary
   - 별자리 (Zodiac): score, love, money, health, work, summary
   - 수비학 (Numerology): lucky numbers, message
3. **Structured JSON Output**: Each reading returns structured JSON validated with Zod schemas.
4. **Voting/Averaging**: 
   - Saju score: averaged across 3 readings
   - Zodiac score: averaged across 3 readings
   - Combined score: average of saju + zodiac scores
   - Direction: majority vote across 3 saju readings
   - Lucky numbers: most frequently mentioned numbers across 3 numerology readings
5. **Synthesis**: A final GPT call cross-validates all results, only keeping content mentioned in 2+ readings.
6. **Result**: The synthesized fortune is saved to DB as both formatted text and structured JSON (FortuneData).
7. **Telegram**: Fortune is automatically sent to user's Telegram upon generation.

### Key Components
- **FortuneScoreCard**: Apple HIG-style card showing combined score ring, mini score bars for saju/zodiac, direction, lucky numbers, and detailed sections for each fortune type
- **FortuneCard**: Individual fortune history cards with formatted content
- **Layout**: Header with logo (links to home) and settings link (when telegramId available)

## External Dependencies

- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable. Uses `pg` (node-postgres) driver with connection pooling
- **OpenAI API**: Fortune generation and chat completions. Configured through Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`)
- **Telegram Bot API**: Sends fortune messages to users. Requires `TELEGRAM_BOT_TOKEN` secret.
- **Google Fonts**: Cinzel and Quicksand fonts loaded via CDN in `index.html`
- **Replit Plugins**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` (dev-only)

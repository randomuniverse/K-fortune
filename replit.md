# replit.md

## Overview

"Celestial Fortune" is a Korean-language AI fortune-telling web application offering personalized readings through a unique cross-validation of three independent Eastern and Western astrological systems: Saju, Ziwei Doushu, and Western Zodiac. A Guardian AI synthesizes these analyses, only adopting insights confirmed by at least two systems. The application targets users interested in comprehensive, AI-powered destiny analysis, with a vision to become a leading platform for personalized astrological insights in Korea. The UI features a mystical, celestial dark theme with gold accents and specific Korean typography.

## User Preferences

- Preferred communication style: Simple, everyday language.
- Design preference: Apple Human Interface Guidelines style — clean, minimal.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Vite, Wouter for routing.
- **State Management**: TanStack React Query.
- **Forms**: React Hook Form with Zod validation.
- **UI Components**: shadcn/ui (new-york style) built on Radix UI, styled with Tailwind CSS.
- **Animations**: Framer Motion for transitions and effects.
- **Styling**: Tailwind CSS with custom dark mystical theme (deep purple, gold accents), using Cinzel and Quicksand fonts.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript (tsx).
- **API Pattern**: RESTful JSON API, shared route definitions via Zod schemas.
- **AI Integration**: OpenAI SDK (GPT-4o) for fortune generation and synthesis.
- **Telegram Integration**: Bot API for fortune delivery and user linking.
- **Build**: Custom script using Vite (client) and esbuild (server).
- **Resilience**: `p-retry` for AI API calls.

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM, `drizzle-zod` for schema integration.
- **Migrations**: `drizzle-kit push`.
- **Storage Layer**: `IStorage` interface with `DatabaseStorage` implementation.

### Key Features
- **Dashboard**: Displays daily, yearly, and deep destiny reports, accessible via user's Telegram ID.
- **Fortune Generation Logic**:
    - **Daily Fortune**: 3-system parallel generation (Saju, Zodiac, Ziwei Doushu), followed by Guardian Synthesis for coherence scoring, keyword extraction, and core message generation. Limited to one per user per day.
    - **Guardian Report (Deep Destiny Analysis)**: Three independent AI analyses (parallel) of user data, then synthesized by Guardian AI, adopting only consensus content. Includes Master Archetype, past inference, current state, bottleneck, solution, and business advice.
    - **Yearly Fortune**: Three system-specific analyses (Saju, Ziwei Doushu, Zodiac) for the year, followed by Guardian Synthesis providing overall summary, business, love, and health fortunes, and combined monthly flows.
- **Saju Engine**: Pure TypeScript implementation for Four Pillars astrology calculations (pillars, ten gods, five elements, day master strength, yongshin, daeun, special sals like 괴강살, 도화살, 화개살, 역마살, and structure patterns like 식상생재, 관인상생, 상관견관, 재다신약). Includes personality analysis and yearly/monthly fortune calculations.
- **Ziwei Doushu Engine**: Implements Purple Star Astrology, calculating Bureau, Life Palace, and placing 14 major stars across palaces for interpretation.

## External Dependencies

- **PostgreSQL**: Primary database.
- **OpenAI API (GPT-4o)**: For AI-powered fortune generation and synthesis.
- **Telegram Bot API**: For user communication and fortune delivery.
- **Google Fonts CDN**: For custom typography (Cinzel, Quicksand).
- **lunar-javascript**: For lunar/solar calendar conversions in Ziwei calculations.
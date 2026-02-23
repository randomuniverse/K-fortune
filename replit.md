# replit.md

## Overview
"천상의 운세" (Celestial Fortune) is a Korean-language AI fortune-telling web application that offers personalized fortune readings. It integrates three distinct Eastern and Western astrological systems (Saju, Ziwei Doushu, and Western Zodiac), cross-validating their insights through a "Guardian AI" to provide synthesized and validated reports. Users register with personal details, including birth information and MBTI, to receive AI-generated readings powered by OpenAI GPT-4o. The application aims to provide a comprehensive and mystical fortune-telling experience, emphasizing accuracy through multi-system cross-validation.

## User Preferences
- Preferred communication style: Simple, everyday language.
- Design preference: Apple Human Interface Guidelines style — clean, minimal.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Vite for bundling.
- **Routing**: Wouter.
- **State Management**: TanStack React Query.
- **Forms**: React Hook Form with Zod validation.
- **UI Components**: shadcn/ui (new-york style) built on Radix UI, styled with Tailwind CSS.
- **Animations**: Framer Motion for transitions and visual effects.
- **Styling**: Tailwind CSS with a dark mystical theme (deep purple, gold accents), using Cinzel and Quicksand fonts.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript.
- **API Pattern**: RESTful JSON API.
- **AI Integration**: OpenAI SDK (GPT-4o) for fortune generation.
- **Telegram Integration**: Bot API for user communication and webhooks.
- **Build Process**: Custom script using Vite for client and esbuild for server.
- **Resilience**: `p-retry` for API calls. Guardian Report uses single-call architecture with few-shot examples for cost efficiency.

### Data Storage
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Migrations**: `drizzle-kit push`.

### Fortune Engine Logic
- **Graceful Degradation**: Fortune generation uses `Promise.allSettled`; if one or two systems fail, partial results are still provided.
- **Daily Fortune (v2.0)**: Generates a daily reading by combining Saju, Zodiac, and Ziwei Doushu analyses, then synthesizes them with a Guardian AI. V2.0 enhancements include: oracle-style one-liner (oracleLine), today's prescription (todayPrescription), time-based guidance (morning/afternoon/evening scores+messages via calculateTimeGuide), daily saju insight (generateDailySajuInsight — pure logic, no API calls), score delta from previous day, lucky color/time. GPT prompts enforce assertive Korean tone (no "~할 수 있습니다" weak expressions). Telegram messages redesigned to oracle-style compact format. Web UI features oracle line card, time guide grid, prescription section, and accordion-style detail sections.
- **Guardian Report**: Single-call architecture (refactored from 4-call: 3-parallel + synthesis) with few-shot examples for 75% API cost reduction. Provides deep destiny analysis with businessAdvice, loveAdvice (gender-aware: 재성/관성 + 신살 + 간여지동 기반 동적 분석), and healthAdvice (질액궁 + 오행 장부 mapping). Uses gender parameter for sex-specific saju love analysis. System prompt includes 丁火 example for pastInference/currentState/bottleneck/solution sections. **Regenerating Guardian Report auto-regenerates Yearly Fortune** with the new data.
- **Yearly Fortune**: Offers annual forecasts from each system, cross-validated and synthesized by the Guardian AI, including monthly flow predictions. **Connected to Guardian Report**: When a Guardian Report exists, its results (coreEnergy, bottleneck, solution, advice fields) are injected into the yearly fortune synthesis prompt as a foundation. The yearly fortune GPT also acts as a **verifier** — it cross-checks Guardian Report's claims against raw saju data and logs any inconsistencies via `guardianValidation`. The yearly fortune's independent regenerate button has been removed; regeneration is triggered only through the Guardian Report flow.

### Core Calculation Engines
- **Saju Engine**: Pure TypeScript implementation for Four Pillars astrology, calculating pillars, Ten Gods, five element ratios, Day Master strength, Yongshin, Daeun cycles, and ~25 core special sal types via `detectComprehensiveSals(chart, gender)` — data-driven detection with category classification (길신/흉신/중성). Gender parameter filters 고신(male-only) and 과숙(female-only). Detection methods include: 일간→지지 mapping (6 core types: 천을귀인/문창귀인/금여록/천록/양인살/비인), 일간→천간 mapping, 월지→천간 mapping, 삼합 group (11 types: 화개/역마/도화/겁살/재살/월살/반안살/육해살/장성/지살/천살), 개별 지지 기반 (7 types), 일주 exact match, 공망(multiple foundIn support), 천라지망, 오귀살. Minor 귀인 sals (학당/복성/암록/천주/천관/천복/국인) removed to reduce over-detection. 상문살/조객살/낙정관살 moved to dynamic-only (`DYNAMIC_ONLY_BRANCH_SALS`). 급각살 removed from static detection. Samhap sals now check both 년지 and 일지 as basis (fallback). Dynamic sinsal no longer checks DAY_PILLAR_SALS against 세운 간지 (복신 오적용 fix). Also detects 간여지동 (干與支同) and structure patterns (식상생재, 관인상생, 상관견관, 재다신약). `heavenlyGift` generation incorporates detected sals for personalized talent descriptions (max 3 sal-based talents appended).
- **Two-Layer Sinsal System**: Static sinsal (원국, from birth chart) vs Dynamic sinsal (세운, recalculated yearly) with `foundIn` tracking (년지/월지/일지/시지 etc.). `analyzeSinsalIntegrated(chart, year, gender)` combines both layers, detects overlapping sals for "극대화" effects, and includes samjae (삼재) 3-year cycle detection (들삼재→눌삼재→날삼재). Dynamic sinsal includes `DYNAMIC_ONLY_BRANCH_SALS` (상문살/조객살/낙정관살) that only activate yearly, not in birth chart. UI displays foundIn badges, "올해 극대화" markers for overlapping sals, and dedicated sections for dynamic/samjae warnings.
- **Ziwei Doushu Engine**: Implements Purple Star Astrology, calculating Bureau, Life Palaces, and the distribution/interpretation of 14 major stars across various palaces.

## External Dependencies
- **PostgreSQL**: Primary database.
- **OpenAI API (GPT-4o)**: For all AI-driven fortune generation and synthesis.
- **Telegram Bot API**: For sending fortunes and user linking.
- **Google Fonts CDN**: For custom typography (Cinzel, Quicksand).
- **lunar-javascript**: For lunar/solar calendar conversions in Ziwei calculations.
- **p-retry**: For enhancing API call resilience.
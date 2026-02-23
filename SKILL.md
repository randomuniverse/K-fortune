# K-fortune (천상의 운세) — Claude Code SKILL.md

## 프로젝트 개요

한국어 AI 운세 웹앱. 사주팔자(四柱八字), 자미두수(紫微斗數), 서양 별자리 3개 시스템을 교차 검증하여 GPT-4o 기반의 통합 운세를 제공한다. 텔레그램 딥링크로 유저를 연동하고 매일 07:00 KST에 자동 운세를 발송한다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18 + TypeScript, Vite, Wouter, TanStack Query, shadcn/ui, Framer Motion, Tailwind CSS |
| Backend | Express 5 + TypeScript (ESM), Node.js |
| DB | PostgreSQL + Drizzle ORM |
| AI | OpenAI GPT-4o (`openai` SDK) |
| 메시징 | Telegram Bot API (웹훅 방식) |
| 스케줄러 | 자체 구현 (`server/scheduler.ts`) |

---

## 디렉토리 구조

```
K-fortune/
├── client/src/
│   ├── pages/
│   │   ├── Home.tsx         - 랜딩
│   │   ├── Register.tsx     - 회원가입
│   │   ├── Dashboard.tsx    - 메인 대시보드 (오늘/연간/운명 탭)
│   │   ├── Settings.tsx     - 유저 설정
│   │   ├── Simulator.tsx    - 비회원 테스트 시뮬레이터
│   │   └── Admin.tsx        - 어드민 대시보드
│   ├── components/
│   │   ├── FortuneCard.tsx       - 오늘의 운세 카드
│   │   ├── GuardianReport.tsx    - 가디언 리포트 (운명 분석)
│   │   ├── YearlyFortuneCard.tsx - 연간 운세 카드
│   │   ├── SajuProfileCard.tsx   - 사주/자미두수/별자리 상세
│   │   └── SajuInfoCard.tsx      - 사주 기본 정보
│   └── hooks/
│       └── use-fortune.ts   - API 호출 훅 모음
├── server/
│   ├── index.ts         - 서버 엔트리, DB 마이그레이션 자동 적용
│   ├── routes.ts        - REST API 라우터 전체
│   ├── fortune-engine.ts - GPT-4o 운세 생성 로직
│   ├── scheduler.ts     - 매일 07:00 KST 자동 운세 발송
│   ├── storage.ts       - DB 접근 레이어 (IStorage 인터페이스)
│   └── db.ts            - Drizzle DB 커넥션
├── shared/
│   ├── schema.ts        - DB 스키마 + Zod 타입 + 별자리 데이터
│   ├── saju.ts          - 사주 계산 엔진 (순수 TypeScript)
│   ├── ziwei.ts         - 자미두수 계산 엔진
│   └── routes.ts        - API 경로 상수 + 입력 스키마
├── migrations/          - Drizzle 마이그레이션 SQL 파일
└── script/build.ts      - 빌드 스크립트 (Vite + esbuild)
```

---

## 환경 변수

```env
DATABASE_URL=           # PostgreSQL 연결 URL (필수)
OPENAI_API_KEY=         # GPT-4o API 키 (필수)
TELEGRAM_BOT_TOKEN=     # 텔레그램 봇 토큰 (필수)
ADMIN_PASSWORD=         # 어드민 로그인 비밀번호
```

---

## 개발 명령어

```bash
npm run dev       # 개발 서버 (tsx server/index.ts)
npm run build     # 프로덕션 빌드 (dist/)
npm run start     # 프로덕션 실행 (dist/index.cjs)
npm run check     # TypeScript 타입 검사
```

---

## DB 스키마 변경 규칙 (중요)

### 절대 금지
- `npx drizzle-kit push` **절대 사용 금지** — 프로덕션 테이블을 DROP/CREATE하여 데이터 유실

### 올바른 순서
1. `shared/schema.ts` 수정
2. `npx drizzle-kit generate` 실행 → `migrations/` 에 SQL 파일 자동 생성
3. 서버 재시작 시 `drizzle-orm/migrator`가 자동 적용

### 마이그레이션 파일 작성 원칙
- 테이블 생성: `CREATE TABLE IF NOT EXISTS`
- 컬럼 추가: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- 데이터 변환 쿼리는 반드시 트랜잭션 안에서 처리

### DB 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | 유저 기본 정보 + 텔레그램 연동 필드 |
| `fortunes` | 일별 운세 (하루 1회 제한) |
| `guardian_reports` | 가디언 리포트 (운명 분석, 유저당 1개) |
| `yearly_fortunes` | 연간 운세 (userId + year 복합 키) |

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/users` | 회원가입 |
| GET | `/api/users/:telegramId` | 유저 조회 |
| PUT | `/api/users/:telegramId` | 유저 정보 수정 |
| POST | `/api/fortunes/generate` | 오늘의 운세 생성 (하루 1회) |
| GET | `/api/fortunes/:telegramId` | 운세 목록 조회 |
| POST | `/api/fortunes/guardian-report` | 가디언 리포트 생성/재생성 |
| GET | `/api/guardian-report/:telegramId` | 가디언 리포트 조회 |
| POST | `/api/fortunes/yearly` | 연간 운세 생성 |
| GET | `/api/yearly-fortune/:telegramId/:year` | 연간 운세 조회 |
| GET | `/api/saju/:telegramId` | 사주 계산 결과 조회 |
| POST | `/api/telegram/webhook` | 텔레그램 웹훅 수신 |
| POST | `/api/telegram/test-send/:telegramId` | 텔레그램 메시지 테스트 발송 |
| POST | `/api/simulate/guardian` | 비회원 가디언 리포트 시뮬레이션 |
| POST | `/api/simulate/yearly` | 비회원 연간 운세 시뮬레이션 |
| POST | `/api/admin/login` | 어드민 로그인 |
| POST | `/api/admin/users` | 전체 유저 목록 조회 (토큰 필요) |

---

## 핵심 도메인 로직

### 유저 식별 체계

- `telegramId`: 기본 식별자. 텔레그램 연동 전에는 `linkToken`과 동일한 12자리 hex 값
- `linkToken`: 딥링크용 토큰 (`t.me/bot?start={linkToken}`)
- `telegramChatId`: 실제 메시지 발송에 사용하는 Chat ID (웹훅으로 획득)
- `telegramHandle`: 텔레그램 @username (선택)
- `storage.getUserByTelegramId()`: telegramId → telegramHandle → linkToken 순으로 fallback 조회

### 텔레그램 딥링크 연동 흐름

```
가입 → linkToken 생성 (crypto.randomBytes(6).hex)
     → 대시보드에 딥링크 버튼 노출
     → 버튼 클릭 → 텔레그램 앱 열림 → /start {linkToken}
     → 웹훅 수신 → linkToken으로 유저 매칭
     → telegramChatId + telegramHandle 저장
     → "연동 완료" 메시지 발송
```

### 운세 생성 의존성

```
가디언 리포트 재생성
  └→ 연간 운세 자동 연쇄 재생성 (기존 연간 운세가 있을 때만)

연간 운세 생성
  └→ 가디언 리포트 존재 시 해당 데이터를 GPT 프롬프트에 주입
  └→ 가디언 리포트 내용을 독립 교차 검증 (guardianValidation 로그)
```

- 연간 운세의 독립 재생성 버튼은 **제거됨** — 가디언 리포트 탭에서만 재생성 가능

### 오늘의 운세 구성 (FortuneData 타입)

| 필드 | 설명 |
|------|------|
| `sajuScore` / `zodiacScore` / `ziweiScore` | 각 시스템 점수 |
| `combinedScore` | 통합 점수 |
| `coherenceScore` | 3개 시스템 일치도 (%) |
| `oracleLine` | 신탁 형식 한 줄 메시지 |
| `todayPrescription` | 오늘의 처방 |
| `timeGuide` | 아침/오후/저녁 시간대별 점수 + 메시지 |
| `sajuInsight` | 순수 로직 기반 사주 인사이트 (GPT 미사용) |
| `scoreDelta` | 전날 대비 점수 변화 |
| `luckyColor` / `luckyTime` | 행운 색상/시간 |

### 사주 엔진 (`shared/saju.ts`) 주요 함수

| 함수 | 설명 |
|------|------|
| `calculateFullSaju(birthDate, birthTime, gender)` | 사주 원국 계산 |
| `analyzeSajuPersonality(chart, gender)` | 성격 분석 |
| `analyzeSinsalIntegrated(chart, year, gender)` | 신살 통합 분석 (정적+동적) |
| `detectComprehensiveSals(chart, gender)` | ~25가지 신살 감지 |
| `calculateTimeGuide(chart)` | 시간대별 가이드 계산 |
| `generateDailySajuInsight(chart)` | GPT 없이 사주 인사이트 생성 |

### 신살(神殺) 감지 규칙

- **정적 신살**: 원국(생년월일시)에서 감지 → `foundIn: 년지/월지/일지/시지`
- **동적 신살**: 세운(해당 연도)과 교차 감지
- `DYNAMIC_ONLY_BRANCH_SALS`: 상문살·조객살·낙정관살 — 세운에서만 감지, 원국 감지 금지
- `고신살`: 남성 전용 / `과숙살`: 여성 전용 (gender 파라미터로 필터)
- 겹치는 신살 → "올해 극대화" 표시
- 삼재 3년 주기: 들삼재 → 눌삼재 → 날삼재

### 스케줄러 동작 방식

- 매일 **07:00 KST** 전체 유저 운세 자동 생성 + 텔레그램 발송
- 동시 처리: `pLimit(2)` (OpenAI API 부하 분산)
- 실패 시 재시도: `pRetry` (최대 3회, 2초~10초 백오프)
- 서버 재시작 시 당일 07:00 이후면 누락 운세 자동 보완
- 수동 실행: `tsx server/scheduler.ts --run-now`

---

## 프론트엔드 라우팅

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | Home | 랜딩 |
| `/register` | Register | 회원가입 |
| `/dashboard/:telegramId` | Dashboard | 메인 (오늘/연간/운명 탭) |
| `/settings/:telegramId` | Settings | 유저 설정 |
| `/simulator` | Simulator | 비회원 테스트 |
| `/admin` | Admin | 관리자 |

- `:telegramId` 자리에 실제로는 `linkToken` 값이 들어감 (안정적 URL 보장)
- `storage.getUserByTelegramId()`가 linkToken으로도 fallback 조회하므로 동작

### Dashboard 탭 구조

```
메인 탭
├── 오늘의 운세 (today)
├── 2026년 총평 (yearly)
│   ├── 가디언 총평
│   ├── 사주 총평
│   ├── 자미두수 총평
│   └── 별자리 총평
└── 운명 종합 분석 (destiny)
    ├── 가디언 리포트
    ├── 사주팔자
    ├── 자미두수
    └── 별자리 정보
```

---

## 자주 하는 작업 패턴

### 새 DB 컬럼 추가

```bash
# 1. shared/schema.ts 수정
# 2. 마이그레이션 파일 생성
npx drizzle-kit generate
# 3. migrations/XXXX_*.sql 파일에 IF NOT EXISTS 절 확인
# 4. 서버 재시작 → 자동 적용
```

### 새 API 엔드포인트 추가

1. `shared/routes.ts`에 경로 상수 추가
2. `server/routes.ts`에 핸들러 구현
3. `client/src/hooks/use-fortune.ts`에 TanStack Query 훅 추가

### GPT 프롬프트 수정

- 위치: `server/fortune-engine.ts` 내 각 `generate*` 함수
- 한국어 응답 톤: 단정적 표현(`~입니다`) 사용, `~할 수 있습니다` 금지
- GPT 응답은 항상 Zod 스키마로 파싱하여 타입 안전성 확보

### 텔레그램 봇 웹훅 등록

```
https://api.telegram.org/bot{TOKEN}/setWebhook?url={APP_URL}/api/telegram/webhook
```

---

## 주의 사항

- **`drizzle-kit push` 절대 사용 금지** — 프로덕션 테이블을 DROP/CREATE하여 데이터 유실
- `shared/` 코드는 서버·클라이언트 공용 — `fs`, `crypto` 등 Node.js 전용 API 사용 불가
- 신살 감지 로직 수정 시 `DYNAMIC_ONLY_BRANCH_SALS` 목록과 gender 필터 반드시 확인
- 가디언 리포트 재생성 → 연간 운세 연쇄 재생성 → OpenAI API 2회 호출 발생
- 오늘의 운세는 유저당 하루 1회만 생성 (`getTodayFortuneByUserId`로 중복 체크)
- 어드민 토큰은 서버 메모리에만 저장 (`Set<string>`) — 서버 재시작 시 초기화됨
- `getZodiacSign` / `getZodiacInfo`는 `shared/schema.ts`에 있음 (별도 파일 아님)

# CLAUDE.md — K-fortune Project Rules

## Project Overview
K-fortune: 사주팔자/자미두수/별자리 기반 AI 운세 앱
Owner: Ricky / Random Universe (rndmunvs.com)
Stack: React + Express + PostgreSQL (Drizzle ORM) + Railway

## Workflow Orchestration

### 1. Plan First
- 3단계 이상 작업은 반드시 계획 먼저 작성
- 계획 확인 후 구현 시작
- 진행 중 방향이 틀리면 즉시 멈추고 재계획

### 2. Verification Before Done
- 작업 완료 전 반드시 작동 확인
- "완료했다" 선언 전 테스트 필수
- PR 전 lint/type 체크

### 3. Self-Improvement Loop
- Ricky 피드백 후 즉시 교훈 기록
- 같은 실수 반복 금지
- 세션 시작 시 이전 교훈 확인

### 4. Autonomous Bug Fixing
- 버그 리포트 받으면 즉시 수정
- 손잡아 달라는 요청 없이 해결
- 로그/에러 확인 후 근본 원인 수정

### 5. Minimal Impact
- 변경은 필요한 부분만
- 불필요한 코드 추가 금지
- 임시방편 금지 — 근본 해결만

## Project Structure
- Frontend: React + TypeScript (Vite)
- Backend: Express + TypeScript (ESM)
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI GPT-4o
- Messaging: Telegram Bot API
- Deploy: Railway
- Repo: github.com/randomuniverse/K-fortune

## Communication Rules
- 한국어로 소통
- 드라이하고 핵심만
- 과도한 설명 금지
- 완료 시 한 줄 요약만

## Git Rules
- 커밋 메시지: 한국어 or 영어 간결하게
- 작업 완료 후 자동 push
- main 브랜치 직접 push 금지
```

---

**저장 방법:**

Claude Code에서 K-fortune 폴더 열고 입력창에:
```
루트 폴더에 CLAUDE.md 파일 만들고 내가 붙여넣는 내용 저장해줘

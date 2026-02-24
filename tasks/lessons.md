# Claude가 학습한 교훈

## 2026-02-24 - AI 모델 토큰 한도
**상황**: 연간 운세 생성 시 Claude 응답이 중간에 잘림
**실수**: max_tokens를 8000으로 설정했으나, 3체계×12개월 JSON은 13,000+ 토큰 필요
**규칙**: 대량 JSON 응답이 필요한 API 호출은 예상 출력 크기의 1.5배 이상으로 max_tokens 설정. stop_reason 로그를 반드시 확인하여 truncation 여부 모니터링.

## 2026-02-24 - 드리즐 마이그레이션
**상황**: 스키마 변경 시 마이그레이션 방식 혼동
**실수**: drizzle-kit push 사용 시도
**규칙**: 절대 `drizzle-kit push` 사용 금지. 항상 `npx drizzle-kit generate`로 마이그레이션 파일 생성 후 서버 시작 시 자동 적용.

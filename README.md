# AIdaily2 — Cloudflare AI Daily Briefing

Cloudflare Workers + D1 기반의 한국어 AI 데일리 브리핑 플랫폼입니다. 기존 AIdaily의 콘텐츠 영역과 Milo 음성 명령 경험을 참고해 Cloudflare에 맞게 새로 구현합니다.

## 현재 개발 모드
- 로그인은 의도적으로 보류했습니다.
- 전체 관리자 기능은 비로그인 프리뷰용입니다. 공개 운영 전 반드시 인증/권한 검증을 추가하세요.
- Gemini API는 Worker secret `GEMINI_API_KEY`를 사용합니다.
- 이미지 검색은 Unsplash API secret `UNSPLASH_ACCESS_KEY`가 있으면 주제별 검색을 사용합니다. 없으면 Unsplash 이미지 URL 기반 기본 이미지를 사용합니다.

## Cloudflare 준비
1. D1 데이터베이스 `aidaily2-db` 생성
2. 생성된 database_id를 wrangler.toml의 REPLACE_WITH_YOUR_D1_DATABASE_ID에 입력
3. D1 Console에서 migrations/0001_initial.sql 실행 또는 `npx wrangler d1 migrations apply aidaily2-db --remote`
4. Worker secrets 등록:
   - `npx wrangler secret put GEMINI_API_KEY`
   - `npx wrangler secret put UNSPLASH_ACCESS_KEY` (선택)
5. GitHub 연결 배포 설정:
   - Build command: 비워두거나 `npm install`
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`

## 개발
`npm install` → `npx wrangler dev`

## 기능
- Google News RSS 기반 시사/경제/IT/과학/건강 피드
- Gemini 기반 기사별 브리핑 생성 및 D1 저장
- Unsplash 주제별 이미지 검색 및 출처 기록
- 자연어 명령 및 한국어 브라우저 음성 입력
- 예약 대기열: 예약 페이지 접속/포커스 시 기한이 지난 작업을 처리하는 클라이언트 트리거
- 공개 브리핑, 콘텐츠 보관, 분야별 뉴스 탐색

## 운영 주의
- 비로그인 프리뷰 모드에서는 누구나 발행/삭제 API에 접근할 수 있습니다. 이 주소를 공개 운영하지 마세요.
- 페이지에 접속하지 않는 동안 예약 시각이 지나도 실행되지 않습니다. 다음 페이지 방문/포커스 시 처리합니다.
- Gemini와 Unsplash API의 사용량 및 약관을 준수하세요.
- Unsplash API 검색 결과를 사용할 경우 제공되는 attribution 정보를 보존하세요.
- Google News RSS의 원문은 해당 언론사 소유이며, 브리핑은 원문 링크를 함께 표시합니다.

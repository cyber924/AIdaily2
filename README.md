# AIdaily2 — Cloudflare AI Daily Briefing

Cloudflare Workers + D1 기반의 한국어 AI 데일리 브리핑 플랫폼입니다. 기존 AIdaily의 콘텐츠 영역과 Milo 음성 명령 경험을 참고해 Cloudflare에 맞게 새로 구현합니다.

## 계정 및 권한
- 이메일/비밀번호 회원가입과 로그인을 제공합니다.
- 세션은 HttpOnly + Secure 쿠키로 관리하고 D1에는 세션 토큰의 SHA-256 해시만 저장합니다.
- 브리핑 생성, 수동 발행, 예약 발행/취소, 보관/수정은 로그인 사용자만 가능합니다.
- 공개 웹진은 발행된 콘텐츠만 로그인 없이 조회할 수 있습니다.
- 최초 배포 전 `migrations/0002_auth.sql`을 반드시 원격 D1에 적용하세요.
- Gemini API는 Worker secret `GEMINI_API_KEY`를 사용합니다.
- 이미지 검색은 Unsplash API secret `UNSPLASH_ACCESS_KEY`가 있으면 주제별 검색을 사용합니다. 없으면 Unsplash 이미지 URL 기반 기본 이미지를 사용합니다.

## Cloudflare 준비
1. D1 데이터베이스 `aidaily2-db` 생성
2. `wrangler.toml`의 D1 database_id가 Cloudflare의 `aidaily2-db` 실제 ID와 일치하는지 확인
3. D1 Console에서 migrations/0001_initial.sql 실행 또는 `npx wrangler d1 migrations apply aidaily2-db --remote`
4. D1 Console에서 `migrations/0002_auth.sql` 실행 (users/sessions 인증 테이블)
5. Worker secrets 등록:
   - `npx wrangler secret put GEMINI_API_KEY`
   - `npx wrangler secret put UNSPLASH_ACCESS_KEY` (선택)
6. GitHub 연결 배포 설정:
   - Build command: 비워두거나 `npm install`
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`

## 개발
`npm install` → `npx wrangler dev`

## 기능
- Google News RSS 기반 10개 분야 뉴스 피드 (시사·정치·사회·경제·금융·산업·IT·과학·라이프·문화)
- Gemini 기반 기사별 브리핑 생성 및 D1 저장
- Unsplash 주제별 이미지 검색 및 출처 기록
- 자연어 명령 및 한국어 브라우저 음성 입력
- 예약 대기열: 예약 페이지 접속/포커스 시 기한이 지난 작업을 처리하는 클라이언트 트리거
- 공개 브리핑, 콘텐츠 보관, 분야별 뉴스 탐색

## 운영 주의
- 로그인 쿠키는 동일 출처 HTTPS에서만 전송됩니다. 실제 운영 전 계정 생성·로그인·로그아웃 및 권한 거부를 테스트하세요.
- 페이지에 접속하지 않는 동안 예약 시각이 지나도 실행되지 않습니다. 다음 페이지 방문/포커스 시 처리합니다.
- Gemini와 Unsplash API의 사용량 및 약관을 준수하세요.
- Unsplash API 검색 결과를 사용할 경우 제공되는 attribution 정보를 보존하세요.
- Google News RSS의 원문은 해당 언론사 소유이며, 브리핑은 원문 링크를 함께 표시합니다.

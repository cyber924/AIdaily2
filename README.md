# AIdaily2 — Cloudflare AI Daily Briefing

Cloudflare Workers + D1 기반 한국어 AI 데일리 브리핑 플랫폼입니다.

## 핵심 기능
- Google News RSS 기반 분야별 뉴스 및 Gemini 브리핑
- 이메일/비밀번호 로그인, HttpOnly 세션 쿠키
- 예약 발행 및 보관함
- 개인별 AI 데일리 콘텐츠: 운세, 식단, 운동, 음악, 역사, O/X 퀴즈, 쇼핑, 라이프 추천, 날씨 준비 브리핑
- 개인 프로필 및 선호 정보 저장
- 퀴즈 답변 기록 저장

## Cloudflare 배포
1. Cloudflare D1 데이터베이스 `aidaily2-db`가 `wrangler.toml`의 ID와 일치하는지 확인합니다.
2. 기존 운영 DB의 마이그레이션 이력을 먼저 확인합니다. 0001/0002를 D1 Console에서 수동 실행한 기존 DB라면 전체 migration을 다시 적용하지 마세요. D1 Console에서 `migrations/0003_daily_life.sql`만 1회 실행하거나, Wrangler migration history가 정상적으로 관리되는 환경에서 미적용 migration만 적용합니다.
3. Worker secrets:
   - `npx wrangler secret put GEMINI_API_KEY`
   - `npx wrangler secret put UNSPLASH_ACCESS_KEY` (선택)
4. `npx wrangler deploy`
5. 배포 후 `/api/health`와 로그인, 콘텐츠 생성, 새로고침 후 데이터 조회를 테스트합니다.

## 신규 마이그레이션 0003
`0003_daily_life.sql`은 기존 articles와 publish_queue에 소유자 컬럼을 추가하고 user_profiles, daily_contents, quiz_attempts 테이블을 만듭니다. 기존 콘텐츠 행은 삭제하지 않습니다. 운영 DB 적용 전 D1 백업을 권장합니다.

## 개인 콘텐츠 API
- `GET /api/profile`, `PUT /api/profile`
- `GET /api/daily`, `GET /api/daily?type=exercise`
- `POST /api/daily` body: `{"type":"exercise","preferences":"집에서 하는 초보자 운동"}`
- `POST /api/quiz/answer` body: `{"contentId":"...","answer":"O"}`

개인 콘텐츠 API는 로그인 세션을 요구하며, 생성 결과는 사용자 ID와 콘텐츠 유형 및 한국 시간대 날짜 기준으로 하루 한 건 저장합니다. 같은 날 재요청하면 저장된 결과를 재사용합니다.

## 중요 운영 참고
- Gemini와 Unsplash 사용량은 해당 계정의 과금·할당량 정책을 따릅니다.
- 날씨는 Open-Meteo 무료 예보 API와 지오코딩을 사용합니다. 날씨 분야는 Gemini를 호출하지 않고 실제 예보 데이터를 D1에 캐시합니다.
- 음악/쇼핑/장소 추천은 검색 전 실제 이용 가능 여부나 가격·재고를 확정하지 않습니다.
- 현재 예약 발행은 사용자의 예약 관리 요청 또는 페이지 방문 시 처리하는 방식입니다. 상시 자동 실행이 필요하면 Cloudflare Cron Trigger를 별도로 활성화하고 scheduled handler를 추가해야 합니다.

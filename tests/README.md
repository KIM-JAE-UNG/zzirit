# 찌릿 점검 (tests)

앱을 고칠 때마다 아래 한 줄로 전부 확인합니다. 하나라도 실패하면 배포하지 않습니다.

```
bash tests/run-all.sh
```

| 점검 | 파일 | 하는 일 |
| --- | --- | --- |
| 서버 규칙 | `db/rules.test.mjs` | 마이그레이션을 PGlite(브라우저용 Postgres)에 올려 결제 확인, 주문 제한, 초기화, AI 검토, 계정 삭제, 아이디 로그인 규칙을 확인 |
| 지금 서버 | `db/before-reset.test.mjs` | 0001–0007b까지만 올린 지금 서버 상태에서 아이디·복구 코드·포인트가 동작하는지 확인 |
| 폰 알림 서버 | `db/push.test.mjs` | 0010을 지금 서버 상태 위에 올려 구독, 실제 일어난 일인지 확인, 한 번만 보내기, 보내는 사람 제한, Vault 키, 권한을 확인 |
| 폰 알림 암호화 | `push/webpush.test.mjs` | RFC 8291 예제를 바이트 하나까지 똑같이 재현하고 VAPID 서명을 공개 키로 검증 |
| 웹사이트 | `web/run.js` | 가짜 Supabase(`web/server.js`)로 index.html을 실제 브라우저(Playwright)에서 돌려 가입·스캔·등록·게시판·팀·결제·아이디·공지·조과 카드 등을 확인 |
| Claude 페이지 | `claude/run.js` | 가짜 Claude 런타임(`claude/mock.js`)으로 artifact.html을 확인 |
| 폰 조과 등록 | `web/phone-scan.js` | 아이폰 크기·터치로 사진 → "맞나요?" → 길이 → 등록을 손가락으로 누르듯 진행. 등록 중 가입, 등록 중 아이디 로그인(새로 고침 후 이어서), 로그인한 폰에서 다음 물고기까지. 버튼이 화면 안에 있고 다른 것에 가려지지 않는지도 확인 (새 가짜 서버에서 실행) |

- 필요한 것: Node 18+, Python 3, Playwright + Chromium. 처음 실행하면 `npm install`로 PGlite·Leaflet·QR 라이브러리를 받습니다.
- 화면 사진과 결과는 `tests/out/`에 남습니다 (저장소에는 올리지 않음).
- `web/phone.js home:-:01_home rank:-:02_rank`처럼 실행하면 휴대폰 크기 화면 사진을 찍습니다 (웹 점검 서버가 켜져 있어야 함: `node web/server.js`).
- `fixtures/`의 사진은 테스트용으로 만든 그림입니다.
- 새 기능을 넣으면 같은 파일에 확인 항목을 추가합니다. 서버 규칙을 바꾸면 `db/rules.test.mjs`에, 화면 기능은 `web/run.js`에 추가합니다.

# 찌릿 점검 (tests)

앱을 고칠 때마다 아래 한 줄로 전부 확인합니다. 하나라도 실패하면 배포하지 않습니다.

```
bash tests/run-all.sh
```

| 점검 | 파일 | 하는 일 |
| --- | --- | --- |
| 서버 규칙 | `db/rules.test.mjs` | 마이그레이션을 PGlite(브라우저용 Postgres)에 올려 결제 확인, 주문 제한, 초기화, AI 검토, 계정 삭제, 아이디 로그인 규칙을 확인 |
| 웹사이트 | `web/run.js` | 가짜 Supabase(`web/server.js`)로 index.html을 실제 브라우저(Playwright)에서 돌려 가입·스캔·등록·게시판·팀·결제·아이디·공지·조과 카드 등을 확인 |
| Claude 페이지 | `claude/run.js` | 가짜 Claude 런타임(`claude/mock.js`)으로 artifact.html을 확인 |

- 필요한 것: Node 18+, Python 3, Playwright + Chromium. 처음 실행하면 `npm install`로 PGlite·Leaflet·QR 라이브러리를 받습니다.
- 화면 사진과 결과는 `tests/out/`에 남습니다 (저장소에는 올리지 않음).
- `web/phone.js home:-:01_home rank:-:02_rank`처럼 실행하면 휴대폰 크기 화면 사진을 찍습니다 (웹 점검 서버가 켜져 있어야 함: `node web/server.js`).
- `fixtures/`의 사진은 테스트용으로 만든 그림입니다.
- 새 기능을 넣으면 같은 파일에 확인 항목을 추가합니다. 서버 규칙을 바꾸면 `db/rules.test.mjs`에, 화면 기능은 `web/run.js`에 추가합니다.

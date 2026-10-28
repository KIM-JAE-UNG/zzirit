# 찌릿 ZZIRIT

사진 한 장으로 어종을 찾고, 전 세계 낚시꾼과 겨루는 낚시 리그.

- 웹사이트: https://kim-jae-ung.github.io/zzirit/
- 문의: 카카오톡 (앱의 고객센터 화면)

## 기능

- AI 어종 판별, "이 물고기가 맞나요?" 확인, 틀리면 학습시키기
- 독 있는 어종 표시, 금어기·금지체장 경고, 오늘의 물때
- 위성 지도: 바다 이름, 월·계절별 어종 확률, 이용자 조과가 쌓일수록 정확해짐
- 랭킹: 한국 · 동아시아 · 전 세계 · 친구
- 친구: 닉네임·친구 코드로 신청, 수락·거절, 서로의 바다 구경
- 나의 바다 꾸미기, 과거 조과 등록(1인 5회 무료, AI 검열 필수)
- 후원·유료 아이템: 카카오페이 송금코드(버튼 + PC용 QR), 관리자 승인. 계좌번호는 공개하지 않음

## 구조

```
index.html        웹 버전 (GitHub Pages). build.py가 만듦
artifact.html     Claude 아티팩트 버전. build.py가 만듦
src/              앱 소스 (화면, 지도, 어종 도감, 다국어 문구)
  rt-supabase.js  웹 버전에서 Supabase를 앱 저장소로 연결
geo/              위성사진·해안선·도시 데이터
supabase/
  migrations/     DB 표, 접근 규칙, 점수·AI 검사 서버 확인
  functions/ai/   Claude API를 부르는 서버 함수 (API 키는 여기에만)
```

## 빌드

```
python3 build.py
```

앱 이름은 `build.py`의 `BRAND` 한 곳만 바꾸면 전체가 바뀝니다.

## 서버 (Supabase)

- 방문자는 가입 없이 익명 계정으로 바로 참여합니다 (Authentication → Providers → Anonymous sign-ins).
- 각자 자기 기록만 고칠 수 있고, 점수와 AI 검사 결과는 서버가 다시 확인합니다.
- 정확한 낚시 위치는 본인만 보고, 공개 데이터에는 약 25 km 격자만 남습니다.
- AI 사진 판별은 Edge Function `ai`가 Claude API로 처리합니다. 키는 Supabase의 Edge Function Secrets에 `ANTHROPIC_API_KEY`로 넣습니다.
- AI 사용량은 하루 1인 사진 30회, 앱 전체 사진 1,000회로 제한됩니다.

## 관리자

사이트 주소 뒤에 `#claim`을 붙여 열고 관리자 코드를 넣으면 그 브라우저가 관리자로 등록됩니다.

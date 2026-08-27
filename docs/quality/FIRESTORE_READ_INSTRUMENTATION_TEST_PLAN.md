# Firestore 읽기 계측 QA 계획

작성일: 2026-08-13  
브랜치: main  
관련 계획: docs/FIRESTORE_READ_INSTRUMENTATION_PLAN.md

## Affected Pages/Routes

- 모든 인증 경로 — 앱 초기화 시 client.master.active와 client.master.snapshots가 각각 한 번 집계되는지 확인한다.
- /me/collection — 도감 로드 시 legacy slots 문서 수와 슬롯별 recovery logs 호출 수를 확인한다.
- /play/:slotId — 도감 모달을 열었을 때 같은 도감 계측 계약이 유지되는지 확인한다.
- /home 등 전역 알림이 활성화된 경로 — 최초 진입과 window focus 때 server.notification.status.* 로그를 확인한다.
- /me/settings — slotId를 포함한 상태 조회에서 server.notification.status.current.slot이 추가되는지 확인한다.
- /play/:slotId — 저장 성공 뒤 server.notification.evaluate.slot.* 중 실제 분기의 read만 기록되는지 확인한다.

## Key Interactions to Verify

- 로그인 직후 window.__DIGIMON_RUNTIME_METRICS__.firestoreReads를 확인한다.
- 명시적 summary 함수가 console.table을 한 번 출력하고 동일한 summary 배열을 반환하는지 확인한다.
- 도감을 두 번 열면 같은 operation의 calls/documents에 누적되고 새 operation key가 생기지 않는지 확인한다.
- 로그아웃 또는 계정 전환 후 기존 aggregate가 즉시 사라지는지 확인한다.
- 느린 read가 진행 중일 때 계정을 바꾼 뒤 이전 read 결과가 새 session에 집계되지 않는지 확인한다.
- Vercel preview 로그에서 한 줄 JSON을 operation 필드로 검색할 수 있는지 확인한다.

## Edge Cases

- 존재하지 않는 document는 documents=0으로 집계한다.
- 빈 query는 documents=0으로 집계하되 billed reads와 동일하다고 표현하지 않는다.
- QuerySnapshot metadata가 없으면 fromCache=unknown을 사용한다.
- read 오류는 errors를 증가시키고 동일한 오류 객체를 기존 호출자에게 전달한다.
- metric clock, normalizer, store, console, server logger가 실패해도 원래 동작은 유지한다.
- operation key가 50개를 넘으면 client.other 외의 새 key가 생성되지 않는다.
- invalid operation, UID, path, token, 이메일, payload, 오류 메시지가 aggregate와 JSON 로그에 없어야 한다.
- notification status의 개별 read 실패는 기존 빈 배열/null fallback을 유지한다.
- urgent evaluate의 disabled, missing_slot, not_eligible, stored, clear, reused, created 분기마다 실행된 read 수가 달라지는지 확인한다.

## Critical Paths

1. 로그인 → master read 2개 성공 → 기존 화면 상태 정상 → client summary 확인.
2. /me/collection 진입 → slots N개 → recovery calls=2N → 도감 결과가 변경 전과 동일.
3. 알림 상태 API → 일부 collection read 실패 → 200 fallback 유지 → 해당 operation은 outcome=error.
4. 게임 저장 → urgent evaluate → early return 또는 알림 생성 → 기존 응답·쓰기 동작 동일 → read JSON 로그 확인.
5. 계정 A read 지연 → 계정 B 전환 → A 완료 → B aggregate 오염 없음.

## Commands

    npm --prefix digimon-tamagotchi-frontend test -- --watchAll=false --runInBand src/utils/runtimeMetrics.test.js src/contexts/MasterDataContext.test.jsx src/hooks/useEncyclopedia.test.js
    node --test digimon-tamagotchi-frontend/api/_lib/firestoreReadMetrics.test.js tests/api/userNotifications.test.js tests/api/urgentCareNotifications.test.js
    npm run check
    git diff --check

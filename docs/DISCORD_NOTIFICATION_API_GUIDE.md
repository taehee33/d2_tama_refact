# Discord 상태 리포트 API 가이드

Google Apps Script가 Firestore를 직접 조회하던 방식은 현재 Firestore Rules에서 `PERMISSION_DENIED`가 발생합니다.  
이제는 **Apps Script -> Vercel API -> Firestore Admin** 흐름으로 상태 리포트를 받아 Discord로 전송하는 방식을 사용합니다.

---

## 1. 구조

1. Apps Script 시간 기반 트리거가 실행됩니다.
2. Apps Script가 `POST /api/notifications/daily-digimon-report`를 호출합니다.
3. Vercel API가 서비스 계정으로 Firestore `users/{uid}`, `users/{uid}/settings/main`, `users/{uid}/profile/main`, `users/{uid}/slots`를 읽어 사용자별 리포트를 생성합니다.
4. Apps Script는 응답의 `reports` 배열을 순회하며 각 `webhookUrl`로 Discord 메시지를 전송합니다.

이 구조에서는 Firestore 보안 규칙을 완화할 필요가 없습니다.

---

## 2. Vercel 환경변수

Vercel 프로젝트에 아래 환경변수를 추가합니다.

| 이름 | 설명 |
|------|------|
| `NOTIFICATION_API_SECRET` | Apps Script와 공유할 비밀키 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` 또는 `FIREBASE_SERVICE_ACCOUNT_PATH` | Firestore Admin 접근용 서비스 계정 |

서비스 계정은 기존 서버 API가 쓰는 방식과 동일합니다.

---

## 3. API 요청 계약

### 요청

- 메서드: `POST`
- 경로: `/api/notifications/daily-digimon-report`
- 헤더: `x-d2-scheduler-secret: {NOTIFICATION_API_SECRET}`

### 성공 응답 예시

```json
{
  "ok": true,
  "generatedAt": "2026-04-08 14:00:00",
  "summary": {
    "totalUsers": 10,
    "activeNotificationUsers": 3,
    "reportCount": 2,
    "skippedUsers": 8,
    "totalSlots": 7,
    "skippedUsersByReason": {
      "invalidUser": 0,
      "notificationDisabled": 5,
      "missingWebhook": 2,
      "noSlots": 1
    }
  },
  "reports": [
    {
      "uid": "abc123",
      "tamerName": "테이머 한솔",
      "webhookUrl": "https://discord.com/api/webhooks/...",
      "messageContent": "━━━━━━━━━━━━━━━━━━\n..."
    }
  ]
}
```

### 실패 응답

- `401`: 비밀키 누락 또는 불일치
- `405`: `POST` 외 요청
- `500`: 서비스 계정 또는 서버 환경변수 설정 문제

---

## 4. Apps Script 설정

Script Properties에 아래 값을 저장합니다.

| 키 | 설명 |
|----|------|
| `DIGIMON_NOTIFICATION_API_URL` | 배포된 Vercel API URL |
| `NOTIFICATION_API_SECRET` | Vercel의 `NOTIFICATION_API_SECRET`와 같은 값 |

예:

- `DIGIMON_NOTIFICATION_API_URL`: `https://your-domain.vercel.app/api/notifications/daily-digimon-report`
- `NOTIFICATION_API_SECRET`: 임의의 긴 랜덤 문자열

---

## 5. Apps Script 예시

```javascript
const API_URL = PropertiesService.getScriptProperties().getProperty("DIGIMON_NOTIFICATION_API_URL");
const API_SECRET = PropertiesService.getScriptProperties().getProperty("NOTIFICATION_API_SECRET");

function notifyPersonalizedCalls() {
  const response = UrlFetchApp.fetch(API_URL, {
    method: "post",
    headers: {
      "x-d2-scheduler-secret": API_SECRET,
    },
    muteHttpExceptions: true,
  });

  const responseCode = response.getResponseCode();
  const payload = JSON.parse(response.getContentText() || "{}");

  if (responseCode !== 200 || payload.ok !== true) {
    Logger.log(`❌ 상태 리포트 API 실패 (${responseCode}): ${response.getContentText()}`);
    return;
  }

  const reports = Array.isArray(payload.reports) ? payload.reports : [];
  if (reports.length === 0) {
    Logger.log(`📝 전송할 Discord 리포트가 없습니다. generatedAt=${payload.generatedAt || "unknown"}`);
    return;
  }

  reports.forEach((report) => {
    UrlFetchApp.fetch(report.webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        content: report.messageContent,
        username: "디지몬 파수꾼",
      }),
      muteHttpExceptions: true,
    });

    Logger.log(`🚀 ${report.tamerName} Discord 전송 완료`);
  });
}
```

---

## 6. 사용자 데이터 읽기 규칙

API는 아래 규칙으로 리포트를 생성합니다.

- 알림 설정: `users/{uid}/settings/main` 우선, 없으면 루트 `users/{uid}` fallback
- 테이머명: `users/{uid}/profile/main.tamerName` 우선, 없으면 루트 `tamerName`, 그래도 없으면 `displayName`
- 슬롯 제외: `isFrozen === true` 또는 `isRefrigerated === true`
- 디지몬 표시명: `digimonDisplayName` -> `digimonNickname(selectedDigimon)` -> `selectedDigimon` -> `"디지몬"`
- 상태이상:
  - `digimonStats.fullness === 0`
  - `digimonStats.strength === 0`
  - `digimonStats.callStatus.sleep.isActive === true && isLightsOn !== false`
  - `digimonStats.callStatus.hunger.isLogged === true`
  - `digimonStats.callStatus.strength.isLogged === true`
  - `digimonStats.isJogressReady === true`

---

## 7. 운영 체크리스트

- Vercel 환경변수 저장 후 재배포
- Apps Script Script Properties 저장
- 수동 실행으로 `summary.reportCount`와 Discord 전송 로그 확인
- Firestore Rules는 변경하지 않음

---

## 8. 10분 긴급 케어 알림

긴급 알림은 Google Sheet를 사용하지 않는다. Apps Script는 10분 스케줄 실행과 ack만 담당하고, 계산·Discord/Web Push 전송·중복 방지는 Vercel API와 Firestore 서버 전용 문서가 담당한다.

### API

- 준비: `POST /api/notifications/urgent-digimon-care/prepare`
- 확인: `POST /api/notifications/urgent-digimon-care/ack`
- 공통 헤더: `x-d2-scheduler-secret: {NOTIFICATION_API_SECRET}`

`prepare`는 슬롯 문서와 revision을 수정하지 않는다. 프론트와 동일한 lazy update를 메모리에서 수행하고 새 issue 또는 미확인 pending delivery를 반환한다. Discord/Web Push 전송은 서버가 처리하고, Apps Script는 반환된 `deliveryIds`를 `ack`해 같은 이슈가 반복 계산되지 않게 한다.

### 알림 대상 조회

- 알림 설정의 단일 원본은 `users/{uid}/settings/main`이다.
- 서버는 `settings.isNotificationEnabled == true` collection-group 인덱스로 활성 사용자만 조회한다.
- 사용자가 알림을 끄거나 켜면 Firestore 인덱스가 자동 갱신되어 다음 10분 실행부터 반영된다.
- 별도 구독자 문서나 Cloud Function은 사용하지 않는다.
- 구 루트 문서에만 설정이 남은 사용자는 배포 전 아래 순서로 보완한다.

```bash
npm run notification-subscribers:audit
npm run notification-subscribers:backfill
npm run notification-subscribers:audit
```

첫 audit에서 대상이 있을 때만 backfill을 실행하며, 마지막 audit의 `plannedWrites`는 0이어야 한다.

### Script Properties

| 키 | 설명 |
|----|------|
| `DIGIMON_URGENT_PREPARE_API_URL` | `https://도메인/api/notifications/urgent-digimon-care/prepare` |
| `DIGIMON_URGENT_ACK_API_URL` | `https://도메인/api/notifications/urgent-digimon-care/ack` |
| `NOTIFICATION_API_SECRET` | Vercel과 동일한 비밀키 |

Apps Script 편집기에 [`scripts/apps-script/urgentDigimonCare.gs`](../scripts/apps-script/urgentDigimonCare.gs)의 내용을 추가한다. 기존 일일 보고 함수와 트리거는 제거하지 않는다.

### 설치 및 검증 순서

1. `firestore.indexes.json`을 배포하고 인덱스가 준비됐는지 확인한다.
2. 구 설정 audit·필요 시 backfill·재-audit을 완료한다.
3. Vercel 환경변수 설정 후 배포한다.
4. Apps Script의 Script Properties 세 값을 저장한다.
5. `notifyUrgentDigimonCare()`를 수동 실행해 Discord 메시지가 1건만 전송되고 delivery가 ack되는지 확인한다.
6. 즉시 재실행해 동일 issue가 중복 전송되지 않는지 확인한다.
7. `installUrgentDigimonCareTrigger()`를 한 번 실행해 10분 트리거를 설치한다.
8. Apps Script 실행 기록에서 `preparedReports`, `failedReports`, `acknowledged`, `projectionUnavailable`을 확인한다.

기존 `dryRunUrgentDigimonCare()` 함수는 유지하지만 현재 운영 설치 절차에서는 사용하지 않는다.

webhook URL과 비밀키는 로그에 출력하지 않는다. Discord 전송 후 ack 호출만 실패하면 다음 cron에서 같은 delivery가 다시 확인 대상이 될 수 있다. Discord 직접 전송은 서버가 담당하므로 Apps Script에서 `report.messageContent`를 웹훅으로 다시 보내면 중복 알림이 발생한다.

### 계산 제외

- 냉장·냉동 슬롯
- `digimonStats.sleepSchedule`, `maxEnergy`, 배고픔·기력·배변 timer 또는 마지막 저장 시각이 없는 구 슬롯

구 슬롯은 값을 추측하지 않는다. 사용자가 앱에서 슬롯을 다시 열고 저장하면 현재 payload에 runtime 값이 채워져 이후 알림 계산 대상이 된다.

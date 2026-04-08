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

# Firestore 보안 규칙 설정 가이드

## 기준 파일

이 저장소의 Firestore 규칙 기준 파일은 루트의 [firestore.rules](./firestore.rules) 입니다.  
Firebase CLI를 사용하는 경우 루트의 [firebase.json](./firebase.json), [.firebaserc](./.firebaserc), [package.json](./package.json) 기준으로 다음 절차로 배포합니다.

```bash
npm install
npm run firebase:login
npm run firestore:deploy
```

## 이번 라운드에서 공식 관리하는 경계

이번 규칙 파일에서 명시적으로 보장하는 핵심 경계는 아래입니다.

- `users/{userId}`
- `users/{userId}/slots/{slotId}`
- `users/{userId}/slots/{slotId}/logs/{logId}`
- `users/{userId}/slots/{slotId}/battleLogs/{logId}`
- `nickname_index/{normalizedKey}`

즉, 슬롯 문서뿐 아니라 삭제/로드 때 실제로 접근하는 `logs`, `battleLogs` 서브컬렉션까지 같은 소유자 규칙으로 묶습니다.

## 현재 rules 파일 요약

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /slots/{slotId} {
        allow read, write: if isOwner(userId);

        match /logs/{logId} {
          allow read, write: if isOwner(userId);
        }

        match /battleLogs/{logId} {
          allow read, write: if isOwner(userId);
        }
      }
    }

    match /nickname_index/{normalizedKey} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() &&
        request.resource.data.uid == request.auth.uid &&
        request.resource.data.normalizedKey == normalizedKey;
      allow update: if isSignedIn() &&
        resource.data.uid == request.auth.uid &&
        request.resource.data.uid == request.auth.uid &&
        request.resource.data.normalizedKey == normalizedKey;
      allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
    }
  }
}
```

`nickname_index`는 각 닉네임 키를 문서 ID로 사용하므로, 기존 `metadata/nicknames`처럼 단일 문서에 배열을 몰아넣지 않습니다. 클라이언트는 읽기 시 아무 문서나 조회할 수 있지만, 쓰기/삭제는 `uid == request.auth.uid`인 자기 문서에만 허용됩니다.

## 공유 컬렉션에 대한 현재 처리

`jogress_rooms`, `jogress_logs`, `arena_entries`, `arena_battle_logs`, `game_settings`, `season_archives`는 아직 최종 보안 정책을 확정하지 않았습니다.

그래서 이번 rules 파일에서는 이 경계를 완전히 잠그지 않고, **기능 회귀를 막기 위한 임시 호환성 허용**을 함께 둡니다.

- 현재 정책: 인증 사용자면 접근 가능
- 목적: 조그레스, 아레나, 관리자 기능이 갑자기 막히지 않도록 유지
- 주의: 이 구간은 다음 라운드에서 컬렉션별 owner/host/admin 정책으로 다시 세분화해야 함

## 왜 이 변경이 필요한가

이번 버전에서는 슬롯 삭제 시 슬롯 문서만이 아니라 아래 서브컬렉션에도 접근합니다.

- `users/{uid}/slots/slot{n}/logs`
- `users/{uid}/slots/slot{n}/battleLogs`

기존 문서 예시처럼 `users/{uid}/slots/{slotId}`까지만 열어두면, 삭제 시 `Missing or insufficient permissions`가 발생할 수 있습니다.

## 적용 순서

1. 루트의 [firestore.rules](./firestore.rules) 내용을 확인합니다.
2. Firebase Console 또는 루트 npm script로 규칙을 배포합니다.
3. 로그인 후 `/play`에서 슬롯 생성/삭제를 다시 확인합니다.

## 빠른 점검 항목

- 새 디지몬 생성이 정상 동작하는가
- 디지몬 삭제 시 권한 오류가 사라졌는가
- 슬롯 재생성 후 예전 로그가 다시 섞이지 않는가
- 게스트 로그인과 Google 로그인 모두 슬롯 접근이 되는가

## 여전히 권한 오류가 나는 경우

1. 실제 Firebase 프로젝트에 최신 `firestore.rules`가 배포되었는지 확인
2. 로그인 상태인지 확인
3. 브라우저 하드 리프레시 후 재시도
4. 앱 레벨 fallback 덕분에 슬롯 삭제는 계속될 수 있으므로, 콘솔 경고와 실제 UI 결과를 함께 확인




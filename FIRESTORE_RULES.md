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
- 조그레스·아레나·실시간 아레나 서버 정본
- `jogress_logs`, legacy `arena_entries`, `arena_battle_logs`, `season_archives`
- `game_settings/{docId}`와 모든 하위 경로

사용자 문서와 슬롯 하위 경로는 소유자 규칙으로 묶습니다. 전역 정본과 설정은
클라이언트 쓰기를 허용하지 않고 인증된 서버 API·Admin SDK에서만 변경합니다.

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

- `jogress_rooms`와 보조 인덱스, Ghost V2·아레나 정본, 실시간 아레나 public·secret 문서는 서버만 읽고 쓸 수 있습니다. 실시간 public 문서는 두 참가자의 단건 조회만 예외입니다.
- `jogress_logs`, legacy `arena_entries`, `arena_battle_logs`, `arena_season_records`, `season_archives`는 로그인 사용자의 과거 데이터 읽기를 유지하고 클라이언트 쓰기는 차단합니다.
- `game_settings/{docId}`와 모든 하위 경로는 로그인 사용자가 읽을 수 있지만 클라이언트 쓰기는 운영자에게도 허용하지 않습니다.
- 마스터 데이터 저장·snapshot 복원은 `/api/operator/status?action=master-data-save|master-data-restore`가 `operator_roles/{uid}`를 확인한 뒤 Admin transaction으로 실행합니다.

Admin SDK는 Security Rules의 허용 주체가 아니라 Rules를 우회하는 서버 권한입니다. 따라서 Rules Emulator의
클라이언트 거부 행렬과 서버 transaction 성공 테스트를 분리해 검증합니다.

## 왜 이 변경이 필요한가

이번 버전에서는 슬롯 삭제 시 슬롯 문서만이 아니라 아래 서브컬렉션에도 접근합니다.

- `users/{uid}/slots/slot{n}/logs`
- `users/{uid}/slots/slot{n}/battleLogs`

기존 문서 예시처럼 `users/{uid}/slots/{slotId}`까지만 열어두면, 삭제 시 `Missing or insufficient permissions`가 발생할 수 있습니다.

반대로 전역 정본을 `isSignedIn()`만으로 쓰게 하면 익명 계정도 공유 데이터와 감사 이력을 변조할 수 있습니다.
따라서 사용자 소유 데이터는 Rules로 소유자를 검증하고, 전역 데이터는 서버 API에서 권한·입력·동시성·이력을 함께 확정합니다.

## 적용 순서

1. 루트의 [firestore.rules](./firestore.rules) 내용을 확인합니다.
2. 배포 전 `npm run test:firestore-emulator`과 `npm run test:arena-emulator`를 순서대로 실행합니다.
3. Firebase Console 또는 루트 npm script로 규칙을 배포합니다.
4. 로그인 후 `/play`에서 슬롯 생성/삭제와 운영자 패널의 마스터 저장·새로고침·snapshot 복원을 확인합니다.

## 빠른 점검 항목

- 새 디지몬 생성이 정상 동작하는가
- 디지몬 삭제 시 권한 오류가 사라졌는가
- 슬롯 재생성 후 예전 로그가 다시 섞이지 않는가
- 게스트 로그인과 Google 로그인 모두 슬롯 접근이 되는가
- 익명·일반·운영자 클라이언트의 전역 정본·`game_settings` 쓰기가 거부되는가
- 운영자 서버 API의 저장·복원이 active 문서와 snapshot을 원자적으로 변경하는가

## 여전히 권한 오류가 나는 경우

1. 실제 Firebase 프로젝트에 최신 `firestore.rules`가 배포되었는지 확인
2. 로그인 상태인지 확인
3. 브라우저 하드 리프레시 후 재시도
4. 앱 레벨 fallback 덕분에 슬롯 삭제는 계속될 수 있으므로, 콘솔 경고와 실제 UI 결과를 함께 확인


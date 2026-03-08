# 실시간 배틀 Firestore 규칙

Firebase Console → Firestore → 규칙에서 아래 내용을 기존 규칙에 **추가**하거나, `realtime_battle_rooms` 컬렉션에 적용하세요.

## 복합 인덱스

컬렉션 `realtime_battle_rooms`에 대해 다음 복합 인덱스가 필요합니다.

- 컬렉션 ID: `realtime_battle_rooms`
- 필드: `status` (오름차순), `createdAt` (내림차순)

### 수동으로 인덱스 만들기 (권장)

1. [Firebase Console](https://console.firebase.google.com) → 프로젝트 선택
2. 왼쪽 메뉴 **Firestore Database** → 상단 **인덱스** 탭
3. **복합 인덱스** 섹션에서 **인덱스 만들기** 클릭
4. 다음처럼 입력:
   - **컬렉션 ID**: `realtime_battle_rooms`
   - **필드 1**: `status` → 정렬 **오름차순**
   - **필드 2**: `createdAt` → 정렬 **내림차순**
5. **만들기** 클릭 후, 인덱스 상태가 "사용 설정됨"이 될 때까지 수 분 기다리기

(앱에서 대기 방 목록을 불러올 때 나오는 에러 메시지의 인덱스 링크를 눌러도 같은 인덱스가 생성됩니다.)

## 보안 규칙 예시

```
// realtime_battle_rooms: 누구나 읽기, 생성은 인증 유저, 수정은 호스트/게스트
match /realtime_battle_rooms/{roomId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.hostUid == request.auth.uid;
  allow update: if request.auth != null
    && (resource.data.hostUid == request.auth.uid || resource.data.guestUid == request.auth.uid);
  allow delete: if false;
}
```

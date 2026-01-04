# Firestore 인덱스 확인 및 생성 가이드

## 🔍 Firestore 복합 인덱스 확인 방법

### 1. 브라우저 콘솔에서 확인
- 배틀 로그를 로드할 때 콘솔에 다음과 같은 오류가 나타날 수 있습니다:
  ```
  The query requires an index. You can create it here: [링크]
  ```
- 이 링크를 클릭하면 Firestore 콘솔로 이동하여 인덱스를 생성할 수 있습니다.

### 2. Firebase 콘솔에서 직접 확인
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **"Firestore Database"** 클릭
4. 상단 탭에서 **"Indexes"** 클릭
5. 필요한 인덱스 목록 확인

### 3. 현재 필요한 인덱스

#### 배틀 로그 조회용 인덱스

**✅ 이미 생성된 인덱스:**
- **Collection**: `arena_battle_logs`
- **Fields**: `attackerId` (Ascending), `timestamp` (Descending)
- **Status**: 사용 설정됨 (Enabled)
- **Index ID**: `CICAgJim14AK`

**⚠️ 추가로 필요한 인덱스:**
- **Collection**: `arena_battle_logs`
- **Fields**:
  - `defenderId` (Ascending)
  - `timestamp` (Descending)
- **Query Scope**: Collection
- **이유**: 방어 기록 조회를 위해 필요합니다.

## 📝 인덱스 생성 방법

### 방법 1: 오류 메시지의 링크 사용 (가장 간단)
1. 브라우저 콘솔에서 오류 메시지 확인
2. 오류 메시지에 포함된 링크 클릭
3. Firebase 콘솔에서 "Create Index" 버튼 클릭
4. 인덱스 생성 완료 대기 (보통 1-2분 소요)

### 방법 2: Firebase 콘솔에서 수동 생성
1. Firebase Console → Firestore Database → Indexes
2. "Add Index" 버튼 클릭
3. Collection ID 입력: `arena_battle_logs`
4. Fields 추가:
   - Field: `attackerId`, Order: Ascending
   - Field: `timestamp`, Order: Descending
5. "Create" 버튼 클릭

### 방법 3: firestore.indexes.json 파일 사용 (고급)
프로젝트 루트에 `firestore.indexes.json` 파일을 생성하고 다음 내용 추가:

```json
{
  "indexes": [
    {
      "collectionGroup": "arena_battle_logs",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "attackerId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "arena_battle_logs",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "defenderId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

그 다음 Firebase CLI로 배포:
```bash
firebase deploy --only firestore:indexes
```

## ⚠️ 인덱스 생성 중 주의사항

1. **인덱스 생성 시간**: 보통 1-2분 소요되지만, 데이터가 많으면 더 오래 걸릴 수 있습니다.
2. **인덱스 상태 확인**: Indexes 탭에서 "Building" → "Enabled" 상태로 변경되는지 확인하세요.
3. **오류 발생 시**: 인덱스 생성 중에는 해당 쿼리를 실행할 수 없습니다.

## 🐛 문제 해결

### 인덱스가 생성되지 않는 경우
1. Firebase 프로젝트의 결제 계정이 활성화되어 있는지 확인
2. Firestore의 규칙이 올바르게 설정되어 있는지 확인
3. 브라우저 콘솔의 오류 메시지를 자세히 확인

### 인덱스가 생성되었는데도 오류가 발생하는 경우
1. 페이지를 새로고침하여 최신 인덱스 상태 확인
2. Firebase 콘솔에서 인덱스 상태가 "Enabled"인지 확인
3. 쿼리 조건이 인덱스와 정확히 일치하는지 확인


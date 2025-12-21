# Firebase 마이그레이션 가이드

## 📋 개요

이 프로젝트는 **Repository 패턴**을 사용하여 데이터 저장소를 추상화했습니다. 현재는 `localStorage`를 사용하지만, `Firestore`로 쉽게 전환할 수 있습니다.

## 🚀 1단계: Firebase 설치 (완료)

```bash
cd digimon-tamagotchi-frontend
npm install firebase
```

## 🔧 2단계: Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. **Firestore Database** 활성화
3. **Authentication** 활성화 (선택사항)
4. 프로젝트 설정에서 웹 앱 추가
5. Firebase 설정 정보 복사

## 📝 3단계: 환경변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
# Firebase 설정
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# 저장소 타입 선택
REACT_APP_STORAGE_TYPE=localStorage  # 또는 firestore
```

## 🔄 4단계: 기존 코드 마이그레이션

### Game.jsx 수정 예시

#### Before (localStorage 직접 사용)

```javascript
// src/pages/Game.jsx
useEffect(() => {
  if (!slotId) return;
  
  const savedName = localStorage.getItem(`slot${slotId}_selectedDigimon`) || "Digitama";
  const savedStatsStr = localStorage.getItem(`slot${slotId}_digimonStats`);
  
  if (savedStatsStr) {
    const parsed = JSON.parse(savedStatsStr);
    setSelectedDigimon(savedName);
    setDigimonStats(parsed);
  }
}, [slotId]);

// 저장
localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify(newStats));
localStorage.setItem(`slot${slotId}_selectedDigimon`, name);
```

#### After (Repository 패턴 사용)

```javascript
// src/pages/Game.jsx
import { slotRepository } from '../repositories/SlotRepository';

useEffect(() => {
  if (!slotId) return;
  
  const loadSlot = async () => {
    const slot = await slotRepository.getSlot(slotId);
    
    if (slot && Object.keys(slot.digimonStats).length > 0) {
      setSelectedDigimon(slot.selectedDigimon);
      setDigimonStats(slot.digimonStats);
    } else {
      const ns = initializeStats("Digitama", {}, digimonDataVer1);
      setSelectedDigimon("Digitama");
      setDigimonStats(ns);
    }
  };
  
  loadSlot();
}, [slotId]);

// 저장
function setDigimonStatsAndSave(newStats) {
  setDigimonStats(newStats);
  if (slotId) {
    slotRepository.saveDigimonStats(slotId, newStats);
  }
}

function setSelectedDigimonAndSave(name) {
  setSelectedDigimon(name);
  if (slotId) {
    slotRepository.saveSelectedDigimon(slotId, name);
  }
}
```

### SelectScreen.jsx 수정 예시

#### Before

```javascript
// src/pages/SelectScreen.jsx
const loadSlots = () => {
  const arr = [];
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const digimonName = localStorage.getItem(`slot${i}_selectedDigimon`);
    if (digimonName) {
      arr.push({
        id: i,
        slotName: localStorage.getItem(`slot${i}_slotName`) || `슬롯${i}`,
        selectedDigimon: digimonName,
        // ...
      });
    }
  }
  setSlots(arr);
};
```

#### After

```javascript
// src/pages/SelectScreen.jsx
import { slotRepository } from '../repositories/SlotRepository';

const loadSlots = async () => {
  const slots = await slotRepository.getAllSlots(MAX_SLOTS);
  setSlots(slots);
};

// 마운트 시
useEffect(() => {
  loadSlots();
}, []);
```

## 🔥 5단계: Firestore로 전환

1. `.env` 파일에서 `REACT_APP_STORAGE_TYPE=firestore` 설정
2. Firestore 보안 규칙 설정:

```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /slots/{slotId} {
      // 인증된 사용자만 자신의 슬롯에 접근 가능
      allow read, write: if request.auth != null 
        && request.auth.uid == resource.data.userId;
    }
  }
}
```

3. Firestore 컬렉션 구조:

```
slots/
  slot1/
    selectedDigimon: "Agumon"
    digimonStats: { ... }
    slotName: "내 디지몬"
    createdAt: "2024-01-01T00:00:00Z"
    device: "Digital Monster Color 25th"
    version: "Ver.1"
    userId: "user123"  // 인증 추가 시
    updatedAt: Timestamp
  slot2/
    ...
```

## 📊 데이터 구조

### Slot 데이터 구조

```typescript
interface Slot {
  id: number;                    // 슬롯 ID (1-10)
  selectedDigimon: string;        // 현재 디지몬 이름
  digimonStats: DigimonStats;     // 디지몬 스탯 객체
  slotName: string;              // 슬롯 이름
  createdAt: string;              // 생성일 (ISO string)
  device: string;                // 기종
  version: string;               // 버전 (Ver.1~5)
  updatedAt?: Date;              // 마지막 업데이트 (Firestore 전용)
  userId?: string;               // 사용자 ID (인증 추가 시)
}
```

## ✅ 체크리스트

- [x] Firebase npm 패키지 설치
- [x] `src/firebase.js` 파일 생성
- [x] `src/repositories/SlotRepository.js` 생성
- [ ] `.env` 파일에 Firebase 설정 추가
- [ ] Firebase 프로젝트 생성 및 Firestore 활성화
- [ ] `Game.jsx`에서 Repository 패턴 사용
- [ ] `SelectScreen.jsx`에서 Repository 패턴 사용
- [ ] Firestore 보안 규칙 설정
- [ ] 테스트 및 검증

## 🐛 문제 해결

### 환경변수가 로드되지 않는 경우

React에서 환경변수는 `REACT_APP_` 접두사가 필요합니다.
서버 재시작 후에도 반영되지 않으면 `.env` 파일 위치를 확인하세요.

### Firestore 권한 오류

Firestore 보안 규칙을 확인하고, 개발 중에는 다음 규칙을 사용할 수 있습니다:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // 개발용 (프로덕션에서는 제한 필요)
    }
  }
}
```

## 📚 추가 리소스

- [Firebase 공식 문서](https://firebase.google.com/docs)
- [Firestore 시작하기](https://firebase.google.com/docs/firestore)
- [Repository 패턴](https://martinfowler.com/eaaCatalog/repository.html)





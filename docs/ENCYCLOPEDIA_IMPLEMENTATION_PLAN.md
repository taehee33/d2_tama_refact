# 도감(Encyclopedia) 기능 구현 계획

## 📋 현재 개발 상태 분석

### 1. 기존 구조 확인

#### ✅ 이미 구현된 기능
- **ExtraMenuModal**: "도감(준비중)" 버튼 존재 (38번째 줄)
- **CollectionModal**: 컬렉션 메뉴 구조 존재 (배경화면 설정용)
- **진화 시스템**: `useEvolution.js`의 `evolve()` 함수로 진화 추적 가능
- **디지몬 데이터**: `digimonDataVer1` (v1/digimons.js)에 전체 디지몬 정보 저장
- **스탯 저장**: Firebase/localStorage에 `digimonStats` 저장 (`useGameData.js`)
- **스탯 표시**: `StatsPopup.jsx`에 상세 스탯 표시 로직 존재

#### ⚠️ 확인 필요 사항
- **버전별 분류**: 현재 `digimonDataVer1`만 존재 (Ver.2, Ver.3 등은 미구현으로 보임)
- **진화 시점 추적**: `useEvolution.js`의 `evolve()` 함수에서 도감 업데이트 로직 추가 필요
- **사망 시점 추적**: 사망 시에도 도감 업데이트 필요 (`useDeath.js` 확인 필요)

---

## 🎯 제안된 기능을 현재 코드베이스에 맞춰 수정

### 1. 데이터 구조 설계 (현재 저장 구조에 맞춰 수정)

#### 저장 위치
- **Firebase**: `/users/{uid}/slots/{slotId}/encyclopedia` (슬롯별 도감)
- **localStorage**: `slot{slotId}_encyclopedia` (슬롯별 도감)

#### 데이터 구조 (제안된 구조를 현재 구조에 맞춰 수정)

```javascript
// 슬롯별 도감 데이터
{
  "Ver.1": {  // 버전별 분류 (현재는 Ver.1만 존재)
    "Botamon": {
      "isDiscovered": true,       // 발견/육성 여부
      "firstDiscoveredAt": 1234567890,  // 처음 발견한 시간 (timestamp)
      "raisedCount": 3,           // 총 육성 횟수
      "bestStats": {              // 해당 종족 중 가장 잘 키운 기록
        "maxAge": 15,             // 최대 나이 (일)
        "maxWinRate": 85,         // 최고 승률 (%)
        "maxWeight": 25,          // 최대 체중
        "maxLifespan": 86400,     // 최대 생존 시간 (초)
        "totalBattles": 120,      // 총 배틀 횟수
        "totalBattlesWon": 100    // 총 승리 횟수
      },
      "lastRaisedAt": 1234567890, // 마지막 육성 시간
      "history": [                // 최근 육성 기록 5개만 유지 (용량 최적화)
        {
          "date": 1234567890,
          "result": "Evolved to Agumon",
          "finalStats": {
            "age": 3,
            "winRate": 85,
            "weight": 20,
            "lifespanSeconds": 259200
          }
        },
        {
          "date": 1234567891,
          "result": "Died of old age",
          "finalStats": {
            "age": 15,
            "winRate": 70,
            "weight": 25,
            "lifespanSeconds": 1296000
          }
        }
      ]
    },
    "Agumon": {
      "isDiscovered": false,  // 아직 키워보지 않음
      // 미발견 상태는 다른 필드 없음
    }
  }
}
```

#### ⚠️ 현재 코드베이스 고려사항
- **슬롯별 저장**: 이미 `slotId` 기반으로 저장하므로 슬롯별 도감 구현 용이
- **Firebase/localStorage 이중 지원**: `useGameData.js`의 패턴을 따라 구현
- **데이터 용량**: `history` 배열을 최대 5개로 제한하여 용량 최적화

---

### 2. 진화 시점 추적 (현재 코드에 맞춰 수정)

#### 현재 진화 처리 위치
- **파일**: `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- **함수**: `evolve(newName)` (153번째 줄)
- **호출 시점**: 진화 애니메이션 완료 후 (126번째 줄)

#### 도감 업데이트 로직 추가 위치

```javascript
// useEvolution.js의 evolve() 함수 내부 (192번째 줄 이후)
async function evolve(newName) {
  // ... 기존 진화 로직 ...
  
  const nxWithLogs = { ...nx, activityLogs: updatedLogs };
  await setDigimonStatsAndSave(nxWithLogs, updatedLogs);
  await setSelectedDigimonAndSave(newName);
  
  // ✅ 도감 업데이트 추가 (여기에 추가)
  await updateEncyclopedia(newName, nxWithLogs, 'evolution');
}
```

#### 도감 업데이트 함수 (새로 생성 필요)

```javascript
// hooks/useEncyclopedia.js (새 파일 생성)
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function updateEncyclopedia(
  digimonName,
  finalStats,
  eventType, // 'evolution' | 'death' | 'discovery'
  slotId,
  currentUser,
  mode
) {
  if (!slotId || !digimonName) return;
  
  // 버전 확인 (현재는 Ver.1만 존재)
  const version = "Ver.1"; // TODO: 추후 버전별 분류 로직 추가
  
  // 도감 데이터 로드
  const encyclopedia = await loadEncyclopedia(slotId, currentUser, mode);
  
  // 해당 디지몬 데이터 가져오기 또는 초기화
  if (!encyclopedia[version]) {
    encyclopedia[version] = {};
  }
  
  const digimonData = encyclopedia[version][digimonName] || {
    isDiscovered: false,
    raisedCount: 0,
    bestStats: {},
    history: []
  };
  
  // 발견 처리
  if (!digimonData.isDiscovered) {
    digimonData.isDiscovered = true;
    digimonData.firstDiscoveredAt = Date.now();
  }
  
  // 육성 횟수 증가
  digimonData.raisedCount = (digimonData.raisedCount || 0) + 1;
  digimonData.lastRaisedAt = Date.now();
  
  // 최고 기록 업데이트
  const currentStats = {
    maxAge: finalStats.age || 0,
    maxWinRate: finalStats.winRate || 0,
    maxWeight: finalStats.weight || 0,
    maxLifespan: finalStats.lifespanSeconds || 0,
    totalBattles: finalStats.totalBattles || 0,
    totalBattlesWon: finalStats.totalBattlesWon || 0
  };
  
  // bestStats 업데이트 (더 좋은 기록이면 갱신)
  if (!digimonData.bestStats.maxAge || currentStats.maxAge > digimonData.bestStats.maxAge) {
    digimonData.bestStats.maxAge = currentStats.maxAge;
  }
  if (!digimonData.bestStats.maxWinRate || currentStats.maxWinRate > digimonData.bestStats.maxWinRate) {
    digimonData.bestStats.maxWinRate = currentStats.maxWinRate;
  }
  // ... 다른 필드도 동일하게 처리 ...
  
  // 이력 추가 (최대 5개만 유지)
  const historyEntry = {
    date: Date.now(),
    result: eventType === 'evolution' 
      ? `Evolved to ${finalStats.evolutionStage || digimonName}`
      : eventType === 'death'
      ? `Died: ${finalStats.deathReason || 'Unknown'}`
      : 'Discovered',
    finalStats: {
      age: finalStats.age,
      winRate: finalStats.winRate,
      weight: finalStats.weight,
      lifespanSeconds: finalStats.lifespanSeconds
    }
  };
  
  digimonData.history = [historyEntry, ...digimonData.history].slice(0, 5);
  
  // 저장
  encyclopedia[version][digimonName] = digimonData;
  await saveEncyclopedia(encyclopedia, slotId, currentUser, mode);
}
```

---

### 3. UI/UX 구현 (제안된 이미지 기반)

#### 컴포넌트 구조
```
ExtraMenuModal
  └─> EncyclopediaModal (새로 생성)
       └─> VersionTabs (Ver.1, Ver.2, ...)
            └─> DigimonGrid (그리드 레이아웃)
                 └─> DigimonCard (개별 디지몬 카드)
                      └─> DigimonDetailModal (상세 정보 팝업)
```

#### 블러 처리 로직
```javascript
// DigimonCard.jsx
const isDiscovered = encyclopedia?.[version]?.[digimonName]?.isDiscovered || false;

<div className={`digimon-card ${!isDiscovered ? 'locked' : ''}`}>
  <img 
    src={spriteUrl} 
    alt={digimonName}
    className={!isDiscovered ? 'blurred' : ''}
    style={!isDiscovered ? {
      filter: 'blur(8px) grayscale(100%)',
      opacity: 0.5
    } : {}}
  />
  <div className="digimon-name">
    {isDiscovered ? digimonData.name : '???'}
  </div>
  {isDiscovered && (
    <div className="checkmark">✓</div>
  )}
</div>
```

#### CSS 스타일
```css
.digimon-card.locked {
  cursor: not-allowed;
  position: relative;
}

.digimon-card.locked::after {
  content: '🔒';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  z-index: 1;
}

.digimon-card .blurred {
  filter: blur(8px) grayscale(100%);
  opacity: 0.5;
}
```

---

### 4. 상세 정보 뷰 (StatsPopup 재활용)

#### DigimonDetailModal 구조
```javascript
// DigimonDetailModal.jsx
export default function DigimonDetailModal({
  digimonName,
  digimonData,
  encyclopediaData,
  onClose
}) {
  const discoveredData = encyclopediaData?.[digimonName];
  
  return (
    <div className="digimon-detail-modal">
      {/* 기본 정보 */}
      <div className="basic-info">
        <h2>{digimonData.name}</h2>
        <p>도감 번호: {digimonData.id}</p>
        <p>세대: {digimonData.stage}</p>
        <p>속성: {digimonData.stats.type}</p>
      </div>
      
      {/* 육성 이력 */}
      {discoveredData && (
        <div className="raising-history">
          <h3>육성 이력</h3>
          <p>처음 발견: {formatTimestamp(discoveredData.firstDiscoveredAt)}</p>
          <p>총 육성 횟수: {discoveredData.raisedCount}회</p>
          
          {/* 명예의 전당 (최고 기록) */}
          <div className="hall-of-fame">
            <h4>명예의 전당</h4>
            <ul>
              <li>최대 나이: {discoveredData.bestStats.maxAge}일</li>
              <li>최고 승률: {discoveredData.bestStats.maxWinRate}%</li>
              <li>최대 체중: {discoveredData.bestStats.maxWeight}GB</li>
              <li>최장 생존: {formatTime(discoveredData.bestStats.maxLifespan)}</li>
            </ul>
          </div>
          
          {/* 최근 육성 기록 */}
          <div className="recent-history">
            <h4>최근 육성 기록</h4>
            {discoveredData.history.map((entry, index) => (
              <div key={index} className="history-entry">
                <p>{formatTimestamp(entry.date)}</p>
                <p>{entry.result}</p>
                <p>나이: {entry.finalStats.age}일</p>
                <p>승률: {entry.finalStats.winRate}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 진화 트리 (선택 사항) */}
      <div className="evolution-tree">
        <h3>진화 트리</h3>
        {/* digimonData.evolutions 배열 사용 */}
      </div>
    </div>
  );
}
```

---

### 5. 구현 단계별 계획

#### 1단계: 데이터 구조 및 저장 로직
- [ ] `hooks/useEncyclopedia.js` 생성 (load/save 함수)
- [ ] `useGameData.js`에 도감 저장/로드 통합
- [ ] Firebase/localStorage 이중 지원

#### 2단계: 진화/사망 시점 추적
- [ ] `useEvolution.js`의 `evolve()` 함수에 도감 업데이트 추가
- [ ] `useDeath.js`에 사망 시 도감 업데이트 추가
- [ ] 디지몬 생성 시 발견 처리 (Digitama → Botamon 진화 시)

#### 3단계: UI 구현
- [ ] `EncyclopediaModal.jsx` 생성
- [ ] `DigimonGrid.jsx` 생성 (그리드 레이아웃)
- [ ] `DigimonCard.jsx` 생성 (개별 카드)
- [ ] 블러 처리 및 체크마크 표시

#### 4단계: 상세 정보 뷰
- [ ] `DigimonDetailModal.jsx` 생성
- [ ] StatsPopup 로직 재활용
- [ ] 육성 이력 및 명예의 전당 표시

#### 5단계: ExtraMenuModal 연결
- [ ] ExtraMenuModal의 "도감(준비중)" 버튼 활성화
- [ ] EncyclopediaModal 연결

---

### 6. 데이터 용량 최적화 전략

#### 현재 구조의 장점
- **슬롯별 분리**: 각 슬롯마다 독립적인 도감 데이터
- **요약 데이터만 저장**: 전체 로그가 아닌 최고 기록만 저장
- **이력 제한**: `history` 배열을 최대 5개로 제한

#### 예상 데이터 용량
- **디지몬당**: 약 500 bytes (JSON 압축 시)
- **Ver.1 전체 (약 50개 디지몬)**: 약 25 KB
- **5개 버전**: 약 125 KB (슬롯당)

#### 추가 최적화 방안
- **Lazy Loading**: 버전별 탭 전환 시에만 로드
- **압축**: JSON.stringify 후 압축 (선택 사항)
- **캐싱**: 메모리 캐시로 자주 접근하는 데이터 보관

---

### 7. 현재 코드베이스와의 통합 포인트

#### ✅ 재활용 가능한 코드
1. **StatsPopup.jsx**: 스탯 표시 로직 재활용
2. **useGameData.js**: 저장/로드 패턴 재활용
3. **digimonDataVer1**: 디지몬 목록 및 정보
4. **formatTimestamp**: 시간 포맷팅 유틸리티

#### ⚠️ 추가 작업 필요
1. **버전별 분류**: 현재 Ver.1만 존재하므로 버전 필터링 로직 추가 필요
2. **진화 트리 시각화**: `digimonData.evolutions` 배열 활용
3. **스프라이트 이미지**: 디지몬 스프라이트 렌더링 로직 확인 필요

---

### 8. 다음 단계

1. **데이터 구조 확정**: 위의 구조로 진행할지 검토
2. **진화 시점 추적**: `useEvolution.js` 수정
3. **UI 프로토타입**: 이미지 기반 그리드 레이아웃 구현
4. **테스트**: 진화 → 도감 업데이트 → UI 표시 플로우 테스트

---

## 📝 참고사항

- 현재는 **Ver.1**만 구현되어 있으므로, 초기 버전은 Ver.1만 지원
- 추후 Ver.2, Ver.3 등이 추가되면 버전별 탭으로 확장 가능
- 디지몬 데이터는 `digimonDataVer1`에서 가져오되, 버전 필드가 없으므로 수동으로 "Ver.1"로 분류
- 사망 시점도 도감 업데이트 필요 (`useDeath.js` 확인 필요)

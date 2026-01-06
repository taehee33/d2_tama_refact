# 배틀 로그 "Unknown Digimon" 원인 분석

## 현재 코드 동작 방식

### 배틀 로그에서 디지몬 이름 표시 로직

```javascript
// ArenaScreen.jsx (Line 1085-1105)
let myDigimonName = 'Unknown Digimon';
let mySlotId = null;

if (log.isAttack) {
  // 공격 기록: 내가 공격자
  const myAttackingDigimon = myEntries.find(entry => entry.id === log.myEntryId);
  if (myAttackingDigimon) {
    // 엔트리를 찾은 경우
    const digimonId = myAttackingDigimon?.digimonSnapshot?.digimonId || 
                      myAttackingDigimon?.digimonSnapshot?.digimonName;
    myDigimonName = digimonDataVer1[digimonId]?.name || 
                    myAttackingDigimon?.digimonSnapshot?.digimonName || 
                    'Unknown Digimon';
    mySlotId = myAttackingDigimon?.digimonSnapshot?.slotId || null;
  } else {
    // 엔트리를 찾지 못한 경우 (이전 코드)
    // myDigimonName = 'Unknown Digimon'; (기본값 유지)
  }
}
```

### myEntries 로드 방식

```javascript
// ArenaScreen.jsx (Line 186-210)
const loadMyEntries = async () => {
  const entriesRef = collection(db, 'arena_entries');
  const q = query(entriesRef, where('userId', '==', currentUser.uid));
  const querySnapshot = await getDocs(q);
  
  const entries = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  setMyEntries(entries);
};
```

## "Unknown Digimon"이 나타나는 이유

### 결론: **아레나에서 삭제된 경우**

1. **myEntries의 출처**:
   - `arena_entries` 컬렉션에서 현재 사용자의 엔트리만 로드
   - 아레나에 등록된 디지몬 목록

2. **배틀 로그에서 디지몬 찾기**:
   - `myEntries.find(entry => entry.id === log.myEntryId)`로 엔트리 검색
   - `log.myEntryId`는 배틀 당시의 아레나 엔트리 ID

3. **"Unknown Digimon" 표시 조건**:
   - `myEntries`에서 `log.myEntryId`와 일치하는 엔트리를 찾지 못할 때
   - 즉, **아레나에서 해당 엔트리가 삭제된 경우**

### 슬롯 삭제와의 관계

- **슬롯에서 디지몬 삭제**: 
  - 슬롯 데이터만 삭제됨
  - 아레나 엔트리는 별도로 관리되므로 남아있을 수 있음
  - 하지만 일반적으로 슬롯 삭제 시 아레나 엔트리도 함께 삭제하는 것이 일반적

- **아레나에서 엔트리 삭제**:
  - `arena_entries` 컬렉션에서 해당 문서 삭제
  - 슬롯의 디지몬은 그대로 남아있을 수 있음
  - 배틀 로그에서는 해당 엔트리를 찾을 수 없음

## 개선된 코드 (현재)

```javascript
if (myAttackingDigimon) {
  // 엔트리 존재: 정상 표시
  myDigimonName = digimonDataVer1[digimonId]?.name || ...;
} else {
  // 엔트리 삭제됨: 로그에서 정보 가져오기
  isDeleted = true;
  const digimonId = log.attackerDigimonName; // 배틀 로그에 저장된 정보 사용
  myDigimonName = digimonDataVer1[digimonId]?.name || digimonId || 'Unknown Digimon';
}
```

### 개선 효과

- **이전**: 아레나에서 삭제되면 "Unknown Digimon" 표시
- **현재**: 아레나에서 삭제되어도 배틀 로그에 저장된 디지몬 이름으로 표시
- **표시 형식**: `*삭제* 데블몬 (슬롯3) → *현재는 슬롯에서 삭제된 디지몬*`

## 결론

**"Unknown Digimon"이 나타나는 이유는 아레나에서 엔트리가 삭제된 경우입니다.**

- 슬롯에서 삭제된 경우는 직접적인 원인이 아닙니다
- 다만, 슬롯 삭제 시 아레나 엔트리도 함께 삭제하는 경우가 많아 간접적으로 관련될 수 있습니다
- 현재 개선된 코드는 배틀 로그에 저장된 정보를 활용하여 삭제된 경우에도 디지몬 이름을 표시합니다


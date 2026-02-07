# 활동 로그 vs 배틀 로그: 서브컬렉션 분리 분석

## 1. 현재 구조 요약

| 구분 | 활동 로그 (activityLogs) | 배틀 로그 (battleLogs) |
|------|---------------------------|------------------------|
| **개념** | 먹이/수면/훈련/진화 등 **전반 활동** 기록 | 스파링·아레나·퀘스트·건너뜀 등 **배틀만** 기록 |
| **저장 위치** | 서브컬렉션 `users/{uid}/slots/slot{N}/logs` (방안 A 적용됨) | 슬롯 문서 내부 `digimonStats.battleLogs` 배열 |
| **추가 방식** | `appendLogToSubcollection(logEntry)` → `addDoc(collection(slotRef, 'logs'), { type, text, timestamp })` | `setDigimonStatsAndSave({ ...stats, battleLogs: updatedBattleLogs })` → 슬롯 문서 전체 `updateDoc` |
| **로드 방식** | `loadSlot` 시 `getDocs(collection(slotRef, 'logs'), orderBy('timestamp','desc'), limit(100))` 후 `setActivityLogs` | 슬롯 문서 한 번에 로드 시 `digimonStats.battleLogs` 포함 |
| **최대 개수** | 100개 (서브컬렉션 쿼리 limit) | 100개 (appendBattleLog에서 slice 등으로 제한) |

즉, **활동 로그는 이미 서브컬렉션**, **배틀 로그는 아직 슬롯 문서 안 배열**로만 관리되고 있음.

---

## 2. 서브컬렉션을 “따로” 두는 것이 효율·직관에 좋은지

### 2.1 직관성 (일관된 모델)

- **활동 로그**와 **배틀 로그**는 이미 기능·UI가 완전히 분리되어 있음 (ActivityLogModal / BattleLogModal, 탭·필터도 각각 다름).
- 저장 구조만 보면, 활동 로그는 서브컬렉션, 배틀 로그는 문서 필드로 **방식이 다름**.
- 배틀 로그도 **별도 서브컬렉션**으로 두면:
  - “로그성 데이터는 모두 서브컬렉션”이라는 **하나의 규칙**으로 통일됨.
  - 새 개발자/유지보수 시 “어디에 뭐가 있는지” 예측하기 쉬움 (활동 → `logs`, 배틀 → `battleLogs` 서브컬렉션).

**정리**: 서브컬렉션을 **활동 / 배틀 각각 따로** 두는 쪽이 **직관적**임.

---

### 2.2 효율성

| 관점 | 활동 로그 (현재) | 배틀 로그 (현재) | 배틀 로그 서브컬렉션 전환 시 |
|------|------------------|-------------------|------------------------------|
| **슬롯 문서 크기** | 로그 제외됨 → 작게 유지 | `battleLogs` 배열(최대 100건)이 **문서 안에 포함** → 문서 비대 | `battleLogs` 제외 → 문서 다시 작아짐 |
| **저장 시 쓰기** | 로그 추가 시 `addDoc(logs)` 1회만 | 배틀 한 번 할 때마다 **전체 digimonStats** (배틀 로그 배열 포함) `updateDoc` → 문서 전체 쓰기 | 배틀 로그 추가 시 `addDoc(battleLogs)` 1회만 (활동 로그와 동일 패턴) |
| **로드 시 읽기** | 슬롯 1회 + `logs` 서브컬렉션 1회 | 슬롯 1회에 battleLogs 포함 | 슬롯 1회 + `battleLogs` 서브컬렉션 1회 (읽기 1회 증가) |

- **효율**: 배틀 로그가 많을수록 슬롯 문서가 커지고, 배틀할 때마다 **큰 문서 전체**를 쓰게 됨. 서브컬렉션으로 빼면 “배틀 한 건 = 서브컬렉션에 doc 한 건 추가”로 끝나서 **쓰기 비용·문서 크기** 측면에서 유리함.
- **트레이드오프**: 진입 시 **읽기는 1회 증가** (서브컬렉션 쿼리 1번). 이미 활동 로그 때문에 `logs` 쿼리는 하고 있으므로, “슬롯 + logs + battleLogs” 세 번 읽기로 늘어남.

---

### 2.3 확장·일관성

- **활동 로그**는 이미 “서브컬렉션만 사용”으로 정리되어 있음.
- **배틀 로그**도 같은 패턴으로 두면:
  - “로그는 전부 서브컬렉션, 슬롯 문서는 스탯·메타만”이라는 **단일 정책**으로 유지 가능.
  - 나중에 **배틀 로그만** 페이징/필터/삭제 정책을 바꾸기 쉬움 (서브컬렉션 쿼리만 수정하면 됨).

---

## 3. 배틀 로그 서브컬렉션 도입 시 구조 (제안)

- **경로**: `users/{uid}/slots/slot{N}/battleLogs/{logId}` (또는 `battles/{logId}`)
- **문서 필드 예시**: `timestamp`, `mode` ('sparring'|'arena'|'quest'|'skip'), `text`, `win` (boolean), `enemyName`, `injury` (boolean) 등 기존 battleLogs 한 건과 동일 스키마.
- **저장**: 배틀 발생 시 `appendBattleLogToSubcollection(entry)` → `addDoc(collection(slotRef, 'battleLogs'), entry)`.
- **로드**: `loadSlot` 시 `getDocs(collection(slotRef, 'battleLogs'), orderBy('timestamp','desc'), limit(100))` 후 `setBattleLogs`(또는 기존 상태에 병합). 기존 슬롯 문서의 `digimonStats.battleLogs`는 fallback으로만 사용 (마이그레이션 호환).
- **슬롯 문서**: `saveStats` 시 `digimonStats`에서 `battleLogs` 제외 (현재 `activityLogs` 제외하는 것과 동일).

---

## 4. 결론 및 권장

| 질문 | 답변 |
|------|------|
| **활동/배틀 로그를 서브컬렉션도 “따로” 두는 게 더 효율적·직관적인가?** | **예.** 활동 로그는 이미 서브컬렉션, 배틀 로그도 별도 서브컬렉션으로 두면 **일관된 데이터 모델**이 되고, 슬롯 문서 크기·쓰기 비용을 줄일 수 있음. |
| **트레이드오프** | 진입 시 읽기 1회 추가 (battleLogs 서브컬렉션 쿼리). 배틀 빈도가 높은 사용자일수록 슬롯 문서 반복 쓰기 감소 효과가 큼. |
| **권장** | **배틀 로그도 서브컬렉션(`battleLogs`)으로 분리**하는 방향을 권장. 구현 시 `appendLogToSubcollection`과 동일한 패턴으로 `appendBattleLogToSubcollection` 추가, `loadSlot`에서 서브컬렉션 쿼리, `saveStats`에서 `battleLogs` 제외하면 됨. |

이 문서는 설계·검토용입니다. 실제 반영 시 `docs/REFACTORING_LOG.md`에 단계별로 기록하는 것을 권장합니다.

---

## 5. 적용 완료 (2026-01-28)

- **경로**: `users/{uid}/slots/slot{N}/battleLogs` 서브컬렉션 사용.
- **저장**: `useGameData.appendBattleLogToSubcollection(entry)` → `addDoc(..., { timestamp, mode, text, win?, enemyName?, injury? })`. `saveStats` 시 `digimonStats`에서 `battleLogs` 제외.
- **로드**: `loadSlot` 시 `battleLogs` 서브컬렉션 `orderBy('timestamp','desc'), limit(100)` 쿼리 후 `savedStats.battleLogs`에 병합. 서브컬렉션 없/에러 시 기존 문서의 `battleLogs` fallback(마이그레이션 호환).
- **호출**: 스파링·아레나·에너지 부족 스킵·퀘스트 승/패 시 `appendBattleLog`와 동일 entry로 `appendBattleLogToSubcollection(entry)` 호출 (useGameActions 5곳). Game.jsx에서 useGameData → useGameActions로 전달.

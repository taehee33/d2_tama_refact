# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소의 코드를 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

D2 Tamagotchi는 디지털 몬스터 컬러 휴대용 기기에서 영감을 받은 디지몬 가상 펫 관리 웹 애플리케이션입니다. Firebase/Firestore와 Vercel을 사용한 서버리스 아키텍처 기반의 React 싱글 페이지 애플리케이션입니다.

**기술 스택:**
- React 18.2.0 (함수형 컴포넌트와 Hooks)
- Firebase 12.6.0 (인증 & Firestore)
- Tailwind CSS 3.3.3
- React Router DOM 7.4.0
- Create React App 5.0.1

**UI 언어:** 한국어 (모든 UI 텍스트, 디지몬 이름, 문서 주석은 한국어로 작성)

## 빌드 및 개발 명령어

모든 명령어는 `digimon-tamagotchi-frontend` 디렉토리에서 실행해야 합니다:

```bash
# 프론트엔드 디렉토리로 이동
cd digimon-tamagotchi-frontend

# 의존성 설치
npm install

# 개발 서버 시작 (NODE_OPTIONS 플래그 필요)
npm start

# 프로덕션 빌드 (NODE_OPTIONS 플래그 필요)
npm build

# 테스트 실행
npm test
```

**중요:** 빌드 시스템 호환성을 위해 `NODE_OPTIONS=--openssl-legacy-provider` 플래그가 필요합니다.

## 아키텍처 개요

### 이중 저장소 아키텍처

애플리케이션은 독립적으로 동작할 수 있는 두 가지 저장소 모드를 지원합니다:

**모드 1: Firebase (클라우드 저장소)**
- Firebase Auth를 통한 구글 인증 필요
- Firestore의 `users/{uid}/slots/{slotId}` 경로에 데이터 저장
- 실시간 동기화 기능
- 프로덕션 모드

**모드 2: localStorage (오프라인 모드)**
- 인증 불필요
- 브라우저 기반 저장소만 사용
- Firebase 없이도 완전히 작동
- 개발/테스트 모드

**모드 감지:** 앱은 Firebase 사용 가능 여부와 사용자 인증 상태에 따라 자동으로 사용할 모드를 감지합니다. 저장소 계층을 추상화한 리포지토리 패턴을 사용하여 모드 간 원활한 전환이 가능합니다.

### Lazy Update 알고리즘 (핵심 성능 패턴)

**문제:** 실시간 타이머는 과도한 Firestore 쓰기를 발생시켜 높은 비용을 초래합니다.

**해결책:** 마지막 저장 시점부터의 시간 차이를 계산하여 누적된 모든 변경사항을 한 번에 적용:

```
ΔT = 현재시간 - 마지막저장시간

누적 변경사항 적용:
- 배고픔(Hunger): hungerCycle 분마다 -1
- 힘(Strength): strengthCycle 분마다 -1
- 배변(Poop): poopCycle 분마다 +1
- 수명(Lifespan): +ΔT초
- 진화까지 시간(Time to Evolve): -ΔT초
```

**구현:** `src/logic/stats/stats.js`의 `applyLazyUpdate()` 함수가 사용자 액션(먹이주기, 훈련, 배틀) 전에 호출됩니다. 클라이언트 측 1초 타이머는 UI만 업데이트하며 저장소에 절대 쓰기를 하지 않습니다.

**핵심 규칙:** Firestore에 쓰기를 하는 실시간 타이머를 절대 추가하지 마세요. 시간 기반 스탯 변경은 항상 lazy update 패턴을 사용하세요.

### 커스텀 Hook 아키텍처

게임 로직은 유지보수성을 위해 전문화된 Hook들로 분해되어 있습니다:

- **`useGameState.js`** (408줄) - 중앙집중식 상태 관리
- **`useGameData.js`** (515줄) - 데이터 영속성 계층
- **`useGameActions.js`** (1129줄) - 사용자 액션 핸들러
- **`useGameLogic.js`** (512줄) - 핵심 게임 메커니즘
- **`useGameHandlers.js`** (309줄) - 이벤트 핸들러
- **`useGameAnimations.js`** (327줄) - 애니메이션 시퀀스
- **`useEvolution.js`** (219줄) - 진화 시스템 로직
- **`useDeath.js`** (105줄) - 사망 및 환생 메커니즘
- **`useArenaLogic.js`** (135줄) - 아레나 배틀 시스템

**흐름:** 상태 → 데이터 영속성 → 액션 → 애니메이션

### 리포지토리 패턴

데이터 접근은 리포지토리를 통해 추상화되어 있습니다:

- **`LocalStorageSlotRepository`** - 브라우저 localStorage 구현
- **`UserSlotRepository`** - Firestore 구현

두 리포지토리 모두 동일한 인터페이스를 구현합니다: `getSlot()`, `saveSlot()`, `getAllSlots()`, `deleteSlot()`.

이를 통해 비즈니스 로직 변경 없이 어떤 저장소 백엔드든 사용할 수 있습니다.

### 순수 비즈니스 로직 계층

`/src/logic/` 디렉토리는 도메인별로 구성된 순수 함수들을 포함합니다:

- **`battle/`** - 명중률 계산, 퀘스트 엔진, 배틀 계산기
- **`evolution/`** - 진화 체커 및 조건
- **`food/`** - 고기와 프로틴 메커니즘
- **`stats/`** - 배고픔, 힘, 스탯 관리, lazy update
- **`training/`** - 훈련 시스템 로직

이러한 순수 함수들은 유닛 테스트에 이상적이며, 부작용 없이 다양한 컴포넌트에서 사용할 수 있습니다.

## 디렉토리 구조

```
digimon-tamagotchi-frontend/src/
├── components/        # 37개 이상의 UI 컴포넌트 (화면, 모달, 패널, 애니메이션)
├── contexts/          # React Context 프로바이더 (AuthContext)
├── data/              # 게임 데이터 및 설정
│   ├── v1/            # 새로운 데이터 구조 (JSDoc으로 타입이 명시된 구조화된 데이터)
│   ├── nonuse/        # 더 이상 사용하지 않는 데이터 파일
│   └── *.js           # 레거시 데이터 파일 (단계적으로 제거 중)
├── hooks/             # 9개의 커스텀 React Hook (게임 로직)
├── logic/             # 순수 비즈니스 로직 함수
├── pages/             # 4개의 메인 페이지 (Login, SelectScreen, Game, Home)
├── repositories/      # 데이터 접근 계층 (저장소 추상화)
├── styles/            # CSS 파일
├── utils/             # 유틸리티 함수 (dateUtils, sleepUtils, stageTranslator)
├── firebase.js        # Firebase 설정 (graceful degradation)
├── App.jsx            # 라우팅이 있는 루트 컴포넌트
└── index.js           # 진입점
```

## 주요 파일 및 진입점

- **진입점:** `src/App.jsx` - 라우팅이 있는 루트 컴포넌트
- **메인 게임:** `src/pages/Game.jsx` - 메인 게임 오케스트레이션 (1357줄)
- **상태 관리:** `src/hooks/useGameState.js` - 중앙 상태
- **게임 데이터:** `src/data/v1/digimons.js` - 새로운 구조화된 데이터 형식
- **Lazy Update:** `src/logic/stats/stats.js` - 핵심 성능 로직

## 데이터 스키마 마이그레이션

프로젝트는 구조화되지 않은 기존 데이터에서 새로운 타입이 명시된 구조로 마이그레이션 중입니다:

**기존:** `src/data/digimondata_digitalmonstercolor25th_ver1.js`
**신규:** `src/data/v1/digimons.js` (JSDoc으로 구조화, 중첩된 진화 트리)
**어댑터:** `src/data/v1/adapter.js` - 호환성을 위해 새 형식을 기존 형식으로 변환

새로운 디지몬 데이터를 추가할 때는 v1 구조를 사용하세요. 어댑터가 하위 호환성을 보장합니다.

## 핵심 게임 메커니즘

### 배틀 명중률 계산
```
명중률(%) = (내파워 / (내파워 + 적파워)) × 100 + 속성보너스

내파워 = 기본파워(종족값) + 힘 보너스 + TraitedEgg 보너스

속성 상성:
- Vaccine > Virus: +5%
- Virus > Data: +5%
- Data > Vaccine: +5%
- Free: 보너스 없음 (0%)
```

### 진화 카운터 리셋
진화가 발생하면 다음 스탯들이 0으로 초기화됩니다:
- 케어미스, 훈련 횟수, 과식 횟수, 수면 방해
- 부상, 프로틴 과다, 진화를 위한 배틀 횟수

승률과 총 배틀 수는 유지됩니다.

### 사망 조건
시스템이 추적하는 여러 사망 트리거:
- 굶주림: 배고픔 = 0이 12시간 지속
- 탈진: 힘 = 0이 12시간 지속
- 부상 과다: 15개의 부상 누적
- 부상 방치: 6시간 동안 부상 상태
- 노화: 최대 수명 도달

### 케어미스 시스템
케어미스는 진화 경로에 영향을 줍니다:
- 배고픔/힘 콜 무시 (30분 타임아웃)
- 수면 방해 (수면 중 액션)
- 수면 시간에 불 켜놓기 (30분 → 케어미스)
- 과식 및 프로틴 과다

## 개발 가이드라인

### 새 기능 추가하기

1. **순수 로직 업데이트:** `/src/logic/`에서 함수를 추가/수정 (순수 함수로 유지)
2. **필요시 Hook 추가:** 상태 관리가 필요하면 `/src/hooks/`에서 Hook 생성 또는 업데이트
3. **UI 컴포넌트 업데이트:** `/src/components/`에서 컴포넌트 수정 또는 생성
4. **두 모드 모두 테스트:** Firebase와 localStorage 양쪽에서 기능이 작동하는지 확인
5. **변경사항 문서화:** 날짜, 설명, 영향받은 파일을 `docs/REFACTORING_LOG.md`에 업데이트

### 코드 스타일 요구사항 (.cursorrules에서)

1. **관심사의 분리:** 기능은 명확한 클래스/모듈로 분리 (예: StatusManager, FirebaseService)
2. **React 패턴:** Hook과 함수형 컴포넌트 사용
3. **주석:** 한국어로 주석 작성
4. **타입 명확성:** TypeScript 마이그레이션을 염두에 두고 JSDoc에 명확한 타입 작성
5. **아키텍처:** 모든 코드는 Vercel/Firebase 서버리스 아키텍처 사용 (Express 서버 코드 금지)

### 필수 문서화

**모든 주요 변경사항은 반드시 `docs/REFACTORING_LOG.md`에 기록해야 합니다:**
- 현재 날짜
- 마크다운 형식의 기능/버그 설명
- 영향받은 파일 목록
- 아키텍처 결정에 대한 근거

이는 프로젝트 정책에서 강제하는 포트폴리오 스타일의 문서화 요구사항입니다.

### 모달 관리 패턴

모든 모달은 개별 boolean 플래그 대신 통합된 상태 객체를 사용합니다:

```javascript
const [modals, setModals] = useState({
  stats: false,
  feed: false,
  settings: false,
  admin: false,
  // ... 20개 이상의 모달
});

const toggleModal = (name, isOpen) => {
  setModals(prev => ({ ...prev, [name]: isOpen }));
};
```

### 한국어 현지화

모든 UI 텍스트는 한국어로 작성해야 합니다:
- 디지몬 이름 (디지타마, 깜몬, 코로몬)
- UI 라벨 (먹이, 훈련, 배틀)
- 단계 이름 (디지타마, 유년기 I, 유년기 II, 성장기, 성숙기, 완전체)

단계 이름 번역은 `utils/stageTranslator.js`를 사용하세요.

## 테스트

**프레임워크:** Jest + React Testing Library (react-scripts를 통해)

**현재 상태:** 최소한의 테스트 커버리지 (기본 App.test.js만 존재)

**기회:** `/src/logic/`의 순수 함수들은 유닛 테스트의 이상적인 후보입니다. 게임 메커니즘에 대한 포괄적인 테스트 커버리지 추가를 고려하세요.

## Firebase 설정

`.env`에 필요한 환경 변수:

```
REACT_APP_FIREBASE_API_KEY=xxx
REACT_APP_FIREBASE_AUTH_DOMAIN=xxx
REACT_APP_FIREBASE_PROJECT_ID=xxx
REACT_APP_FIREBASE_STORAGE_BUCKET=xxx
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=xxx
REACT_APP_FIREBASE_APP_ID=xxx
```

**Graceful Degradation:** Firebase가 설정되지 않은 경우, 앱은 자동으로 localStorage 모드로 폴백됩니다. 에러가 발생하지 않습니다.

## 일반적인 디버깅 절차

1. 브라우저 콘솔에서 에러 확인
2. 게임 상태의 활동 로그 검토 (`activityLogs` 배열)
3. 개발자 모드 토글 확인 (localStorage 기반 디버그 모드)
4. 문제와 관련된 분석 문서를 `/docs/`에서 검토
5. `src/logic/stats/stats.js`에서 lazy update 계산 확인
6. 배틀 이슈의 경우 `src/logic/battle/hitrate.js` 확인

## 중요한 프로젝트 제약사항

1. **Firestore 쓰기를 위한 실시간 타이머 절대 사용 금지** - 항상 lazy update 패턴 사용
2. **두 저장소 모드 모두 지원** - 코드는 Firebase와 localStorage 모두에서 작동해야 함
3. **모든 주요 변경사항 문서화** - REFACTORING_LOG.md 업데이트
4. **한국어 우선** - 모든 UI 텍스트는 한국어로
5. **순수 함수** - `/logic/`의 비즈니스 로직은 부작용 없이 유지
6. **Express 서버 코드 금지** - 아키텍처는 완전히 서버리스 (Vercel + Firebase)

## 배포

**대상 플랫폼:** Vercel (서버리스)

**빌드 출력:** `/build/` 디렉토리의 정적 자산

**모바일 지원:** 터치 친화적인 컨트롤이 있는 반응형 디자인

**환경:** `--openssl-legacy-provider` 지원이 가능한 Node.js 필요

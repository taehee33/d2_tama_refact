// src/data/v1/defaultStats.js
// Digital Monster Color 매뉴얼 기반 기본 스탯 정의

export const defaultStats = {
  // 기본 정보
  sprite: 133,
  evolutionStage: "Digitama",
  
  // 표시되는 스탯 (Status 화면)
  age: 0,                    // 나이 (일)
  weight: 0,                  // 체중 (Gigabytes)
  hunger: 0,                  // 배고픔 (하트 수, 0-5)
  strength: 0,                // 힘 (하트 수, 0-5)
  effort: 0,                  // 노력치 (하트 수, 0-5)
  energy: 0,                  // 에너지/스태미나 (DP)
  winRatio: 0,                // 승률 (%)
  
  // 숨겨진 스탯
  type: null,                 // 속성: "Vaccine", "Data", "Virus", "Free" 또는 null
  power: 0,                   // 파워 (Base Power + 보너스)
  basePower: 0,               // 기본 파워
  careMistakes: 0,            // 실수 횟수 (진화 시 리셋)
  proteinOverdose: 0,         // 프로틴 과다 (최대 7, 4개당 +1)
  injuries: 0,                // 부상 횟수 (15회 시 사망)
  battlesWon: 0,              // 승리 횟수
  battlesLost: 0,             // 패배 횟수
  battlesForEvolution: 0,     // 진화를 위한 배틀 횟수 (진화 시 리셋)
  
  // 시간 관련
  lifespanSeconds: 0,         // 수명 (초)
  timeToEvolveSeconds: 0,     // 진화까지 시간 (초)
  
  // 타이머
  hungerTimer: 0,             // 배고픔 감소 주기 (분)
  hungerCountdown: 0,         // 배고픔 타이머 카운트다운 (초)
  strengthTimer: 0,           // 힘 감소 주기 (분)
  strengthCountdown: 0,       // 힘 타이머 카운트다운 (초)
  poopTimer: 0,               // 똥 생성 주기 (분, Stage별로 다름)
  poopCountdown: 0,           // 똥 타이머 카운트다운 (초)
  
  // 진화 관련 (진화 시 리셋)
  trainings: 0,               // 훈련 횟수
  overfeeds: 0,               // 오버피드 횟수
  sleepDisturbances: 0,       // 수면 방해 횟수
  
  // 똥 관련
  poopCount: 0,               // 똥 개수 (최대 8)
  lastMaxPoopTime: null,      // 똥 8개가 된 시간
  
  // 사망 관련
  isDead: false,              // 사망 여부
  lastHungerZeroAt: null,    // 배고픔이 0이 된 시간 (절대 기준점, DB 저장·값 있으면 now로 덮어쓰지 않음)
  lastStrengthZeroAt: null,  // 힘이 0이 된 시간 (절대 기준점)
  hungerMistakeDeadline: null,  // 케어미스 타임아웃 데드라인(ms). 배고픔 0 발생 시 lastHungerZeroAt+10분, DB 저장
  strengthMistakeDeadline: null, // 힘 0 발생 시 lastStrengthZeroAt+10분, DB 저장
  injuredAt: null,            // 부상 당한 시간
  
  // 환생 관련
  totalReincarnations: 0,     // 토탈 환생 횟수 (일반 + Perfect 이상)
  normalReincarnations: 0,    // 일반 사망 환생 횟수 (Perfect 미만)
  perfectReincarnations: 0,   // Perfect 이상 사망 환생 횟수
  
  // 기타
  maxOverfeed: 0,             // 최대 오버피드 허용치
  maxStamina: 0,              // 최대 스태미나
  minWeight: 0,               // 최소 체중
  healing: 0,                 // 힐링 (미사용?)
  attackSprite: 0,            // 공격 스프라이트 (미사용?)
  altAttackSprite: 65535,     // 대체 공격 스프라이트 (미사용?)
  
  // 마지막 저장 시간 (Lazy Update용)
  lastSavedAt: null,
  
  // 야행성 모드
  isNocturnal: false, // 야행성 모드 (수면/기상 시간을 3시간씩 미룸)
  
  // 냉장고(냉동수면) 관련
  isFrozen: false,    // 냉장고 보관 여부
  frozenAt: null,     // 냉장고에 넣은 시간 (timestamp)
  takeOutAt: null,    // 냉장고에서 꺼낸 시간 (timestamp, 꺼내기 애니메이션용)
};


# Ver.3 데이터/스프라이트 정합성 감사

검토일: 2026-07-11

## 기준 자료

- 데이터: `digimon-tamagotchi-frontend/src/data/v3/digimons.js`
- 스프라이트: `digimon-tamagotchi-frontend/public/Ver3_Mod_TH/`
- 로컬 근거 이미지: `/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/v3 정리`

`v3 정리` 폴더에는 Ver.3 전체 진화 차트 1장과 각 생체 디지몬 상세 페이지 20장이 있다. 상세 페이지에서 직접 확인 가능한 이름, 단계, 속성, 진화 경로, Power, Min Weight, Heal Doses, Hunger Loss, Strength Loss, Sleep Time, Energy만 반영했다.

## 현재 엔트리 현황

| key | id | name | stage | sprite | spriteBasePath |
| --- | --- | --- | --- | --- | --- |
| Ohakadamon1V3 | Ohakadamon1V3 | 사망(일반 Ver.3) | Ohakadamon | 159 | /Ver3_Mod_TH |
| Ohakadamon2V3 | Ohakadamon2V3 | 사망(perfect Ver.3) | Ohakadamon | 160 | /Ver3_Mod_TH |
| DigitamaV3 | DigitamaV3 | 디지타마 Ver.3 | Digitama | 133 | /Ver3_Mod_TH |
| Poyomon | Poyomon | 포요몬 | Baby I | 210 | /Ver3_Mod_TH |
| Tokomon | Tokomon | 토코몬 | Baby II | 225 | /Ver3_Mod_TH |
| Patamon | Patamon | 파타몬 | Child | 240 | /Ver3_Mod_TH |
| Kunemon | Kunemon | 쿠네몬 | Child | 255 | /Ver3_Mod_TH |
| Unimon | Unimon | 유니몬 | Adult | 270 | /Ver3_Mod_TH |
| Centaurmon | Centaurmon | 켄타루몬 | Adult | 285 | /Ver3_Mod_TH |
| Ogremon | Ogremon | 오거몬 | Adult | 300 | /Ver3_Mod_TH |
| Bakemon | Bakemon | 바케몬 | Adult | 315 | /Ver3_Mod_TH |
| Drimogemon | Drimogemon | 드리모게몬 | Adult | 330 | /Ver3_Mod_TH |
| Shellmon | Shellmon | 쉘몬 | Adult | 345 | /Ver3_Mod_TH |
| Scumon | Scumon | 스카몬 | Adult | 360 | /Ver3_Mod_TH |
| Andromon | Andromon | 안드로몬 | Perfect | 375 | /Ver3_Mod_TH |
| Giromon | Giromon | 기로몬 | Perfect | 390 | /Ver3_Mod_TH |
| Etemon | Etemon | 에테몬 | Perfect | 405 | /Ver3_Mod_TH |
| Chimairamon | Chimairamon | 키메라몬 | Perfect | 421 | /Ver3_Mod_TH |
| HiAndromon | HiAndromon | 하이안드로몬 | Ultimate | 436 | /Ver3_Mod_TH |
| Gokumon | Gokumon | 고쿠몬 | Ultimate | 451 | /Ver3_Mod_TH |
| BanchoLeomon | BanchoLeomon | 반쵸레오몬 | Ultimate | 466 | /Ver3_Mod_TH |
| Chaosmon | Chaosmon | 카오스몬 | Super Ultimate | 481 | /Ver3_Mod_TH |
| Millenniumon | Millenniumon | 밀레니엄몬 | Super Ultimate | 496 | /Ver3_Mod_TH |

## 자동 검사 결과

- key와 `id`: 모두 일치
- 중복 `id`: 없음
- 중복 `sprite`: 없음
- 필수 엔트리 필드: 모두 존재
- 필수 `stats` 필드: 모두 존재
- `public/Ver3_Mod_TH/` PNG 수: 23개
- 데이터에서 사용하는 sprite 수: 23개
- 데이터 sprite와 PNG 파일: 전부 1:1 대응
- 사용하지 않는 Ver.3 PNG: 없음
- 누락된 Ver.3 PNG: 없음
- `starterId`: `DigitamaV3`, 실제 데이터에 존재
- `deathFormIds`: `Ohakadamon1V3`, `Ohakadamon2V3`, 실제 데이터에 존재
- `evolutions[].targetId`: Ver.3 또는 등록된 다른 버전에 존재
- `targetName`: 대상 데이터의 `name`과 일치
- 조그레스 파트너:
  - `BanchoLeomon -> Chaosmon`: Ver.4 `Darkdramon` 확인
  - `Chimairamon -> Millenniumon`: Ver.5 `Mugendramon` 확인

## 반영한 확정 데이터

- `v3 정리` 전체 진화 차트와 개별 상세 페이지 기준으로 Ver.3 진화 경로를 보정했다.
- Tokomon 분기를 `0-3 Care Mistakes -> Patamon`, `4+ Care Mistakes -> Kunemon`으로 보정했다.
- Patamon/Kunemon의 Adult 진화 분기를 개별 상세 페이지 조건에 맞춰 보정했다.
- Adult 단계의 Perfect 진화 목적지를 이미지 기준으로 분리했다.
  - Unimon/Ogremon/Shellmon: Andromon 또는 Chimairamon
  - Centaurmon/Bakemon/Drimogemon: Giromon
  - Scumon: Etemon 또는 Chimairamon
- Perfect 단계의 Ultimate/Super Ultimate 진화 경로를 이미지 기준으로 보정했다.
  - Andromon -> HiAndromon
  - Giromon -> Gokumon
  - Etemon -> BanchoLeomon
  - Chimairamon -> BanchoLeomon 또는 Millenniumon 조그레스
- 이미지 하단 표에서 확인된 `hungerCycle`, `strengthCycle`, `basePower`, `maxEnergy`, `minWeight`, `healDoses`, `type`, `sleepTime` 차이를 반영했다.
- `attackSprite`, `maxOverfeed`, 진화까지 시간은 이번 이미지에서 직접 확인되지 않아 기존 값을 유지했다.

## 수정하지 않은 항목

- `Ohakadamon1V3`, `Ohakadamon2V3`, `DigitamaV3`의 상세 수치: 개별 상세 페이지 근거가 없어 기존 값을 유지했다.
- `attackSprite`: 상세 이미지에서 공격 스프라이트 번호를 확인할 수 없어 기존 값을 유지했다.
- `maxOverfeed`: 상세 이미지에 표시되지 않아 기존 값을 유지했다.
- `evolutionCriteria.timeToEvolveSeconds`: 상세 이미지에 표시되지 않아 기존 값을 유지했다.
- `poopCycle`: 상세 이미지에 표시되지 않아 기존 값을 유지했다.
- Ver.3 전용 훈련 로직과 온라인 조그레스 로직: 이번 작업 범위가 데이터 정합성이라 변경하지 않았다.

## 추가 자료가 필요한 항목

- Ver.3 매뉴얼 또는 표 기반 `maxOverfeed`
- Ver.3 매뉴얼 또는 표 기반 `poopCycle`
- Ver.3 매뉴얼 또는 표 기반 `timeToEvolveSeconds`
- Ver.3 공격 애니메이션/공격 스프라이트 번호
- 사망 형태와 디지타마 상세 페이지 또는 공식 표

## 검증

추가된 테스트:

- `digimon-tamagotchi-frontend/src/data/v3/digimons.test.js`

검증 항목:

- key와 `id` 일치
- 중복 `id`/`sprite` 없음
- 필수 필드 존재
- Ver.3 PNG 존재 여부
- 사용하지 않는 Ver.3 PNG 없음
- 진화 대상 존재
- `targetName` 일치
- starter/death form 존재
- 조그레스 파트너/버전 존재
- 어댑터 변환 필드 확인
- 데이터 파일에 구형 런타임 필드 직접 추가 없음

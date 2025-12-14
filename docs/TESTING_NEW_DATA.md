# 새 데이터 소스 테스트 가이드

## 확인 방법

### 1. 브라우저 콘솔 확인
게임을 실행한 후 브라우저 개발자 도구(F12)의 콘솔 탭에서 다음 로그를 확인하세요:

```
[Adapter] 새 데이터 맵 변환 완료
[Adapter] 변환된 맵의 키: [...]
[Adapter] 예시 - Digitama: {...}
[Adapter] 예시 - Botamon: {...}
[Game.jsx] 새 데이터 import 확인: {...}
```

이 로그가 보이면 어댑터가 정상적으로 작동하고 있습니다.

### 2. 데이터 값 변경 테스트

#### 방법 1: sprite 값 변경
`src/data/v1/digimons.js`에서 Botamon의 sprite 값을 변경:

```javascript
Botamon: {
  // ...
  sprite: 999, // 원래 210 → 999로 변경
  // ...
}
```

게임에서 Botamon을 선택했을 때 스프라이트가 변경되면 새 데이터가 사용되고 있는 것입니다.

#### 방법 2: minWeight 값 변경
`src/data/v1/digimons.js`에서 Botamon의 minWeight 값을 변경:

```javascript
Botamon: {
  // ...
  stats: {
    // ...
    minWeight: 999, // 원래 5 → 999로 변경
    // ...
  },
  // ...
}
```

게임에서 Botamon의 체중이 999 이상이어야 진화할 수 있도록 변경되면 새 데이터가 사용되고 있는 것입니다.

#### 방법 3: hungerCycle 값 변경
`src/data/v1/digimons.js`에서 Botamon의 hungerCycle 값을 변경:

```javascript
Botamon: {
  // ...
  stats: {
    hungerCycle: 10, // 원래 3 → 10으로 변경 (배고픔이 더 천천히 감소)
    // ...
  },
  // ...
}
```

게임에서 Botamon의 배고픔이 더 천천히 감소하면 새 데이터가 사용되고 있는 것입니다.

### 3. 옛날 데이터와 비교

옛날 데이터 파일(`src/data/digimondata_digitalmonstercolor25th_ver1.js`)의 값을 변경해보세요.
만약 게임에 반영되지 않으면 새 데이터가 사용되고 있는 것입니다.

### 4. 확인 체크리스트

- [ ] 브라우저 콘솔에 어댑터 로그가 표시되는가?
- [ ] 새 데이터 파일의 sprite 값을 변경했을 때 게임에 반영되는가?
- [ ] 새 데이터 파일의 minWeight 값을 변경했을 때 게임에 반영되는가?
- [ ] 옛날 데이터 파일의 값을 변경했을 때 게임에 반영되지 않는가?

## 문제 해결

### 새 데이터가 반영되지 않는 경우

1. **브라우저 캐시 문제**: 
   - 하드 리프레시: `Ctrl+Shift+R` (Windows/Linux) 또는 `Cmd+Shift+R` (Mac)
   - 또는 개발자 도구에서 "Disable cache" 체크

2. **빌드 문제**:
   - 개발 서버 재시작: `npm start` 또는 `yarn start`

3. **import 경로 문제**:
   - `Game.jsx`에서 `import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons"`가 올바른지 확인

4. **어댑터 호출 확인**:
   - 브라우저 콘솔에서 `[Adapter]` 로그가 보이는지 확인
   - 로그가 없다면 어댑터가 호출되지 않는 것입니다


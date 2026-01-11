# 사망/질병 카운터 반영 가능 여부 분석

## 현재 코드 상태 확인

### ✅ 존재하는 데이터 필드

1. **`lastHungerZeroAt`**: 배고픔이 0이 된 시간 (timestamp)
   - 위치: `defaultStatsFile.js`, `defaultStats.js`
   - 사용: 배고픔 0 → 12시간 경과 시 사망 체크

2. **`lastStrengthZeroAt`**: 힘이 0이 된 시간 (timestamp)
   - 위치: `defaultStats.js`
   - 사용: 힘 0 → 12시간 경과 시 사망 체크

3. **`lastMaxPoopTime`**: 똥 8개가 된 시간 (timestamp)
   - 위치: `defaultStatsFile.js`, `defaultStats.js`
   - 사용: 똥 8개가 되면 즉시 부상 발생, 이후 8시간마다 추가 부상

4. **`injuries`**: 누적 부상 횟수 (0-15)
   - 위치: `defaultStatsFile.js`, `defaultStats.js`
   - 사용: 15회 도달 시 사망

5. **`isInjured`**: 현재 부상 여부 (boolean)
   - 위치: `defaultStatsFile.js`, `defaultStats.js`
   - 사용: 부상 상태 표시

6. **`injuredAt`**: 부상 당한 시간 (timestamp)
   - 위치: `defaultStatsFile.js`, `defaultStats.js`
   - 사용: 부상 방치 6시간 체크

### 현재 사망 로직

1. **배고픔 0 → 12시간 경과 시 사망**
   - 기준: `lastHungerZeroAt`부터 43200초(12시간)
   - 구현 위치: `stats.js` (applyLazyUpdate), `Game.jsx` (타이머)

2. **힘 0 → 12시간 경과 시 사망**
   - 기준: `lastStrengthZeroAt`부터 43200초(12시간)
   - 구현 위치: `stats.js` (applyLazyUpdate), `Game.jsx` (타이머)

3. **부상 15회 → 사망**
   - 기준: `injuries >= 15`
   - 구현 위치: `Game.jsx`, `useDeath.js`

4. **부상 방치 6시간 → 사망**
   - 기준: `injuredAt`부터 21600000ms(6시간)
   - 구현 위치: `Game.jsx`, `useDeath.js`

### 현재 부상 발생 로직

1. **똥 8개 → 즉시 부상**
   - `poopCount === 8`이 되면 `isInjured = true`, `injuries +1`
   - `lastMaxPoopTime` 기록
   - 구현 위치: `stats.js` (applyLazyUpdate)

2. **똥 8개 유지 → 8시간마다 추가 부상**
   - `lastMaxPoopTime`부터 28800초(8시간) 경과 시 `injuries +1`
   - 구현 위치: `stats.js` (updateLifespan, applyLazyUpdate)

3. **배틀 패배/승리 → 확률로 부상**
   - 패배: 10% + (프로틴 과다 × 10%)
   - 승리: 20%
   - 구현 위치: `useGameActions.js`

## 제안 내용과의 차이점

### ⚠️ 주의사항

1. **똥 "가득참" 기준**
   - 제안: "똥 가득참" = 4개
   - 현재: 똥 8개가 최대, 8개가 되면 즉시 부상
   - **결정 필요**: 4개 기준으로 변경할지, 8개 기준 유지할지

2. **부상 발생 시간**
   - 제안: "똥 가득참 → 즉시 부상 발생시간" + "추가 부상발생시간 카운터"
   - 현재: 똥 8개 → 즉시 부상, 이후 8시간마다 추가 부상
   - **현재 로직과 유사하지만, 4개 vs 8개 차이**

## 반영 가능한 항목

### ✅ 1. 배고픔 0 사망 카운터
- **데이터**: `lastHungerZeroAt` 사용
- **계산**: 현재 시간 - `lastHungerZeroAt` = 경과 시간
- **표시**: 경과 시간을 12시간(43200초) 기준으로 카운트다운
- **조건**: `fullness === 0 && lastHungerZeroAt !== null`일 때만 표시

### ✅ 2. 힘 0 사망 카운터
- **데이터**: `lastStrengthZeroAt` 사용
- **계산**: 현재 시간 - `lastStrengthZeroAt` = 경과 시간
- **표시**: 경과 시간을 12시간(43200초) 기준으로 카운트다운
- **조건**: `strength === 0 && lastStrengthZeroAt !== null`일 때만 표시

### ✅ 3. 똥 가득참 부상 발생 시간 카운터
- **데이터**: `lastMaxPoopTime` 사용 (현재는 8개 기준)
- **계산**: 
  - 즉시 부상: 똥 8개가 된 시간 (`lastMaxPoopTime`)
  - 추가 부상: `lastMaxPoopTime`부터 8시간(28800초) 경과 시 추가 부상
- **표시**: 
  - 똥 8개가 된 시간 표시
  - 다음 추가 부상까지 남은 시간 카운트다운
- **조건**: `poopCount >= 8 && lastMaxPoopTime !== null`일 때만 표시

### ✅ 4. 사망까지 부상횟수 카운터
- **데이터**: `injuries` 사용
- **표시**: `injuries / 15` 형식
- **게이지**: 15개 구간으로 나눈 게이지 표시
- **경고**: 12회 이상일 때 경고 표시

## 구현 제안

### StatsPopup.jsx에 추가할 섹션

```javascript
{/* Sec 8. 사망/질병 카운터 */}
<div className="border-b pb-2">
  <h3 className="font-bold text-base mb-2 text-red-700">8. 사망/질병 카운터</h3>
  <ul className="space-y-2 text-sm">
    {/* 배고픔 0 사망 카운터 */}
    {fullness === 0 && lastHungerZeroAt && (
      <li className="border-l-4 pl-2 border-red-500">
        <div className="font-semibold text-red-600">🍖 배고픔 0 지속:</div>
        {(() => {
          const hungerZeroTime = ensureTimestamp(lastHungerZeroAt);
          if (!hungerZeroTime) return <div className="text-gray-500">정보 없음</div>;
          
          const elapsed = Math.floor((currentTime - hungerZeroTime) / 1000);
          const threshold = 43200; // 12시간
          const remaining = threshold - elapsed;
          
          if (remaining > 0) {
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = remaining % 60;
            return (
              <div className="text-red-600 font-mono">
                {hours}시간 {minutes}분 {seconds}초 남음 (12시간 초과 시 사망)
              </div>
            );
          } else {
            return <div className="text-red-800 font-bold">⚠️ 사망 위험!</div>;
          }
        })()}
      </li>
    )}

    {/* 힘 0 사망 카운터 */}
    {strength === 0 && lastStrengthZeroAt && (
      <li className="border-l-4 pl-2 border-orange-500">
        <div className="font-semibold text-orange-600">💪 힘 0 지속:</div>
        {(() => {
          const strengthZeroTime = ensureTimestamp(lastStrengthZeroAt);
          if (!strengthZeroTime) return <div className="text-gray-500">정보 없음</div>;
          
          const elapsed = Math.floor((currentTime - strengthZeroTime) / 1000);
          const threshold = 43200; // 12시간
          const remaining = threshold - elapsed;
          
          if (remaining > 0) {
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = remaining % 60;
            return (
              <div className="text-orange-600 font-mono">
                {hours}시간 {minutes}분 {seconds}초 남음 (12시간 초과 시 사망)
              </div>
            );
          } else {
            return <div className="text-orange-800 font-bold">⚠️ 사망 위험!</div>;
          }
        })()}
      </li>
    )}

    {/* 똥 가득참 부상 발생 시간 카운터 */}
    {poopCount >= 8 && lastMaxPoopTime && (
      <li className="border-l-4 pl-2 border-brown-500">
        <div className="font-semibold text-brown-600">💩 똥 가득참 (8개):</div>
        {(() => {
          const pooFullTime = ensureTimestamp(lastMaxPoopTime);
          if (!pooFullTime) return <div className="text-gray-500">정보 없음</div>;
          
          // 즉시 부상 발생 시간 표시
          const immediateInjuryTime = formatTimestamp(pooFullTime);
          
          // 추가 부상까지 남은 시간 (8시간마다)
          const elapsed = Math.floor((currentTime - pooFullTime) / 1000);
          const threshold = 28800; // 8시간
          const nextInjuryIn = threshold - (elapsed % threshold);
          
          return (
            <div className="space-y-1">
              <div className="text-sm text-gray-600">
                즉시 부상 발생 시간: {immediateInjuryTime}
              </div>
              <div className="text-brown-600 font-mono">
                다음 추가 부상까지: {Math.floor(nextInjuryIn / 3600)}시간 {Math.floor((nextInjuryIn % 3600) / 60)}분 {nextInjuryIn % 60}초
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-brown-500 h-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, ((elapsed % threshold) / threshold) * 100)}%` }}
                />
              </div>
            </div>
          );
        })()}
      </li>
    )}

    {/* 사망까지 부상횟수 카운터 */}
    <li className="border-l-4 pl-2 border-red-300">
      <div className="font-semibold text-gray-700 mb-1">사망까지 부상횟수:</div>
      <div className="flex justify-between items-center mb-1">
        <span className={`font-bold ${injuries >= 12 ? 'text-red-600' : 'text-gray-700'}`}>
          {injuries || 0} / 15 회
        </span>
        {injuries >= 12 && (
          <span className="text-xs text-red-500 animate-pulse">⚠️ 경고!</span>
        )}
      </div>
      {/* 부상 횟수 게이지 */}
      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div 
            key={i}
            className={`flex-1 border-r border-white last:border-0 ${
              i < (injuries || 0) ? 'bg-red-500' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
      {injuries >= 12 && (
        <p className="text-[10px] text-red-500 mt-1">
          ※ 경고: 부상 횟수가 한도에 도달했습니다. 사망 위험이 매우 높습니다!
        </p>
      )}
    </li>
  </ul>
</div>
```

## 결정 필요 사항

1. **똥 "가득참" 기준**
   - 현재: 8개 기준
   - 제안: 4개 기준
   - **질문**: 4개로 변경할지, 8개 기준 유지할지?

2. **부상 발생 시간 표시 방식**
   - 현재: 똥 8개 → 즉시 부상, 이후 8시간마다 추가 부상
   - 제안: "즉시 부상 발생시간" + "추가 부상발생시간 카운터"
   - **결정**: 현재 로직과 유사하므로 그대로 반영 가능

## 다음 단계

1. ✅ `lastHungerZeroAt`, `lastStrengthZeroAt` 추출 (이미 존재)
2. ✅ `lastMaxPoopTime` 추출 (이미 존재)
3. ✅ `injuries` 추출 (이미 존재)
4. ✅ StatsPopup.jsx에 "8. 사망/질병 카운터" 섹션 추가
5. ⚠️ 똥 기준 확인 (4개 vs 8개)

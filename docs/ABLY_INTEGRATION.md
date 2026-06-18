# Ably 실시간 통신 통합 문서

## 개요

디지몬 타마고치 프로젝트에 Ably를 통합하여 실시간 채팅 및 접속자 목록(Presence) 기능을 구현했습니다.

## 구현된 기능

### 1. 실시간 채팅
- 모든 접속자와 실시간으로 메시지 주고받기
- 최신 50개 메시지 유지
- 자동 스크롤 기능

### 2. 접속자 목록 (Presence)
- 현재 접속 중인 테이머 목록 실시간 표시
- 사용자 상태 관리 (온라인/자리비움/오프라인)
- 상태별 색상 및 이모지 표시
- 접속자 수 실시간 업데이트

## 아키텍처

### 컴포넌트 구조

```
AblyWrapper
  └─ AblyContextProvider
      ├─ Firebase ID Token
      ├─ POST /api/operator/status?action=ably-token
      │   └─ Ably TokenRequest (tamer-lobby 제한 권한)
      └─ AblyProvider
          └─ ChannelProvider
              └─ ChatRoom
                  ├─ usePresence (접속자 목록)
                  └─ useChannel (채팅 메시지)
```

### 주요 파일

1. **`src/contexts/AblyContext.jsx`**
   - Ably 클라이언트 생성 및 관리
   - Firebase 인증 기반 Ably token auth 자동 갱신
   - AblyProvider 제공
   - 서버가 확정한 테이머명을 clientId로 사용

2. **`src/components/AblyWrapper.jsx`**
   - AblyContextProvider와 ChannelProvider 래핑
   - SelectScreen과 Game 페이지에 통합

3. **`src/components/ChatRoom.jsx`**
   - 실시간 채팅 UI
   - 접속자 목록 표시
   - Presence 상태 관리

4. **`api/operator/status.js?action=ably-token`**
   - Firebase ID 토큰 검증
   - 사용자 프로필에서 clientId 결정
   - `tamer-lobby`의 publish/subscribe/presence 권한만 가진 1시간 TokenRequest 발급

## 설정

### 환경 변수

Vercel 서버 환경변수 또는 `vercel dev`가 읽는 로컬 환경 파일에 다음 변수를 추가:

```env
ABLY_API_KEY=your_ably_api_key
```

`REACT_APP_ABLY_KEY`는 브라우저 번들에 포함되므로 사용하지 않습니다.

### 패키지 설치

```bash
npm install ably
```

## 주요 구현 내용

### 1. Ably 클라이언트 초기화

```javascript
// AblyContext.jsx
const client = new Ably.Realtime({
  authCallback: createAblyAuthCallback(currentUser),
});
```

**주의사항:**
- Ably v2.0+에서는 `Realtime.Promise`가 제거됨
- `Realtime`을 직접 사용해야 함
- 모든 비동기 메서드는 기본적으로 Promise 반환

### 2. ChannelProvider 설정

```javascript
// AblyWrapper.jsx
<ChannelProvider channelName="tamer-lobby">
  <ChatRoom />
</ChannelProvider>
```

**중요:**
- `usePresence`와 `useChannel` 훅은 반드시 `ChannelProvider` 내부에서 사용해야 함
- `ChannelProvider`는 `AblyProvider` 내부에 있어야 함

### 3. Presence 사용

```javascript
// ChatRoom.jsx
const { presenceData, updateStatus } = usePresence(CHANNEL_NAME, {
  initialData: { status: 'online', joinedAt: new Date().toISOString() }
});
```

**특징:**
- `usePresence`는 자동으로 presence에 참여하고 떠날 때 자동으로 제거
- `initialData`로 초기 상태 데이터 설정 가능
- `updateStatus` 메서드로 상태 업데이트

### 4. 채팅 메시지 처리

```javascript
// ChatRoom.jsx
const { channel } = useChannel(CHANNEL_NAME, (message) => {
  // 메시지 수신 처리
});
```

## 해결한 문제들

### 1. Ably v2.0+ 호환성
- **문제**: `Realtime.Promise is not a constructor` 오류
- **해결**: `new Ably.Realtime.Promise()` → `new Ably.Realtime()` 변경

### 2. ChannelProvider 오류
- **문제**: `Could not find a parent ChannelProvider` 오류
- **해결**: `ChannelProvider` 추가 및 `usePresence`, `useChannel`에 channelName 명시적 전달

### 3. 접속자 수 0명 표시
- **문제**: 로그인했는데 접속자 수가 0명으로 표시
- **해결**:
  - clientId 설정 강화 (문자열 변환, 빈 값 처리)
  - `usePresence` 자동 처리 활용 (수동 enter 호출 제거)
  - `updateStatus` 메서드 사용

### 4. AdSense 중복 로드
- **문제**: `adsbygoogle.push() error: All 'ins' elements already have ads`
- **해결**: `useRef`로 광고 요소 관리 및 중복 push 방지

## 사용 방법

### SelectScreen과 Game 페이지

두 페이지 모두 `AblyWrapper`로 감싸져 있어 자동으로 ChatRoom이 표시됩니다:

```javascript
<AblyWrapper tamerName={tamerName}>
  {/* 페이지 내용 */}
</AblyWrapper>
```

### ChatRoom 위치

- SelectScreen: 페이지 하단 (광고 배너 아래)
- Game: 페이지 하단 (광고 배너 아래)

## 디버깅

### 콘솔 로그 확인

정상 작동 시 다음 로그가 표시됩니다:

```
🔑 Ably clientId 설정: [테이머명]
✅ Ably 클라이언트 생성 완료: [테이머명]
✅ Ably 연결 성공: [테이머명]
✅ ChatRoom 렌더링됨, 접속자 수: [숫자]
📊 Presence 데이터: [배열]
```

### 문제 해결

1. **접속자 수가 0명으로 표시**
   - 브라우저 콘솔에서 `🔑 Ably clientId 설정` 로그 확인
   - `/api/operator/status?action=ably-token` 응답 상태 확인
   - 서버의 `ABLY_API_KEY` 환경 변수 확인
   - `vercel dev` 재시작

2. **ChannelProvider 오류**
   - `ChannelProvider`가 `AblyProvider` 내부에 있는지 확인
   - `usePresence`와 `useChannel`에 channelName 전달 확인

3. **연결 실패**
   - 서버의 Ably API Key가 요청된 권한을 위임할 수 있는지 확인
   - Firebase ID 토큰 검증 상태 확인
   - 네트워크 연결 확인

## 환경 변수

### 로컬 개발

`vercel dev`에서 읽는 서버 환경 파일에 다음을 추가:
```env
ABLY_API_KEY=your_ably_api_key_here
```

일반 CRA 개발 서버(`npm start`)만 실행하면 `/api/ably/token` 서버리스 함수가 없으므로 채팅 인증은 동작하지 않습니다.

### 배포 환경 (Vercel)

Vercel 대시보드 > Settings > Environment Variables에 추가:
- Key: `ABLY_API_KEY`
- Value: Ably API Key (실제 키 값)

기존 `REACT_APP_ABLY_KEY`는 Preview/Production 환경에서 제거합니다.

## API Key 권한

**중요**: 서버의 API 키는 `tamer-lobby`에 publish/subscribe/presence 권한을 위임할 수 있어야 합니다.
브라우저에는 전체 API 키가 전달되지 않고, 서버가 발급한 1시간 제한 TokenRequest만 전달됩니다.

Subscribe only 키를 사용하면:
- 메시지 수신은 가능
- Presence Enter 권한이 없어 접속자 목록에 표시되지 않음

## 참고 자료

- [Ably React Hooks 문서](https://ably.com/docs/getting-started/react-hooks)
- [Ably Presence 문서](https://ably.com/docs/presence-occupancy/presence)
- [Ably v2.0 마이그레이션 가이드](https://changelog.ably.com/js-client-library-release-v2-0-0-288796)

## 커밋 이력

1. `80c7501` - feat: Ably 실시간 채팅 및 접속자 목록 기능 추가
2. `faad5ed` - fix: Ably 및 AdSense 오류 수정 및 Presence 기능 개선
3. `67bdeb2` - fix: Presence 접속자 수 표시 문제 해결

## 향후 개선 사항

- [ ] 채팅 메시지 Firebase 저장 (선택적)
- [ ] 사용자 프로필 이미지 표시
- [ ] 채팅 알림 기능
- [ ] 채팅방 분리 (전체/파티 등)
- [ ] 메시지 삭제/수정 기능

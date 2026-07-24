// 브라우저 종료 이벤트는 비동기 저장 완료를 보장하지 않는다.
// 정합성은 행동 직후 저장과 lazy update에만 의존하며, 이 훅은 이전 import 호환용이다.
export function useGameSaveOnLeave() {}

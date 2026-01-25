// src/utils/presenceUtils.js
// 동일 사용자 다중 접속 시 📱/💻 이모지 + #1,#2,#3 (connectionId는 내부 정렬용으로만 사용)

/**
 * 모바일/PC 구분 (가능한 경우 userAgentData, 그 외 userAgent + 터치 힌트)
 * - userAgentData.mobile: Chrome/Edge(Android 등)에서 사용. Safari/iOS Chrome 미지원.
 * - userAgent: iPhone,iPod,iPad,Android,Mobile,webOS,BlackBerry,IEMobile,Opera Mini,Silk 등
 * - iPad 데스크톱 모드: UA가 "Macintosh"인데 maxTouchPoints>1 이면 iPad 가능성으로 모바일 처리
 * - "데스크톱용 웹사이트" 요청 시 UA가 PC로 바뀌어 모바일로 잡히지 않을 수 있음 (한계)
 * @returns {'모바일'|'PC'}
 */
export const getDeviceHint = () => {
  if (typeof navigator === 'undefined') return 'PC';
  const ua = navigator.userAgent || '';
  // 1) userAgentData.mobile (Chrome/Edge Android 등. Safari/iOS는 미지원)
  if (navigator.userAgentData && navigator.userAgentData.mobile === true) return '모바일';
  // 2) userAgent 패턴 (iPod, Silk 추가; iPad 포함)
  if (/iPhone|iPod|iPad|Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini|Silk|BB10|fennec/i.test(ua)) return '모바일';
  // 3) iPad 데스크톱 모드: UA는 Mac인데 터치 포인트 많으면 iPad 추정
  if (/\bMacintosh\b/i.test(ua) && navigator.maxTouchPoints > 1) return '모바일';
  return 'PC';
};

/** deviceHint → 이모지 (connectionId 노출 없음) */
const getDeviceEmoji = (dh) => (dh === '모바일' ? '📱' : '💻');

/**
 * 같은 clientId가 여러 접속일 때 표시명: 휴대폰📱#1, 컴퓨터💻#1 / 중복 시 💻#2, 💻#3
 * connectionId는 정렬·순서 결정에만 사용 (UI에 노출 안 함)
 * @param {{ clientId?: string, connectionId?: string, data?: { deviceHint?: string } }} member
 * @param {typeof member[]} presenceList
 * @returns {string}
 */
export const getPresenceDisplayName = (member, presenceList) => {
  const list = presenceList || [];
  const sameClient = list.filter((m) => (m.clientId || '') === (member.clientId || ''));
  if (sameClient.length <= 1) return member.clientId || 'Unknown';
  const dh = member.data?.deviceHint || '?';
  const sameGroup = sameClient.filter((m) => (m.data?.deviceHint || '?') === dh);
  const sorted = [...sameGroup].sort((a, b) => (a.connectionId || '').localeCompare(b.connectionId || ''));
  const pos = sorted.findIndex((m) => (m.connectionId || '') === (member.connectionId || ''));
  const idx = pos >= 0 ? pos + 1 : 1;
  return `${member.clientId || 'Unknown'} (${getDeviceEmoji(dh)}#${idx})`;
};

/**
 * 발신 시 내 deviceIndex (동일 clientId·동일 deviceHint 내 1-based 순번)
 * connectionId로 순서 결정, UI에는 #1,#2,#3 만 노출
 */
export const getDeviceIndex = (clientId, deviceHint, connectionId, presenceList) => {
  const list = presenceList || [];
  const same = list.filter(
    (m) => (m.clientId || '') === (clientId || '') && (m.data?.deviceHint || '?') === (deviceHint || '?')
  );
  const sorted = [...same].sort((a, b) => (a.connectionId || '').localeCompare(b.connectionId || ''));
  const pos = sorted.findIndex((m) => (m.connectionId || '') === (connectionId || ''));
  return pos >= 0 ? pos + 1 : 1;
};

/** 채팅 메시지용: deviceHint + deviceIndex → (📱#1) or (💻#2) 문자열. 없으면 '' */
export const formatDeviceSuffix = (deviceHint, deviceIndex) => {
  if (!deviceHint && !deviceIndex) return '';
  const emoji = getDeviceEmoji(deviceHint || '?');
  return deviceIndex ? ` (${emoji}#${deviceIndex})` : ` (${emoji})`;
};

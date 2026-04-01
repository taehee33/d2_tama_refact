// src/components/ChatRoom.jsx
// 실시간 채팅 및 접속자 목록 컴포넌트
// - 실시간: Ably | 히스토리(200개/48h): Supabase

import React, { useState, useEffect, useRef } from 'react';
import { useChannel, usePresence, usePresenceListener, useAbly } from 'ably/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../supabase';
import { getDeviceHint, getPresenceDisplayName, getDeviceIndex, formatDeviceSuffix } from '../utils/presenceUtils';
import { formatTimestamp } from '../utils/dateUtils';
import { usePresenceContext } from '../contexts/AblyContext';

const CHANNEL_NAME = 'tamer-lobby';
const MAX_MESSAGES = 200; // 최신 200개 메시지 유지 (48시간 내)
const HISTORY_HOURS = 48; // 48시간 동안의 메시지 히스토리

const uuid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

// Ably 메시지 data 파싱: { text, clientTempId, deviceHint, deviceIndex } (connectionId는 미노출)
const parseAblyData = (data) => {
  if (data == null) return { text: '', clientTempId: null, deviceHint: null, deviceIndex: null };
  if (typeof data === 'object' && data !== null && 'text' in data) {
    return {
      text: String(data.text ?? ''),
      clientTempId: data.clientTempId || null,
      deviceHint: data.deviceHint || null,
      deviceIndex: typeof data.deviceIndex === 'number' ? data.deviceIndex : null,
    };
  }
  return { text: String(data), clientTempId: null, deviceHint: null, deviceIndex: null };
};

// 연결 상태를 확인하고 연결 완료 후에만 ChatRoom을 렌더링하는 래퍼
const getChatContainerClassName = (variant = 'community') => {
  if (variant === 'drawer') {
    return 'play-chat-panel';
  }

  return 'tamer-chat-container bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mt-4';
};

const ChatRoomWithConnectionCheck = ({ variant = 'community' }) => {
  const ably = useAbly();
  const [connectionState, setConnectionState] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!ably) {
      setConnectionState(null);
      return;
    }

    const checkConnection = () => {
      const state = ably.connection.state;
      setConnectionState(state);
      setConnectionError(null);
      
      console.log('🔍 Ably 연결 상태:', state);
      
      if (state === 'connected') {
        console.log('✅ Ably 연결 완료');
        // 타임아웃 클리어
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    // 초기 상태 확인
    checkConnection();

    // 연결 상태 변경 리스너
    const handleStateChange = (stateChange) => {
      console.log('🔄 Ably 상태 변경:', stateChange.current, '이전:', stateChange.previous);
      checkConnection();
    };

    // 연결 실패 핸들러
    const handleFailed = (stateChange) => {
      console.error('❌ Ably 연결 실패:', stateChange);
      setConnectionState('failed');
      setConnectionError(stateChange.reason || '연결에 실패했습니다.');
    };

    // 모든 상태 변경 이벤트 리스너 등록
    ably.connection.on('connected', handleStateChange);
    ably.connection.on('disconnected', handleStateChange);
    ably.connection.on('failed', handleFailed);
    ably.connection.on('suspended', handleStateChange);
    ably.connection.on('closed', handleStateChange);
    ably.connection.on('connecting', handleStateChange);
    ably.connection.on('update', handleStateChange);

    // 연결 타임아웃 설정 (30초)
    timeoutRef.current = setTimeout(() => {
      if (ably.connection.state !== 'connected') {
        console.error('⏱️ Ably 연결 타임아웃');
        setConnectionError('연결 시간이 초과되었습니다. 페이지를 새로고침해주세요.');
        setConnectionState('timeout');
      }
    }, 30000);

    return () => {
      // 타임아웃 클리어
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // 이벤트 리스너 제거
      ably.connection.off('connected', handleStateChange);
      ably.connection.off('disconnected', handleStateChange);
      ably.connection.off('failed', handleFailed);
      ably.connection.off('suspended', handleStateChange);
      ably.connection.off('closed', handleStateChange);
      ably.connection.off('connecting', handleStateChange);
      ably.connection.off('update', handleStateChange);
    };
  }, [ably]);

  // 연결이 완료되지 않았거나 에러가 있는 경우
  if (!ably || connectionState !== 'connected' || connectionError) {
    const getStateMessage = () => {
      if (connectionError) {
        return {
          emoji: '❌',
          title: '연결 실패',
          message: connectionError,
          isError: true
        };
      }
      
      switch (connectionState) {
        case 'connecting':
        case 'initialized':
          return {
            emoji: '🔄',
            title: 'Ably 연결 중...',
            message: '실시간 채팅 기능을 초기화하는 중입니다',
            isError: false
          };
        case 'disconnected':
          return {
            emoji: '⏳',
            title: '연결 끊김',
            message: '다시 연결을 시도하는 중입니다...',
            isError: false
          };
        case 'suspended':
          return {
            emoji: '⏸️',
            title: '연결 일시 중지',
            message: '네트워크 문제로 연결이 일시 중지되었습니다',
            isError: false
          };
        case 'failed':
        case 'timeout':
          return {
            emoji: '❌',
            title: '연결 실패',
            message: connectionError || 'Ably 서버에 연결할 수 없습니다. 페이지를 새로고침해주세요.',
            isError: true
          };
        default:
          return {
            emoji: '🔄',
            title: 'Ably 연결 중...',
            message: '실시간 채팅 기능을 초기화하는 중입니다',
            isError: false
          };
      }
    };

    const stateInfo = getStateMessage();

    return (
      <div className={getChatContainerClassName(variant)}>
        <div className={`text-center text-sm space-y-2 ${stateInfo.isError ? 'text-red-600' : 'text-gray-500'}`}>
          <div className={stateInfo.isError ? '' : 'animate-pulse'}>{stateInfo.emoji}</div>
          <p className={`font-semibold ${stateInfo.isError ? 'text-red-600' : ''}`}>{stateInfo.title}</p>
          <p className="text-xs mt-1">{stateInfo.message}</p>
          {stateInfo.isError && (
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-semibold"
            >
              페이지 새로고침
            </button>
          )}
        </div>
      </div>
    );
  }

  // 연결이 완료되면 ChatRoom 렌더링
  return <ChatRoom variant={variant} />;
};

export const ChatRoom = ({ variant = 'community' }) => {
  const { currentUser } = useAuth();
  const { isChatOpen, setIsChatOpen, unreadCount, setUnreadCount, clearUnreadCount } = usePresenceContext();
  const [messageText, setMessageText] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [presenceStatus, setPresenceStatus] = useState('online'); // online, away, offline
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const chatBoxRef = useRef(null);
  const chatContainerRef = useRef(null);
  const historyLoadedRef = useRef(false); // 히스토리 로드 여부 추적
  const isChatOpenRef = useRef(false); // 클로저 문제 해결을 위한 ref
  const processedMessageIdsRef = useRef(new Set()); // 중복 메시지 처리 방지

  const ably = useAbly();
  const isDrawerVariant = variant === 'drawer';
  const chatContainerClassName = [
    getChatContainerClassName(variant),
    isDrawerVariant ? 'play-chat-panel--drawer' : '',
  ]
    .filter(Boolean)
    .join(' ');
  
  // ChatRoom이 실제로 화면에 보이는지 확인 (Intersection Observer 사용)
  useEffect(() => {
    if (isDrawerVariant) {
      isChatOpenRef.current = isChatOpen;
      if (isChatOpen) {
        clearUnreadCount();
      }
      return undefined;
    }

    const observedNode = chatContainerRef.current;
    if (!observedNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;
        console.log('📱 ChatRoom 가시성 변경:', isVisible ? '보임' : '숨김');
        isChatOpenRef.current = isVisible; // ref 업데이트
        setIsChatOpen(isVisible);
        // 채팅창이 보이면 읽지 않은 메시지 수 초기화
        if (isVisible) {
          console.log('✅ 채팅창이 보임 - 알림 초기화');
          clearUnreadCount();
        }
      },
      {
        threshold: 0.1, // 10% 이상 보이면 "열려있다"고 간주
        rootMargin: '0px',
      }
    );

    observer.observe(observedNode);

    return () => {
      observer.unobserve(observedNode);
    };
  }, [clearUnreadCount, isChatOpen, isDrawerVariant, setIsChatOpen]);

  // unreadCount 디버깅
  useEffect(() => {
    console.log('🔔 unreadCount 변경:', unreadCount);
  }, [unreadCount]);
  
  // 1. 자신의 Presence 관리 (enter/update)
  // usePresence는 자신을 presence set에 추가하고 상태를 업데이트
  // 연결이 완료된 후에만 ChatRoom이 렌더링되므로 안전하게 호출 가능
  const { updateStatus } = usePresence(CHANNEL_NAME, {
    initialData: { status: 'online', joinedAt: new Date().toISOString(), deviceHint: getDeviceHint() }
  });
  
  // 2. 모든 접속자 목록 가져오기 (Presence Listener)
  // usePresenceListener는 모든 presence 멤버의 목록을 실시간으로 제공
  const { presenceData } = usePresenceListener(CHANNEL_NAME);
  
  // 3. 채팅 메시지 수신 (Channel) — 발신은 sendChat에서 Ably + Supabase
  // 주의: useChannel 콜백은 중복 방지를 위해 사용하지 않고, 직접 리스너만 사용
  const { channel } = useChannel(CHANNEL_NAME, () => {
    // useChannel 콜백은 비워두고, 직접 리스너(messageHandler)만 사용하여 중복 처리 방지
  });

  // 4. 채널 상태 모니터링 및 메시지 구독
  // ⚠️ 중요: channel이 선언된 후에 사용해야 함
  useEffect(() => {
    if (!channel || !ably) return;

    // 채널 상태 변경 감지
    const handleStateChange = (stateChange) => {
      console.log('🔄 채널 상태 변경:', stateChange.current, '이전:', stateChange.previous);
      if (stateChange.current === 'detached' || stateChange.current === 'failed') {
        console.log('⏳ 채널이 detached/failed 상태입니다. Presence 정리는 자동으로 처리됩니다.');
      }
    };

    // 채널 상태 이벤트 리스너
    channel.on('attached', () => {
      console.log('✅ 채널 attached - 메시지 구독 준비 완료');
    });
    channel.on('detached', () => {
      console.log('⏳ 채널 detached');
    });
    channel.on('failed', () => {
      console.log('❌ 채널 failed');
    });

    // 채널 직접 리스너 (실시간 보장, 중복 처리 방지)
    const messageHandler = (message) => {
      if (message.name !== 'chat-message') return;
      const { text: msgText, clientTempId, deviceHint, deviceIndex } = parseAblyData(message.data);
      const messageId = clientTempId || message.id || `ably_${message.timestamp}_${message.clientId || ''}_${Math.random()}`;
      const ts = message.timestamp || Date.now();
      const user = message.clientId || 'Unknown';

      // 중복 메시지 처리 방지
      if (processedMessageIdsRef.current.has(messageId)) {
        console.log('⚠️ 중복 메시지 무시:', messageId);
        return;
      }
      processedMessageIdsRef.current.add(messageId);
      
      // Set 크기 제한 (메모리 누수 방지)
      if (processedMessageIdsRef.current.size > 1000) {
        const firstId = Array.from(processedMessageIdsRef.current)[0];
        processedMessageIdsRef.current.delete(firstId);
      }

      // 채팅창이 닫혀있을 때만 읽지 않은 메시지 수 증가
      // 자신이 보낸 메시지는 제외 (clientId 비교)
      const isOwnMessage = user === (ably?.auth?.clientId || 'Unknown');
      // ref를 사용하여 최신 isChatOpen 상태 확인 (클로저 문제 해결)
      if (!isChatOpenRef.current && !isOwnMessage) {
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          console.log('🔔 새 메시지 수신 - 알림 카운트:', prev, '→', newCount, '| isChatOpen:', isChatOpenRef.current, '| isOwnMessage:', isOwnMessage);
          return newCount;
        });
      } else {
        console.log('🔔 새 메시지 수신 - 알림 카운트 증가 안함 | isChatOpen:', isChatOpenRef.current, '| isOwnMessage:', isOwnMessage);
      }

      setChatLog((prev) => {
        if (prev.some(m => m.id === messageId)) return prev;
        const newMessage = {
          id: messageId,
          user,
          text: msgText,
          time: formatTimestamp(ts, 'short'),
          timestamp: ts,
          deviceHint: deviceHint || null,
          deviceIndex: deviceIndex ?? null,
        };
        const next = [...prev, newMessage].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        return next.slice(-MAX_MESSAGES);
      });
    };

    // 채널이 attached 상태일 때 메시지 구독
    const subscribeToMessages = () => {
      if (channel.state === 'attached') {
        console.log('📡 채널에 메시지 구독 시작');
        channel.subscribe('chat-message', messageHandler);
      } else {
        console.log('⏳ 채널이 attached 상태가 아닙니다. 현재 상태:', channel.state);
        // 채널이 attached 상태가 아니면 attach 시도
        channel.attach().then(() => {
          console.log('✅ 채널 attach 완료, 메시지 구독 시작');
          channel.subscribe('chat-message', messageHandler);
        }).catch((error) => {
          console.error('❌ 채널 attach 실패:', error);
        });
      }
    };

    // 초기 구독 시도
    subscribeToMessages();

    // 채널이 attached 상태가 되면 구독
    channel.on('attached', () => {
      console.log('✅ 채널 attached - 메시지 구독 시작');
      channel.subscribe('chat-message', messageHandler);
    });

    return () => {
      // 컴포넌트 언마운트 시 정리
      try {
        console.log('🧹 ChatRoom 언마운트: 메시지 구독 해제');
        channel.unsubscribe('chat-message', messageHandler);
        
        // 이벤트 리스너 제거
        channel.off('attached');
        channel.off('detached');
        channel.off('failed');
        channel.off('update', handleStateChange);
      } catch (error) {
        // detached 상태에서 발생하는 오류는 무시
        if (error.message && !error.message.includes('detached') && !error.message.includes('Channel operation failed')) {
          console.error('채널 정리 오류:', error);
        }
      }
    };
  }, [ably, channel, setUnreadCount]);

  // 5. 초기 히스토리 로드 (Supabase, 48h / 200건)
  useEffect(() => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    setIsLoadingHistory(true);

    const loadHistory = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setChatLog([]);
        setIsLoadingHistory(false);
        return;
      }
      try {
        const since = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id, tamer_name, content, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(MAX_MESSAGES);

        if (error) {
          console.warn('Supabase 채팅 히스토리 로드 실패:', error.message);
          setChatLog([]);
        } else {
          const list = (data || []).reverse().map((m) => ({
            id: m.id,
            user: m.tamer_name || 'Unknown',
            text: m.content,
            time: formatTimestamp(new Date(m.created_at), 'short'),
            timestamp: new Date(m.created_at).getTime(),
          }));
          setChatLog(list);
          // 히스토리 메시지 ID를 processedMessageIdsRef에 추가하여 중복 처리 방지
          list.forEach((msg) => {
            processedMessageIdsRef.current.add(msg.id);
          });
          console.log(`✅ 채팅 히스토리 로드 완료 (Supabase): ${list.length}개`);
        }
      } catch (e) {
        console.warn('채팅 히스토리 로드 예외:', e);
        setChatLog([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, []);

  // Presence 상태 업데이트 함수
  // usePresence의 updateStatus 메서드를 사용
  const updatePresenceStatus = async (newStatus) => {
    if (!updateStatus || !channel) {
      console.warn('⚠️ updateStatus 또는 channel이 사용 불가능합니다.');
      return;
    }
    
    // 채널이 detached 상태면 업데이트하지 않음
    if (channel.state === 'detached' || channel.state === 'failed') {
      console.log('⏳ 채널이 detached/failed 상태입니다. Presence 상태 업데이트를 건너뜁니다.');
      return;
    }
    
    try {
      setPresenceStatus(newStatus);
      // usePresence의 updateStatus 메서드 사용
      await updateStatus({
        status: newStatus,
        updatedAt: new Date().toISOString(),
        deviceHint: getDeviceHint()
      });
      console.log('✅ Presence 상태 업데이트:', newStatus);
    } catch (error) {
      // detached 상태에서 발생하는 오류는 무시
      if (error.message && (error.message.includes('detached') || error.message.includes('Channel operation failed'))) {
        console.log('⏳ 채널이 detached 상태입니다. Presence 상태 업데이트를 건너뜁니다.');
      } else {
        console.error('❌ Presence 상태 업데이트 실패:', error);
      }
    }
  };

  // 채팅 로그가 업데이트될 때마다 스크롤을 맨 아래로
  // React Hooks 규칙: 모든 hooks는 조건부 return 이전에 호출되어야 함
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatLog]);

  // Presence 데이터 변경 감지 및 디버깅
  useEffect(() => {
    if (ably && presenceData) {
      console.log('✅ ChatRoom 렌더링됨, 접속자 수:', presenceData.length);
      console.log('📊 Presence 데이터:', presenceData.map(p => ({
        clientId: p.clientId,
        status: p.data?.status || 'online',
        joinedAt: p.data?.joinedAt || 'unknown'
      })));
    }
  }, [ably, presenceData]);

  // Presence 이벤트 리스너 설정 (디버깅용)
  // usePresenceListener가 자동으로 처리하지만, 추가 로깅을 위해 설정
  useEffect(() => {
    if (!channel) return;

    // Presence 이벤트 리스너 (디버깅용)
    const enterHandler = (presenceMessage) => {
      console.log('👋 사용자 입장:', presenceMessage.clientId, presenceMessage.data);
    };

    const leaveHandler = (presenceMessage) => {
      console.log('👋 사용자 퇴장:', presenceMessage.clientId);
    };

    const updateHandler = (presenceMessage) => {
      console.log('🔄 사용자 상태 업데이트:', presenceMessage.clientId, presenceMessage.data);
    };

    channel.presence.subscribe('enter', enterHandler);
    channel.presence.subscribe('leave', leaveHandler);
    channel.presence.subscribe('update', updateHandler);

    // 클린업
    return () => {
      try {
        // 채널이 detached 상태가 아닐 때만 정리 작업 수행
        if (channel && channel.state !== 'detached' && channel.state !== 'failed') {
          channel.presence.unsubscribe('enter', enterHandler);
          channel.presence.unsubscribe('leave', leaveHandler);
          channel.presence.unsubscribe('update', updateHandler);
        }
      } catch (error) {
        // detached 상태에서 발생하는 오류는 무시
        if (error.message && !error.message.includes('detached')) {
          console.error('Presence 정리 실패:', error);
        }
      }
    };
  }, [channel]);

  // Ably 클라이언트가 없으면 렌더링하지 않음 (모든 hooks 호출 후)
  if (!ably) {
    return (
      <div className={getChatContainerClassName(variant)}>
        <div className="text-center text-gray-500 text-sm space-y-2">
          <div className="animate-pulse">🔄</div>
          <p>Ably 연결 중... (실시간 채팅 기능을 초기화하는 중입니다)</p>
          <p className="text-xs mt-1">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  const sendChat = async () => {
    const text = messageText.trim();
    if (!text || !channel) return;

    if (channel.state !== 'attached' && channel.state !== 'attaching') {
      try {
        await channel.attach();
      } catch (e) {
        console.error('채널 attach 실패:', e);
        return;
      }
    }

    const id = uuid();
    const tamerName = ably?.auth?.clientId || 'Unknown';
    const ts = Date.now();
    const deviceHint = getDeviceHint();
    const connId = ably?.connection?.id || '';
    const deviceIndex = getDeviceIndex(tamerName, deviceHint, connId, presenceData || []);

    // 1) 낙관적 추가 (Ably echo 시 clientTempId로 dedup)
    setChatLog((prev) => {
      const next = [...prev, {
        id,
        user: tamerName,
        text,
        time: formatTimestamp(ts, 'short'),
        timestamp: ts,
        deviceHint: deviceHint || null,
        deviceIndex: deviceIndex || null,
      }].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      return next.slice(-MAX_MESSAGES);
    });
    setMessageText('');

    // 2) Ably 실시간 전송 (deviceHint, deviceIndex. connectionId는 미포함)
    try {
      await channel.publish('chat-message', { text, clientTempId: id, deviceHint, deviceIndex });
    } catch (e) {
      console.error('Ably 전송 실패:', e);
      setChatLog((prev) => prev.filter((m) => m.id !== id));
      alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    // 3) Supabase 저장 (firebase_uid로 Firebase 사용자와 매칭)
    if (isSupabaseConfigured() && supabase) {
      supabase
        .from('chat_messages')
        .insert([{
          id,
          tamer_name: tamerName,
          content: text,
          firebase_uid: currentUser?.uid ?? null,
        }])
        .then(({ error }) => {
          if (error) console.warn('Supabase 채팅 저장 실패:', error.message);
        });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  const presenceControl = (
    <div className="presence-control play-chat-panel__presence mb-3 pb-3 border-b border-gray-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">내 상태:</span>
          <select
            value={presenceStatus}
            onChange={(e) => updatePresenceStatus(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
          >
            <option value="online">🟢 온라인</option>
            <option value="away">🟡 자리비움</option>
            <option value="offline">⚫ 오프라인</option>
          </select>
        </div>
        <span className="text-xs text-gray-500">
          접속자: {presenceData?.length || 0}명
        </span>
      </div>
    </div>
  );

  const onlineList = (
    <div className="online-list play-chat-panel__online-list mb-4">
      <h4 className="text-sm font-bold text-gray-700 mb-2">
        🟢 접속 중인 테이머 ({presenceData?.length || 0})
      </h4>
      <div className="flex flex-wrap gap-2">
        {presenceData && presenceData.length > 0 ? (
          presenceData.map((member, idx) => {
            const memberStatus = member.data?.status || 'online';
            const statusEmoji = memberStatus === 'online' ? '🟢' : memberStatus === 'away' ? '🟡' : '⚫';
            const statusColor = memberStatus === 'online'
              ? 'bg-green-100 text-green-800'
              : memberStatus === 'away'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800';
            const displayName = getPresenceDisplayName(member, presenceData);
            const uniqueKey = `${member.clientId || 'unknown'}_${member.connectionId || member.timestamp || idx}_${idx}`;

            return (
              <span
                key={uniqueKey}
                className={`px-2 py-1 ${statusColor} rounded text-xs font-semibold flex items-center gap-1`}
                title={`상태: ${memberStatus === 'online' ? '온라인' : memberStatus === 'away' ? '자리비움' : '오프라인'}`}
              >
                <span>{statusEmoji}</span>
                <span>{displayName}</span>
              </span>
            );
          })
        ) : (
          <span className="text-xs text-gray-500">접속 중인 테이머가 없습니다.</span>
        )}
      </div>
    </div>
  );

  const chatBox = (
    <div
      className="chat-box play-chat-panel__messages bg-white border border-gray-300 rounded p-3 mb-3"
      style={isDrawerVariant ? { overflowY: 'scroll' } : { height: '200px', overflowY: 'scroll' }}
      ref={chatBoxRef}
    >
      {isLoadingHistory ? (
        <div className="text-center text-gray-400 text-sm py-8">
          <div className="animate-pulse">📜</div>
          <p className="mt-2">채팅 히스토리 로드 중... (48시간)</p>
        </div>
      ) : chatLog.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-8">
          채팅 메시지가 없습니다. 첫 메시지를 보내보세요!
        </div>
      ) : (
        chatLog.map((msg) => {
          const namePart = formatDeviceSuffix(msg.deviceHint, msg.deviceIndex);
          return (
            <div key={msg.id} className="mb-2 text-sm">
              <span className="font-bold text-blue-600">{msg.user}{namePart}:</span>{' '}
              <span className="text-gray-700">{msg.text}</span>
              <span className="text-xs text-gray-400 ml-2">{msg.time}</span>
            </div>
          );
        })
      )}
    </div>
  );

  const composer = isDrawerVariant ? (
    <div className="play-chat-panel__composer-shell">
      <div className="play-chat-panel__composer-grid">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="메시지를 입력하세요..(enter로 전송, 메세지는 200개 까지 48시간 후에 사라집니다.)"
          className="play-chat-panel__composer-input px-3 py-2 border border-gray-300 rounded text-sm"
        />
        <button
          onClick={sendChat}
          disabled={!messageText.trim()}
          className="play-chat-panel__composer-submit px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
        >
          전송
        </button>
      </div>
    </div>
  ) : (
    <div className="flex gap-2">
      <input
        type="text"
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="메시지를 입력하세요..(enter로 전송, 메세지는 200개 까지 48시간 후에 사라집니다.)"
        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
      />
      <button
        onClick={sendChat}
        disabled={!messageText.trim()}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
      >
        전송
      </button>
    </div>
  );

  if (isDrawerVariant) {
    return (
      <div ref={chatContainerRef} className={chatContainerClassName}>
        <div className="play-chat-panel__scroll play-chat-panel__scroll--drawer">
          {presenceControl}
          {onlineList}
          {chatBox}
        </div>
        <div className="play-chat-panel__composer play-chat-panel__composer--sticky">
          {composer}
        </div>
      </div>
    );
  }

  return (
    <div ref={chatContainerRef} className={chatContainerClassName}>
      {presenceControl}
      {onlineList}
      {chatBox}
      {composer}
    </div>
  );
};

export default ChatRoomWithConnectionCheck;

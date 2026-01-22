// src/components/ChatRoom.jsx
// 실시간 채팅 및 접속자 목록 컴포넌트

import React, { useState, useEffect, useRef } from 'react';
import { useChannel, usePresence, usePresenceListener, useAbly } from 'ably/react';

const CHANNEL_NAME = 'tamer-lobby';
const MAX_MESSAGES = 200; // 최신 200개 메시지 유지 (48시간 내)
const HISTORY_HOURS = 48; // 48시간 동안의 메시지 히스토리

// 연결 상태를 확인하고 연결 완료 후에만 ChatRoom을 렌더링하는 래퍼
const ChatRoomWithConnectionCheck = () => {
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
      <div className="tamer-chat-container bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mt-4">
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
  return <ChatRoom />;
};

const ChatRoom = () => {
  const [messageText, setMessageText] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [presenceStatus, setPresenceStatus] = useState('online'); // online, away, offline
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const chatBoxRef = useRef(null);
  const historyLoadedRef = useRef(false); // 히스토리 로드 여부 추적

  // Ably 클라이언트 확인 (AblyProvider 내부에서만 호출되어야 함)
  // React Hooks 규칙: 항상 같은 순서로 호출해야 하므로 조건부로 호출하지 않음
  const ably = useAbly();
  
  // 1. 자신의 Presence 관리 (enter/update)
  // usePresence는 자신을 presence set에 추가하고 상태를 업데이트
  // 연결이 완료된 후에만 ChatRoom이 렌더링되므로 안전하게 호출 가능
  const { updateStatus } = usePresence(CHANNEL_NAME, {
    initialData: { status: 'online', joinedAt: new Date().toISOString() }
  });
  
  // 2. 모든 접속자 목록 가져오기 (Presence Listener)
  // usePresenceListener는 모든 presence 멤버의 목록을 실시간으로 제공
  const { presenceData } = usePresenceListener(CHANNEL_NAME);
  
  // 3. 채팅 메시지 수신 및 발신 (Channel)
  // ChannelProvider 내부에서도 channelName을 명시적으로 전달해야 함
  // ⚠️ 중요: useChannel을 먼저 선언하여 channel 변수를 확보해야 함
  const { channel } = useChannel(CHANNEL_NAME, (message) => {
    console.log('📨 메시지 수신:', message);
    console.log('📨 메시지 데이터:', {
      name: message.name,
      data: message.data,
      clientId: message.clientId,
      timestamp: message.timestamp,
      id: message.id
    });
    
    // 메시지 이름이 'chat-message'인지 확인
    if (message.name !== 'chat-message') {
      console.log('⏭️ 다른 이벤트 메시지, 무시:', message.name);
      return;
    }
    
    // 히스토리에서 이미 로드된 메시지인지 확인 (중복 방지)
    const messageId = message.id || `ably_${message.timestamp}_${Math.random()}`;
    
    setChatLog((prev) => {
      // 중복 메시지 체크
      if (prev.some(msg => msg.id === messageId || (msg.timestamp && msg.timestamp === message.timestamp && msg.user === (message.clientId || 'Unknown')))) {
        console.log('⏭️ 중복 메시지, 무시:', messageId);
        return prev;
      }
      
      const newMessage = {
        id: messageId,
        user: message.clientId || 'Unknown',
        text: message.data,
        time: message.timestamp 
          ? new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: message.timestamp || Date.now(),
      };
      
      console.log('✅ 새 메시지 추가:', newMessage);
      
      const newLog = [
        ...prev,
        newMessage,
      ];
      // 시간순으로 정렬
      newLog.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      // 최신 MAX_MESSAGES개만 유지
      return newLog.slice(-MAX_MESSAGES);
    });
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

    // 채널에 직접 메시지 리스너 추가 (실시간 업데이트 보장)
    const messageHandler = (message) => {
      console.log('📨 채널 메시지 리스너에서 수신:', message);
      console.log('📨 메시지 상세:', {
        name: message.name,
        data: message.data,
        clientId: message.clientId,
        timestamp: message.timestamp,
        id: message.id
      });
      
      // 메시지 이름이 'chat-message'인지 확인
      if (message.name !== 'chat-message') {
        console.log('⏭️ 다른 이벤트 메시지, 무시:', message.name);
        return;
      }
      
      // 히스토리에서 이미 로드된 메시지인지 확인 (중복 방지)
      const messageId = message.id || `ably_${message.timestamp}_${Math.random()}`;
      
      setChatLog((prev) => {
        // 중복 메시지 체크
        if (prev.some(msg => msg.id === messageId || (msg.timestamp && msg.timestamp === message.timestamp && msg.user === (message.clientId || 'Unknown')))) {
          console.log('⏭️ 중복 메시지, 무시:', messageId);
          return prev;
        }
        
        const newMessage = {
          id: messageId,
          user: message.clientId || 'Unknown',
          text: message.data,
          time: message.timestamp 
            ? new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: message.timestamp || Date.now(),
        };
        
        console.log('✅ 새 메시지 추가 (채널 리스너):', newMessage);
        
        const newLog = [
          ...prev,
          newMessage,
        ];
        // 시간순으로 정렬
        newLog.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        // 최신 MAX_MESSAGES개만 유지
        return newLog.slice(-MAX_MESSAGES);
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
  }, [channel, ably]);

  // 5. 채널이 준비되면 히스토리 로드
  useEffect(() => {
    if (!channel || historyLoadedRef.current) return;

    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true);
        historyLoadedRef.current = true;

        // 48시간 전의 타임스탬프 계산
        const hoursAgo = HISTORY_HOURS * 60 * 60 * 1000;
        const startTime = Date.now() - hoursAgo;

        console.log('📜 채팅 히스토리 로드 중... (48시간)');

        // 채널이 attach될 때까지 대기
        await channel.attach();

        // 히스토리 가져오기 (48시간 전부터)
        const historyPage = await channel.history({ 
          start: startTime,
          limit: MAX_MESSAGES 
        });

        const historyMessages = [];
        
        // 첫 페이지 처리
        if (historyPage.items && historyPage.items.length > 0) {
          historyPage.items.forEach((message) => {
            historyMessages.push({
              id: message.id || `history_${message.timestamp}_${Math.random()}`,
              user: message.clientId || 'Unknown',
              text: message.data,
              time: message.timestamp 
                ? new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              timestamp: message.timestamp || Date.now(),
            });
          });
        }

        // 추가 페이지가 있으면 모두 가져오기
        let currentPage = historyPage;
        while (currentPage.hasNext()) {
          currentPage = await currentPage.next();
          if (currentPage.items && currentPage.items.length > 0) {
            currentPage.items.forEach((message) => {
              historyMessages.push({
                id: message.id || `history_${message.timestamp}_${Math.random()}`,
                user: message.clientId || 'Unknown',
                text: message.data,
                time: message.timestamp 
                  ? new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                  : new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                timestamp: message.timestamp || Date.now(),
              });
            });
          }
        }

        // 시간순으로 정렬 (오래된 것부터)
        historyMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // 중복 제거
        const uniqueMessages = historyMessages.reduce((acc, msg) => {
          if (!acc.find(m => m.id === msg.id || (m.timestamp === msg.timestamp && m.user === msg.user && m.text === msg.text))) {
            acc.push(msg);
          }
          return acc;
        }, []);

        setChatLog(uniqueMessages);
        console.log(`✅ 채팅 히스토리 로드 완료: ${uniqueMessages.length}개 메시지`);
        setIsLoadingHistory(false);
      } catch (error) {
        console.error('❌ 채팅 히스토리 로드 오류:', error);
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [channel]);

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
        updatedAt: new Date().toISOString()
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
      <div className="tamer-chat-container bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mt-4">
        <div className="text-center text-gray-500 text-sm space-y-2">
          <div className="animate-pulse">🔄</div>
          <p>Ably 연결 중... (실시간 채팅 기능을 초기화하는 중입니다)</p>
          <p className="text-xs mt-1">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  const sendChat = async () => {
    const message = messageText.trim();
    
    if (!message) {
      console.warn('⚠️ 빈 메시지는 전송할 수 없습니다.');
      return;
    }
    
    if (!channel) {
      console.error('❌ 채널이 없습니다. Ably 연결을 확인해주세요.');
      return;
    }
    
    // 채널 상태 확인
    if (channel.state !== 'attached' && channel.state !== 'attaching') {
      console.warn('⚠️ 채널이 attached 상태가 아닙니다. 현재 상태:', channel.state);
      try {
        // 채널을 attach 시도
        await channel.attach();
        console.log('✅ 채널 attach 완료');
      } catch (error) {
        console.error('❌ 채널 attach 실패:', error);
        return;
      }
    }
    
    try {
      console.log('📤 메시지 전송 시도:', message);
      await channel.publish('chat-message', message);
      console.log('✅ 메시지 전송 성공:', message);
      setMessageText('');
    } catch (error) {
      console.error('❌ 메시지 전송 실패:', error);
      alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  return (
    <div className="tamer-chat-container bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mt-4">
      {/* Presence 상태 컨트롤 */}
      <div className="presence-control mb-3 pb-3 border-b border-gray-300">
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

      {/* 온라인 테이머 목록 */}
      <div className="online-list mb-4">
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
              
              // 고유한 key 생성: clientId + connectionId (또는 timestamp) + index
              const uniqueKey = `${member.clientId || 'unknown'}_${member.connectionId || member.timestamp || idx}_${idx}`;
              
              return (
                <span
                  key={uniqueKey}
                  className={`px-2 py-1 ${statusColor} rounded text-xs font-semibold flex items-center gap-1`}
                  title={`상태: ${memberStatus === 'online' ? '온라인' : memberStatus === 'away' ? '자리비움' : '오프라인'}`}
                >
                  <span>{statusEmoji}</span>
                  <span>{member.clientId || 'Unknown'}</span>
                </span>
              );
            })
          ) : (
            <span className="text-xs text-gray-500">접속 중인 테이머가 없습니다.</span>
          )}
        </div>
      </div>

      {/* 채팅창 */}
      <div className="chat-box bg-white border border-gray-300 rounded p-3 mb-3" 
           style={{ height: '200px', overflowY: 'auto' }}
           ref={chatBoxRef}>
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
          chatLog.map((msg) => (
            <div key={msg.id} className="mb-2 text-sm">
              <span className="font-bold text-blue-600">{msg.user}:</span>{' '}
              <span className="text-gray-700">{msg.text}</span>
              <span className="text-xs text-gray-400 ml-2">{msg.time}</span>
            </div>
          ))
        )}
      </div>

      {/* 메시지 입력 */}
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
    </div>
  );
};

export default ChatRoomWithConnectionCheck;

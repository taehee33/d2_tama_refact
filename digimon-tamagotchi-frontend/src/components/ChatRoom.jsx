// src/components/ChatRoom.jsx
// 실시간 채팅 및 접속자 목록 컴포넌트

import React, { useState, useEffect, useRef } from 'react';
import { useChannel, usePresence, usePresenceListener, useAbly } from 'ably/react';

const CHANNEL_NAME = 'tamer-lobby';
const MAX_MESSAGES = 50; // 최신 50개 메시지만 유지

const ChatRoom = () => {
  const [messageText, setMessageText] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [presenceStatus, setPresenceStatus] = useState('online'); // online, away, offline
  const chatBoxRef = useRef(null);

  // Ably 클라이언트 확인 (AblyProvider 내부에서만 호출되어야 함)
  // React Hooks 규칙: 항상 같은 순서로 호출해야 하므로 조건부로 호출하지 않음
  const ably = useAbly();
  
  // 1. 자신의 Presence 관리 (enter/update)
  // usePresence는 자신을 presence set에 추가하고 상태를 업데이트
  const { updateStatus } = usePresence(CHANNEL_NAME, {
    initialData: { status: 'online', joinedAt: new Date().toISOString() }
  });
  
  // 2. 모든 접속자 목록 가져오기 (Presence Listener)
  // usePresenceListener는 모든 presence 멤버의 목록을 실시간으로 제공
  const { presenceData } = usePresenceListener(CHANNEL_NAME);
  
  // 3. 채팅 메시지 수신 및 발신 (Channel)
  // ChannelProvider 내부에서도 channelName을 명시적으로 전달해야 함
  const { channel } = useChannel(CHANNEL_NAME, (message) => {
    setChatLog((prev) => {
      const newLog = [
        ...prev,
        {
          id: message.id || Date.now() + Math.random(),
          user: message.clientId || 'Unknown',
          text: message.data,
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ];
      // 최신 MAX_MESSAGES개만 유지
      return newLog.slice(-MAX_MESSAGES);
    });
  });

  // Presence 상태 업데이트 함수
  // usePresence의 updateStatus 메서드를 사용
  const updatePresenceStatus = async (newStatus) => {
    if (!updateStatus) {
      console.warn('⚠️ updateStatus가 사용 불가능합니다.');
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
      console.error('❌ Presence 상태 업데이트 실패:', error);
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
        channel.presence.unsubscribe('enter', enterHandler);
        channel.presence.unsubscribe('leave', leaveHandler);
        channel.presence.unsubscribe('update', updateHandler);
      } catch (error) {
        console.error('Presence 정리 실패:', error);
      }
    };
  }, [channel]);

  // Ably 클라이언트가 없으면 렌더링하지 않음 (모든 hooks 호출 후)
  if (!ably) {
    console.warn('⚠️ ChatRoom: Ably 클라이언트가 없습니다.');
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

  const sendChat = () => {
    if (messageText.trim() !== '' && channel) {
      channel.publish('chat-message', messageText.trim());
      setMessageText('');
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
              
              return (
                <span
                  key={member.clientId || idx}
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
        {chatLog.length === 0 ? (
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
          placeholder="메시지를 입력하세요... (Enter로 전송)"
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

export default ChatRoom;

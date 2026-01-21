// src/components/ChatRoom.jsx
// 실시간 채팅 및 접속자 목록 컴포넌트

import React, { useState, useEffect, useRef } from 'react';
import { useChannel, usePresence, useAbly } from 'ably/react';

const CHANNEL_NAME = 'tamer-lobby';
const MAX_MESSAGES = 50; // 최신 50개 메시지만 유지

const ChatRoom = () => {
  const [messageText, setMessageText] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const chatBoxRef = useRef(null);

  // Ably 클라이언트 확인 (AblyProvider 내부에서만 호출되어야 함)
  // React Hooks 규칙: 항상 같은 순서로 호출해야 하므로 조건부로 호출하지 않음
  const ably = useAbly();
  
  // 1. 실시간 접속자 목록 가져오기 (Presence)
  const { presenceData } = usePresence(CHANNEL_NAME);
  
  // 2. 채팅 메시지 수신 및 발신 (Channel)
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

  // 채팅 로그가 업데이트될 때마다 스크롤을 맨 아래로
  // React Hooks 규칙: 모든 hooks는 조건부 return 이전에 호출되어야 함
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatLog]);

  // 디버깅: ChatRoom이 렌더링되었는지 확인
  // React Hooks 규칙: 모든 hooks는 조건부 return 이전에 호출되어야 함
  useEffect(() => {
    if (ably) {
      console.log('✅ ChatRoom 렌더링됨, 접속자 수:', presenceData?.length || 0);
    }
  }, [ably, presenceData]);

  // Ably 클라이언트가 없으면 렌더링하지 않음 (모든 hooks 호출 후)
  if (!ably) {
    console.warn('⚠️ ChatRoom: Ably 클라이언트가 없습니다.');
    return (
      <div className="tamer-chat-container bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mt-4">
        <div className="text-center text-gray-500 text-sm">
          Ably 연결 중... (실시간 채팅 기능을 초기화하는 중입니다)
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
      {/* 온라인 테이머 목록 */}
      <div className="online-list mb-4">
        <h4 className="text-sm font-bold text-gray-700 mb-2">
          🟢 접속 중인 테이머 ({presenceData?.length || 0})
        </h4>
        <div className="flex flex-wrap gap-2">
          {presenceData && presenceData.length > 0 ? (
            presenceData.map((member, idx) => (
              <span
                key={member.clientId || idx}
                className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold"
              >
                {member.clientId || 'Unknown'}
              </span>
            ))
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

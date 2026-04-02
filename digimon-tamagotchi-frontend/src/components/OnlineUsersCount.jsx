// src/components/OnlineUsersCount.jsx
// 접속 중인 테이머 수 표시 컴포넌트

import React, { useState, useRef, useEffect } from 'react';
import { usePresenceContext } from '../contexts/AblyContext';
import { getPresenceDisplayName } from '../utils/presenceUtils';

const OnlineUsersCount = ({ showChatShortcut = true }) => {
  const { presenceData, presenceCount, unreadCount, setIsChatOpen } = usePresenceContext();
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef(null);
  const buttonRef = useRef(null);

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showPopup &&
        popupRef.current &&
        !popupRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowPopup(false);
      }
    };

    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPopup]);

  if (presenceCount === 0) {
    return null; // 접속자가 없으면 표시하지 않음
  }

  const handleClick = () => {
    const newShowPopup = !showPopup;
    setShowPopup(newShowPopup);
  };

  // 채팅 아이콘 클릭 시 채팅창으로 스크롤
  const handleChatClick = () => {
    // 채팅창 컨테이너 찾기
    const chatContainer = document.querySelector('.tamer-chat-container');
    if (chatContainer) {
      chatContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
      setShowPopup(false);
      return;
    }

    setShowPopup(false);
    setIsChatOpen(true);
  };

  return (
    <div className="flex items-center gap-2">
      {showChatShortcut && (
        <button
          onClick={handleChatClick}
          className="relative px-2 py-1.5 bg-blue-100 text-blue-800 border border-gray-800 rounded text-xs font-semibold hover:bg-blue-200 transition-colors cursor-pointer"
          title="채팅으로 이동"
        >
          <span className="text-base">💬</span>
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold px-1"
              style={{ lineHeight: '1' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* 접속자 수 버튼 */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleClick}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-green-100 text-green-800 border border-gray-800 rounded text-xs font-semibold hover:bg-green-200 transition-colors cursor-pointer"
        >
          <span>🟢</span>
          <span>{presenceCount}명</span>
          <span className="text-xs text-gray-600">▼</span>
        </button>

        {/* 플로팅 팝업 */}
        {showPopup && (
          <div
            ref={popupRef}
            className="absolute top-full left-0 mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px] max-w-[300px]"
            style={{ maxHeight: '400px', overflowY: 'auto' }}
          >
            <div className="p-3">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700">
                  🟢 접속 중인 테이머 ({presenceCount}명)
                </h3>
                <button
                  onClick={() => setShowPopup(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2">
                {presenceData && presenceData.length > 0 ? (
                  presenceData.map((member, idx) => {
                    const memberStatus = member.data?.status || 'online';
                    const statusEmoji = memberStatus === 'online' ? '🟢' : memberStatus === 'away' ? '🟡' : '⚫';
                    const statusText = memberStatus === 'online' ? '온라인' : memberStatus === 'away' ? '자리비움' : '오프라인';
                    const statusColor = memberStatus === 'online' 
                      ? 'text-green-600' 
                      : memberStatus === 'away' 
                      ? 'text-yellow-600' 
                      : 'text-gray-600';
                    const displayName = getPresenceDisplayName(member, presenceData);
                    const uniqueKey = `${member.clientId || 'unknown'}_${member.connectionId || member.timestamp || idx}_${idx}`;
                    
                    return (
                      <div
                        key={uniqueKey}
                        className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-base">{statusEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">
                            {displayName}
                          </div>
                          <div className={`text-xs ${statusColor}`}>
                            {statusText}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-500 text-center py-2">
                    접속 중인 테이머가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineUsersCount;

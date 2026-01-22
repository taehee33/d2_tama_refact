// src/contexts/AblyContext.jsx
// Ably 실시간 통신 컨텍스트

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as Ably from 'ably';
import { AblyProvider } from 'ably/react';

const AblyContext = createContext(null);

export const useAblyContext = () => {
  const context = useContext(AblyContext);
  return context;
};

export const AblyContextProvider = ({ children, tamerName, renderChatRoom }) => {
  const [ablyClient, setAblyClient] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    const ablyKey = process.env.REACT_APP_ABLY_KEY;
    
    if (!ablyKey) {
      console.warn('REACT_APP_ABLY_KEY가 설정되지 않았습니다. Ably 기능이 비활성화됩니다.');
      setAblyClient(null);
      return;
    }

    // 테이머명을 clientId로 사용 (없으면 Anonymous)
    // clientId는 반드시 문자열이어야 하며, Presence 기능에 필수
    const clientId = tamerName && String(tamerName).trim() 
      ? String(tamerName).trim() 
      : `Guest_${Math.floor(Math.random() * 10000)}`;
    
    console.log('🔑 Ably clientId 설정:', clientId);

    // 기존 클라이언트가 있고 clientId가 같으면 재사용
    if (clientRef.current) {
      try {
        const currentClientId = clientRef.current.auth?.clientId;
        if (currentClientId === clientId) {
          // 같은 clientId면 재사용
          return;
        }
      } catch (error) {
        // auth 접근 실패 시 새로 생성
      }
      // clientId가 다르면 기존 클라이언트 정리
      if (clientRef.current) {
        try {
          clientRef.current.close();
        } catch (error) {
          console.error('Ably 클라이언트 종료 실패:', error);
        }
      }
      clientRef.current = null;
      setAblyClient(null);
    }

    try {
      // Ably 클라이언트 생성 (v2.0+에서는 Realtime.Promise가 제거됨)
      // Ably v2.0+에서는 모든 비동기 메서드가 기본적으로 Promise를 반환
      const client = new Ably.Realtime({
        key: ablyKey,
        clientId: clientId,
      });
      
      clientRef.current = client;
      setAblyClient(client);
      console.log('✅ Ably 클라이언트 생성 완료:', clientId);
      
      // 연결 상태 확인
      client.connection.on('connected', () => {
        console.log('✅ Ably 연결 성공:', clientId);
      });
      
      client.connection.on('failed', () => {
        console.error('❌ Ably 연결 실패:', clientId);
      });
    } catch (error) {
      console.error('❌ Ably 클라이언트 생성 실패:', error);
      setAblyClient(null);
    }

    // 클린업
    return () => {
      // 약간의 지연을 주어 ChatRoom 컴포넌트가 먼저 정리되도록 함
      setTimeout(() => {
        if (clientRef.current) {
          try {
            // 모든 채널을 먼저 detach
            const channels = clientRef.current.channels;
            if (channels) {
              channels.forEach((channel) => {
                try {
                  if (channel.state === 'attached' || channel.state === 'attaching') {
                    channel.detach().catch(() => {
                      // detach 실패는 무시 (이미 detached 상태일 수 있음)
                    });
                  }
                } catch (error) {
                  // 채널 detach 오류는 무시
                }
              });
            }
            
            // 클라이언트 종료
            clientRef.current.close();
          } catch (error) {
            // detached 상태에서 발생하는 오류는 무시
            if (error.message && !error.message.includes('detached') && !error.message.includes('Channel operation failed')) {
              console.error('Ably 클라이언트 종료 실패:', error);
            }
          }
          clientRef.current = null;
        }
        setAblyClient(null);
      }, 100); // 100ms 지연
    };
  }, [tamerName]);

  // Ably 클라이언트가 없으면 children만 렌더링 (AblyProvider 없이)
  // 하지만 renderChatRoom이 있으면 연결 중 메시지 표시
  if (!ablyClient) {
    const ablyKey = process.env.REACT_APP_ABLY_KEY;
    const hasKey = !!ablyKey;
    const hasTamerName = !!tamerName;
    
    return (
      <>
        {children}
        {renderChatRoom && (
          <div className="tamer-chat-container bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mt-4">
            <div className="text-center text-gray-500 text-sm space-y-2">
              {!hasKey ? (
                <div>
                  <p className="text-red-600 font-semibold">⚠️ Ably API Key가 설정되지 않았습니다.</p>
                  <p className="text-xs mt-1">REACT_APP_ABLY_KEY 환경 변수를 확인해주세요.</p>
                </div>
              ) : !hasTamerName ? (
                <div>
                  <p className="text-yellow-600 font-semibold">⚠️ 테이머명이 없습니다.</p>
                  <p className="text-xs mt-1">로그인 후 실시간 채팅 기능을 사용할 수 있습니다.</p>
                </div>
              ) : (
                <div>
                  <div className="animate-pulse">🔄</div>
                  <p>Ably 연결 중... (실시간 채팅 기능을 초기화하는 중입니다)</p>
                  <p className="text-xs mt-1">잠시만 기다려주세요...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // AblyProvider로 감싸서 children과 함께 렌더링
  // renderChatRoom이 있으면 AblyProvider 내부에서만 렌더링
  // children도 AblyProvider 내부에 있어야 ChatRoom이 useAbly를 사용할 수 있음
  return (
    <AblyProvider client={ablyClient}>
      <AblyContext.Provider value={ablyClient}>
        {children}
        {renderChatRoom && renderChatRoom()}
      </AblyContext.Provider>
    </AblyProvider>
  );
};

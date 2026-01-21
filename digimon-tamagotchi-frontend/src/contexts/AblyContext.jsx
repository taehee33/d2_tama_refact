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
    const clientId = tamerName || 'Anonymous';

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
      // Ably 클라이언트 생성 (Realtime.Promise 사용)
      // Ably v2.0+에서는 클라이언트가 연결되기 전에도 AblyProvider에 전달 가능
      const client = new Ably.Realtime.Promise({
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
      if (clientRef.current) {
        try {
          clientRef.current.close();
        } catch (error) {
          console.error('Ably 클라이언트 종료 실패:', error);
        }
        clientRef.current = null;
      }
      setAblyClient(null);
    };
  }, [tamerName]);

  // Ably 클라이언트가 없으면 children만 렌더링 (AblyProvider 없이)
  // 하지만 renderChatRoom이 있으면 연결 중 메시지 표시
  if (!ablyClient) {
    return (
      <>
        {children}
        {renderChatRoom && (
          <div className="tamer-chat-container bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mt-4">
            <div className="text-center text-gray-500 text-sm">
              Ably 연결 중... (실시간 채팅 기능을 초기화하는 중입니다)
            </div>
          </div>
        )}
      </>
    );
  }

  // AblyProvider로 감싸서 children과 함께 렌더링
  // renderChatRoom이 있으면 AblyProvider 내부에서만 렌더링
  return (
    <AblyProvider client={ablyClient}>
      <AblyContext.Provider value={ablyClient}>
        {children}
        {renderChatRoom && renderChatRoom()}
      </AblyContext.Provider>
    </AblyProvider>
  );
};

// src/contexts/AblyContext.jsx
// Ably 실시간 통신 컨텍스트

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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
  const tamerNameRef = useRef(null);
  const cleanupTimeoutRef = useRef(null);

  // clientId 계산 (tamerName이 없으면 익명 사용자용 ID 생성)
  const clientId = useMemo(() => {
    if (tamerName && String(tamerName).trim()) {
      return String(tamerName).trim();
    }
    // 익명 사용자의 경우 고유한 ID 생성 (세션 유지)
    if (!tamerNameRef.current) {
      tamerNameRef.current = `Guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }
    return tamerNameRef.current;
  }, [tamerName]);

  useEffect(() => {
    const ablyKey = process.env.REACT_APP_ABLY_KEY;
    
    if (!ablyKey) {
      console.warn('REACT_APP_ABLY_KEY가 설정되지 않았습니다. Ably 기능이 비활성화됩니다.');
      setAblyClient(null);
      return;
    }

    console.log('🔑 Ably clientId 설정:', clientId);

    // 기존 클라이언트가 있고 clientId가 같으면 재사용 (싱글톤 유지)
    if (clientRef.current) {
      try {
        const currentClientId = clientRef.current.auth?.clientId;
        if (currentClientId === clientId) {
          // 같은 clientId면 재사용 (새로 생성하지 않음)
          console.log('♻️ 기존 Ably 클라이언트 재사용:', clientId);
          return;
        } else {
          // clientId가 다르면 기존 클라이언트 정리
          console.log('🔄 clientId 변경 감지, 기존 클라이언트 정리:', currentClientId, '->', clientId);
          try {
            // 기존 클라이언트 정리
            const oldClient = clientRef.current;
            const channelsObj = oldClient.channels;
            if (channelsObj) {
              try {
                const knownChannel = channelsObj.get('tamer-lobby');
                if (knownChannel) {
                  knownChannel.detach().catch(() => {});
                }
              } catch (error) {
                // 무시
              }
            }
            oldClient.close();
          } catch (error) {
            console.error('기존 Ably 클라이언트 종료 실패:', error);
          }
          clientRef.current = null;
          setAblyClient(null);
        }
      } catch (error) {
        // auth 접근 실패 시 새로 생성
        console.warn('기존 클라이언트 확인 실패, 새로 생성:', error);
        if (clientRef.current) {
          try {
            clientRef.current.close();
          } catch (e) {
            // 무시
          }
        }
        clientRef.current = null;
        setAblyClient(null);
      }
    }

    // 새 클라이언트 생성
    try {
      console.log('🆕 새로운 Ably 클라이언트 생성:', clientId);
      
      // Ably 클라이언트 생성 (싱글톤으로 유지)
      const client = new Ably.Realtime({
        key: ablyKey,
        clientId: clientId, // Presence 기능을 위해 필수
        echoMessages: false, // 자신이 보낸 메시지는 수신하지 않음
        autoConnect: true, // 자동 연결
      });
      
      clientRef.current = client;
      setAblyClient(client);
      console.log('✅ Ably 클라이언트 생성 완료:', clientId);
      console.log('🔍 초기 연결 상태:', client.connection.state);
      
      // 연결 상태 확인 및 로깅
      const handleConnected = () => {
        console.log('✅ Ably 연결 성공:', clientId);
      };
      
      const handleConnecting = () => {
        console.log('🔄 Ably 연결 시도 중...', clientId);
      };
      
      const handleDisconnected = () => {
        console.log('⏳ Ably 연결 끊김:', clientId);
      };
      
      const handleSuspended = () => {
        console.log('⏸️ Ably 연결 일시 중지:', clientId);
      };
      
      const handleFailed = (stateChange) => {
        console.error('❌ Ably 연결 실패:', clientId, stateChange);
      };
      
      const handleClosed = () => {
        console.log('🔒 Ably 연결 종료:', clientId);
      };
      
      const handleUpdate = (stateChange) => {
        console.log('🔄 Ably 상태 변경:', stateChange.current, '이전:', stateChange.previous);
      };

      // 이벤트 리스너 등록
      client.connection.on('connected', handleConnected);
      client.connection.on('connecting', handleConnecting);
      client.connection.on('disconnected', handleDisconnected);
      client.connection.on('suspended', handleSuspended);
      client.connection.on('failed', handleFailed);
      client.connection.on('closed', handleClosed);
      client.connection.on('update', handleUpdate);

      // 클린업 함수
      return () => {
        // 이벤트 리스너 제거
        client.connection.off('connected', handleConnected);
        client.connection.off('connecting', handleConnecting);
        client.connection.off('disconnected', handleDisconnected);
        client.connection.off('suspended', handleSuspended);
        client.connection.off('failed', handleFailed);
        client.connection.off('closed', handleClosed);
        client.connection.off('update', handleUpdate);

        // 클린업 타임아웃 정리
        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
        }

        // 약간의 지연을 주어 ChatRoom 컴포넌트가 먼저 정리되도록 함
        cleanupTimeoutRef.current = setTimeout(() => {
          if (clientRef.current === client) {
            try {
              // 특정 채널이 있다면 직접 detach
              const channelsObj = client.channels;
              if (channelsObj) {
                try {
                  const knownChannel = channelsObj.get('tamer-lobby');
                  if (knownChannel) {
                    if (knownChannel.state === 'attached' || knownChannel.state === 'attaching') {
                      knownChannel.detach().catch(() => {});
                    }
                  }
                } catch (error) {
                  // 무시
                }
              }
              
              // 클라이언트 종료 (이것이 모든 채널을 자동으로 정리함)
              client.close();
            } catch (error) {
              if (error.message && !error.message.includes('detached') && !error.message.includes('Channel operation failed')) {
                console.error('Ably 클라이언트 종료 실패:', error);
              }
            }
            if (clientRef.current === client) {
              clientRef.current = null;
            }
            setAblyClient(null);
          }
        }, 100);
      };
    } catch (error) {
      console.error('❌ Ably 클라이언트 생성 실패:', error);
      setAblyClient(null);
    }
  }, [clientId]); // tamerName 대신 clientId를 dependency로 사용

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

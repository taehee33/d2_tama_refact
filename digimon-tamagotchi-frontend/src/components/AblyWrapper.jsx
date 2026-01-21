// src/components/AblyWrapper.jsx
// Ably 컨텍스트를 제공하는 래퍼 컴포넌트
// 테이머명이 로드된 후에만 Ably를 초기화

import React from 'react';
import { AblyContextProvider } from '../contexts/AblyContext';
import ChatRoom from './ChatRoom';

const AblyWrapper = ({ tamerName, children }) => {
  // Ably API Key가 없으면 AblyProvider 없이 렌더링
  const ablyKey = process.env.REACT_APP_ABLY_KEY;
  
  // Ably가 없거나 테이머명이 없으면 children만 렌더링
  if (!ablyKey || !tamerName) {
    return <>{children}</>;
  }

  return (
    <AblyContextProvider 
      tamerName={tamerName}
      renderChatRoom={() => <ChatRoom />}
    >
      {children}
    </AblyContextProvider>
  );
};

export default AblyWrapper;

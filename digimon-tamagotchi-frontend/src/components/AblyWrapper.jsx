// src/components/AblyWrapper.jsx
// Ably 컨텍스트를 제공하는 래퍼 컴포넌트
// 테이머명이 로드된 후에만 Ably를 초기화

import React from 'react';
import { ChannelProvider } from 'ably/react';
import { AblyContextProvider } from '../contexts/AblyContext';
import ChatRoom from './ChatRoom';

const CHANNEL_NAME = 'tamer-lobby';

const AblyWrapper = ({ tamerName, children }) => {
  // 테이머명이 없으면 인증된 Ably clientId를 만들 수 없다.
  if (!tamerName) {
    return <>{children}</>;
  }

  return (
    <AblyContextProvider 
      tamerName={tamerName}
      renderChatRoom={() => (
        <ChannelProvider channelName={CHANNEL_NAME}>
          <ChatRoom />
        </ChannelProvider>
      )}
    >
      {children}
    </AblyContextProvider>
  );
};

export default AblyWrapper;

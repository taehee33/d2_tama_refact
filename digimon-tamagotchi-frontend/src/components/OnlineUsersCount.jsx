// src/components/OnlineUsersCount.jsx
// 접속 중인 테이머 수 표시 컴포넌트

import React from 'react';
import { usePresenceContext } from '../contexts/AblyContext';

const OnlineUsersCount = () => {
  const { presenceData, presenceCount } = usePresenceContext();

  if (presenceCount === 0) {
    return null; // 접속자가 없으면 표시하지 않음
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
      <span>🟢</span>
      <span>접속: {presenceCount}명</span>
    </div>
  );
};

export default OnlineUsersCount;

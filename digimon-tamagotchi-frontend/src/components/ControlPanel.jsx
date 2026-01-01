// src/components/ControlPanel.jsx
import React from "react";
import MenuIconButtons from "./MenuIconButtons";
import StatsPanel from "./StatsPanel";

/**
 * ControlPanel 컴포넌트
 * 하단 메뉴 버튼들(밥, 훈련, 배틀 등 아이콘 버튼)과 스탯 패널을 포함하는 컨트롤 영역
 */
const ControlPanel = ({
  // 크기
  width = 300,
  height = 200,
  
  // 메뉴 관련
  activeMenu = null,
  onMenuClick = () => {},
  
  // 스탯 관련
  stats = {},
  sleepStatus = "AWAKE",
}) => {
  return (
    <div className="flex justify-center items-center space-x-4 mt-2">
      <StatsPanel stats={stats} sleepStatus={sleepStatus} />
      <MenuIconButtons
        width={width}
        height={height}
        activeMenu={activeMenu}
        onMenuClick={onMenuClick}
      />
    </div>
  );
};

export default ControlPanel;


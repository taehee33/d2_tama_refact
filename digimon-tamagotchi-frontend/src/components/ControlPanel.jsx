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
  
  // 모바일 여부
  isMobile = false,
}) => {
  return (
    <div className={isMobile 
      ? "flex flex-col items-center gap-4 mt-2 w-full control-panel-mobile" 
      : "flex justify-center items-center space-x-4 mt-2"
    }>
      <div className={isMobile ? "w-full stats-panel-mobile" : ""}>
        <StatsPanel stats={stats} sleepStatus={sleepStatus} isMobile={isMobile} />
      </div>
      <div className={isMobile ? "w-full menu-icon-buttons-mobile" : ""}>
        <MenuIconButtons
          width={width}
          height={height}
          activeMenu={activeMenu}
          onMenuClick={onMenuClick}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
};

export default ControlPanel;


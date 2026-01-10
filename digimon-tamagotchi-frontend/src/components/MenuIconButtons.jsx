import React from "react";
import IconButton from "./IconButton";
import "../styles/MenuIconButtons.css";

const MenuIconButtons = ({ width, height, activeMenu, onMenuClick, isMobile = false }) => {
  const iconPath = (iconName) => {
    const iconMap = {
      status: "/images/190.png",
      eat: "/images/192.png",
      train: "/images/194.png",
      battle: "/images/196.png",
      bathroom: "/images/198.png",
      electric: "/images/200.png",
      heal: "/images/202.png",
      callSign: "/images/204.png",
    };
    return iconMap[iconName];
  };

  const menuLabel = (menuName) => {
    const labelMap = {
      status: "스탯",
      eat: "식사",
      train: "훈련",
      battle: "배틀",
      bathroom: "화장실",
      electric: "전기",
      heal: "치료",
      callSign: "호출",
    };
    return labelMap[menuName] || "";
  };

  // 모바일: 그리드 레이아웃
  if (isMobile) {
    const allMenus = ["status", "eat", "train", "battle", "bathroom", "electric", "heal", "callSign"];
    return (
      <div className="menu-icon-buttons-mobile">
        {allMenus.map((menu) => (
          <IconButton
            key={menu}
            icon={iconPath(menu)}
            onClick={() => onMenuClick(menu)}
            isActive={activeMenu === menu}
            width={60}
            height={60}
            className="icon-button-mobile touch-button"
            label={menuLabel(menu)}
          />
        ))}
      </div>
    );
  }

  // 데스크톱: 4x2 그리드 레이아웃
  const allMenus = [
    ["status", "eat", "train", "battle"],
    ["bathroom", "electric", "heal", "callSign"]
  ];

  return (
    <div className="menu-icon-buttons">
      <div className="game-container menu-grid-container" style={{ width: `${width}px` }}>
        {allMenus.map((row, rowIdx) => (
          <div key={rowIdx} className="menu-grid-row">
            {row.map((menu) => (
              <div key={menu} className="menu-grid-cell">
                <IconButton
                  icon={iconPath(menu)}
                  onClick={() => onMenuClick(menu)}
                  isActive={activeMenu === menu}
                  width={60}
                  height={60}
                  label={menuLabel(menu)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuIconButtons;

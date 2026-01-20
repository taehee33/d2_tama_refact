import React from "react";
import IconButton from "./IconButton";
import "../styles/MenuIconButtons.css";

const MenuIconButtons = ({ width, height, activeMenu, onMenuClick, isMobile = false, isFrozen = false }) => {
  const iconPath = (iconName) => {
    const iconMap = {
      status: "/images/190.png",
      eat: "/images/192.png",
      train: "/images/194.png",
      battle: "/images/196.png",
      communication: "/images/502.png",
      bathroom: "/images/198.png",
      electric: "/images/200.png",
      heal: "/images/202.png",
      callSign: "/images/204.png",
      extra: "/images/556.png",
    };
    return iconMap[iconName];
  };

  const menuLabel = (menuName) => {
    const labelMap = {
      status: "스탯",
      eat: "식사",
      train: "훈련",
      battle: "배틀",
      communication: "교감",
      bathroom: "화장실",
      electric: "전기",
      heal: "치료",
      callSign: "호출",
      extra: "추가기능",
    };
    return labelMap[menuName] || "";
  };

  // 냉장고 상태일 때 비활성화할 메뉴
  const disabledMenus = isFrozen ? ['eat', 'train'] : [];

  // 모바일: 그리드 레이아웃
  if (isMobile) {
    const allMenus = ["status", "eat", "train", "battle", "communication", "bathroom", "electric", "heal", "callSign", "extra"];
    return (
      <div className="menu-icon-buttons-mobile">
        {allMenus.map((menu) => (
          <IconButton
            key={menu}
            icon={iconPath(menu)}
            onClick={() => onMenuClick(menu)}
            isActive={activeMenu === menu}
            disabled={disabledMenus.includes(menu)}
            width={60}
            height={60}
            className="icon-button-mobile touch-button"
            label={menuLabel(menu)}
          />
        ))}
      </div>
    );
  }

  // 데스크톱: 5x2 그리드 레이아웃
  const allMenus = [
    ["status", "eat", "train", "battle", "communication"],
    ["bathroom", "electric", "heal", "callSign", "extra"] // 10번째 그리드에 추가 기능 메뉴
  ];

  return (
    <div className="menu-icon-buttons">
      <div className="game-container menu-grid-container" style={{ width: `${width}px` }}>
        {allMenus.map((row, rowIdx) => (
          <div key={rowIdx} className="menu-grid-row">
            {row.map((menu, colIdx) => (
              <div key={menu || `empty-${rowIdx}-${colIdx}`} className="menu-grid-cell">
                {menu ? (
                  <IconButton
                    icon={iconPath(menu)}
                    onClick={() => onMenuClick(menu)}
                    isActive={activeMenu === menu}
                    disabled={disabledMenus.includes(menu)}
                    width={60}
                    height={60}
                    label={menuLabel(menu)}
                  />
                ) : (
                  <div style={{ width: '60px', height: '60px' }}></div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuIconButtons;

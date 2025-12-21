import React from "react";
import IconButton from "./IconButton";
import "../styles/MenuIconButtons.css";

const MenuIconButtons = ({ width, height, activeMenu, onMenuClick }) => {
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

  return (
    <div className="menu-icon-buttons">
      <div className="game-container" style={{ position: "relative", width: `${width}px`, height: `${height}px` }}>
        {/* 상단 메뉴 */}
        <div className="top-row" style={{ position: "absolute", top: "0", width: "100%" }}>
          {["status", "eat", "train", "battle"].map((menu, idx) => (
            <IconButton
              key={menu}
              icon={iconPath(menu)}
              onClick={() => onMenuClick(menu)}
              isActive={activeMenu === menu}
              width={40}
              height={40}
              style={{
                position: "absolute",
                left: `${10 + idx * 20}%`
              }}
            />
          ))}
        </div>

        {/* 하단 메뉴 */}
        <div className="bottom-row" style={{ position: "absolute", bottom: "0", width: "100%" }}>
          {["bathroom", "electric", "heal", "callSign"].map((menu, idx) => (
            <IconButton
              key={menu}
              icon={iconPath(menu)}
              onClick={() => onMenuClick(menu)}
              isActive={activeMenu === menu}
              width={40}
              height={40}
              style={{
                position: "absolute",
                left: `${10 + idx * 20}%`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MenuIconButtons;

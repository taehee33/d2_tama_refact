import React from "react";

const IconButton = ({ icon, onClick, isActive, width, height, className = "" }) => {
  const iconPath = icon;  // 아이콘 경로

  const buttonStyle = {
    border: isActive ? "2px solid #ffcc00" : "2px solid transparent", // 활성화된 상태에 테두리 추가
    padding: "10px",
    cursor: "pointer",
    background: isActive ? "#f0f0f0" : "transparent", // 활성화된 상태 배경색
    width: `${width}px`, // 슬라이더 값에 따라 버튼 크기 조정
    height: `${height}px`, // 슬라이더 값에 따라 버튼 크기 조정
  };

  return (
    <div className={`icon-button ${className}`} onClick={onClick} style={buttonStyle}>
      <img
        src={iconPath}  // 경로에 맞는 아이콘 이미지 사용
        alt="아이콘"
        style={{
          width: "100%", // 아이콘 크기를 버튼에 맞게 조정
          height: "100%", // 아이콘 크기를 버튼에 맞게 조정
        }}
      />
    </div>
  );
};

// IconButton 컴포넌트를 기본으로 export
export default IconButton;

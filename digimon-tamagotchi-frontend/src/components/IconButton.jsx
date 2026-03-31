import React from "react";

const IconButton = ({
  icon,
  onClick,
  isActive,
  width,
  height,
  className = "",
  label = "",
  style = {},
  disabled = false,
  isMobile = false,
}) => {
  const iconPath = icon;  // 아이콘 경로
  const hasLabel = Boolean(label);
  const labelExtraHeight = hasLabel ? (isMobile ? 16 : 20) : 0;
  const imageHeight = hasLabel ? (isMobile ? "68%" : "70%") : "100%";
  const labelMarginTop = isMobile ? "2px" : "4px";

  const buttonStyle = {
    border: isActive ? "2px solid #ffcc00" : "2px solid transparent", // 활성화된 상태에 테두리 추가
    padding: isMobile ? "8px" : "10px",
    cursor: disabled ? "not-allowed" : "pointer",
    background: isActive ? "#f0f0f0" : "transparent", // 활성화된 상태 배경색
    opacity: disabled ? 0.5 : 1, // 비활성화 시 투명도
    width: `${width}px`, // 슬라이더 값에 따라 버튼 크기 조정
    height: `${height + labelExtraHeight}px`, // 라벨이 있으면 높이 추가
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    ...style, // 전달된 style 병합
  };

  return (
    <div 
      className={`icon-button ${className} ${disabled ? 'disabled' : ''}`} 
      onClick={disabled ? undefined : onClick} 
      style={buttonStyle}
    >
      <img
        src={iconPath}  // 경로에 맞는 아이콘 이미지 사용
        alt="아이콘"
        style={{
          width: "100%", // 아이콘 크기를 버튼에 맞게 조정
          height: imageHeight, // 라벨이 있으면 아이콘 높이 조정
          objectFit: "contain",
        }}
      />
      {hasLabel && (
        <span style={{
          fontSize: "10px",
          marginTop: labelMarginTop,
          color: isActive ? "#333" : "#666",
          fontWeight: isActive ? "bold" : "normal",
          textAlign: "center",
          lineHeight: "1.2",
        }}>
          {label}
        </span>
      )}
    </div>
  );
};

// IconButton 컴포넌트를 기본으로 export
export default IconButton;

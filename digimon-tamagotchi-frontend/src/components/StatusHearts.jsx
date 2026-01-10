// src/components/StatusHearts.jsx
import React from "react";

/**
 * StatusHearts 컴포넌트
 * Fullness(고기)와 Strength(단백질) 상태를 하트 아이콘으로 비주얼하게 표시
 */
const StatusHearts = ({ 
  fullness = 0, 
  strength = 0,
  maxOverfeed = 0,
  proteinOverdose = 0, // 단백질 과다 복용 수치 (0-7)
  proteinCount = 0, // 단백질 누적 개수
  showLabels = true,
  size = "md", // "sm" | "md" | "lg"
  position = "top-left", // "top-left" | "top-right" | "bottom-left" | "bottom-right" | "inline"
}) => {
  // 하트 크기 설정
  const heartSize = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  }[size] || "text-lg";

  // 기본 하트 수 (0-5)
  const baseFullness = Math.min(5, fullness);
  const overfeed = fullness > 5 ? fullness - 5 : 0;
  
  // Strength 초과분 계산 (proteinCount가 5 이상일 때)
  const strengthOver = proteinCount > 5 ? proteinCount - 5 : 0;
  
  // 하트 렌더링 함수
  const renderHearts = (value, max = 5, color = "red", label = "") => {
    const hearts = [];
    
    // 기본 하트 (0-5)
    for (let i = 0; i < max; i++) {
      if (i < value) {
        // 채워진 하트
        const heartColor = color === "red" ? "text-red-500" : "text-blue-500";
        hearts.push(
          <span 
            key={i} 
            className={`${heartSize} ${heartColor}`}
            style={{ 
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))',
              display: 'inline-block',
            }}
          >
            ❤️
          </span>
        );
      } else {
        // 빈 하트 (회색 테두리)
        hearts.push(
          <span 
            key={i} 
            className={`${heartSize} text-gray-300`}
            style={{ 
              opacity: 0.5,
              display: 'inline-block',
            }}
          >
            🤍
          </span>
        );
      }
    }
    
    return (
      <div className="flex items-center gap-1">
        {showLabels && label && (
          <span className="text-xs font-semibold text-gray-700 mr-1">{label}:</span>
        )}
        <div className="flex items-center gap-0.5">
          {hearts}
        </div>
      </div>
    );
  };

  // 오버피드 하트 렌더링
  const renderOverfeed = () => {
    if (overfeed <= 0) return null;
    
    return (
      <div className="flex items-center gap-1 ml-2">
        <span className="text-xs text-gray-500 font-bold">+</span>
        {Array.from({ length: Math.min(overfeed, maxOverfeed || 10) }).map((_, i) => (
          <span 
            key={i} 
            className={`${heartSize} text-orange-500`}
            style={{ 
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))',
              display: 'inline-block',
            }}
          >
            🧡
          </span>
        ))}
      </div>
    );
  };

  // Strength 초과분 하트 렌더링 (proteinCount가 5 이상일 때)
  // proteinOverdose가 있을 때는 💊 표시
  // proteinCount가 9, 13, 17, 21, 25, 29, 33일 때는 ⚠️ 표시
  const renderStrengthOver = () => {
    if (strengthOver <= 0) return null;
    
    // proteinCount가 9, 13, 17, 21, 25, 29, 33 중 하나인지 확인
    const overdoseTriggerPoints = [9, 13, 17, 21, 25, 29, 33];
    const isOverdoseTrigger = overdoseTriggerPoints.includes(proteinCount);
    
    // 각 하트의 위치에 따라 아이콘 결정
    // proteinCount가 9면 첫 번째 하트에 ⚠️, 13이면 두 번째 하트에 ⚠️ 등
    const getIconForIndex = (index) => {
      // 현재 하트의 proteinCount 위치 계산 (5 + index + 1)
      const currentProteinCount = 5 + index + 1;
      if (overdoseTriggerPoints.includes(currentProteinCount)) {
        return '⚠️';
      }
      // proteinOverdose가 있으면 💊 표시
      if (proteinOverdose > 0) {
        return '💊';
      }
      return '💊'; // 기본값
    };
    
    return (
      <div className="flex items-center gap-1 ml-2">
        <span className="text-xs text-gray-500 font-bold">+</span>
        {Array.from({ length: strengthOver }).map((_, i) => {
          const icon = getIconForIndex(i);
          return (
            <span 
              key={i} 
              className={`${heartSize} text-orange-500`}
              style={{ 
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))',
                display: 'inline-block',
              }}
            >
              {icon}
            </span>
          );
        })}
      </div>
    );
  };

  // 단백질 과다 복용 경고 렌더링
  const renderProteinOverdose = () => {
    if (proteinOverdose <= 0) return null;
    
    // 수치에 따른 색상 결정
    let warningColor = "text-yellow-600"; // 0-2: 노란색
    if (proteinOverdose >= 6) {
      warningColor = "text-red-600"; // 6-7: 빨간색
    } else if (proteinOverdose >= 3) {
      warningColor = "text-orange-600"; // 3-5: 주황색
    }
    
    // 부상 확률 계산 (패배 시)
    const injuryChance = Math.min(80, 10 + proteinOverdose * 10);
    
    return (
      <div className="flex items-center gap-1 ml-2">
        <span 
          className={`${heartSize} ${warningColor}`}
          style={{ 
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))',
            display: 'inline-block',
            animation: proteinOverdose >= 5 ? 'pulse 2s infinite' : 'none',
          }}
          title={`Protein Overdose: ${proteinOverdose}/7 (Injury Risk: +${injuryChance - 10}%)`}
        >
          [*🤢💉
        </span>
        <span className="text-xs font-bold text-red-600">
          (x{proteinOverdose})]
        </span>
      </div>
    );
  };

  // 인라인 레이아웃 (StatsPanel 등에서 사용)
  if (position === "inline") {
    return (
      <div className="flex flex-col gap-2">
        {/* Fullness (고기) */}
        <div className="flex items-center">
          {renderHearts(baseFullness, 5, "red", showLabels ? "🍖 Fullness" : "")}
          {renderOverfeed()}
        </div>
        
        {/* Strength (단백질) */}
        <div className="flex items-center">
          {renderHearts(strength, 5, "blue", showLabels ? "💪 Strength" : "")}
          {renderStrengthOver()}
          {renderProteinOverdose()}
        </div>
      </div>
    );
  }

  // 절대 위치 레이아웃 (GameScreen 등에서 사용)
  const positionStyles = {
    "top-left": { top: 8, left: 8 },
    "top-right": { top: 8, right: 8 },
    "bottom-left": { bottom: 8, left: 8 },
    "bottom-right": { bottom: 8, right: 8 },
  }[position] || { top: 8, left: 8 };

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles,
        zIndex: 4,
        background: "rgba(255, 255, 255, 0.9)",
        padding: "8px 12px",
        borderRadius: 8,
        border: "2px solid #333",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      }}
    >
      <div className="flex flex-col gap-2">
        {/* Fullness (고기) */}
        <div className="flex items-center">
          {renderHearts(baseFullness, 5, "red", showLabels ? "🍖" : "")}
          {renderOverfeed()}
        </div>
        
        {/* Strength (단백질) */}
        <div className="flex items-center">
          {renderHearts(strength, 5, "blue", showLabels ? "💪" : "")}
          {renderStrengthOver()}
          {renderProteinOverdose()}
        </div>
      </div>
    </div>
  );
};

export default StatusHearts;


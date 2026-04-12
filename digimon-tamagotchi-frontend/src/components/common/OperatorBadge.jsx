import React from "react";

function OperatorBadge({ compact = false, children = "운영자" }) {
  return (
    <span className={`operator-badge${compact ? " operator-badge--compact" : ""}`}>
      {children}
    </span>
  );
}

export default OperatorBadge;

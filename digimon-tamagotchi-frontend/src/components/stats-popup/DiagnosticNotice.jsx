import React from "react";

export default function DiagnosticNotice({ children }) {
  if (!children) return null;

  return (
    <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {children}
    </div>
  );
}

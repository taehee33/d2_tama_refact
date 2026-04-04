import React from "react";
import EncyclopediaPanel from "./panels/EncyclopediaPanel";

export default function EncyclopediaModal({
  currentDigimonId,
  onClose,
  developerMode = false,
  encyclopediaShowQuestionMark = true,
}) {
  const modalStyle = {
    width: "90%",
    minWidth: "300px",
    maxWidth: "1200px",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      style={{ padding: "20px" }}
    >
      <div
        data-testid="encyclopedia-modal"
        className="flex max-h-[90vh] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        style={modalStyle}
      >
        <div className="flex items-center justify-between border-b border-gray-300 p-4">
          <h2 className="text-2xl font-bold">도감</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl font-bold text-gray-600 hover:text-red-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <EncyclopediaPanel
            currentDigimonId={currentDigimonId}
            developerMode={developerMode}
            encyclopediaShowQuestionMark={encyclopediaShowQuestionMark}
          />
        </div>
      </div>
    </div>
  );
}

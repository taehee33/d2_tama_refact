// src/components/DeathPopup.jsx
import React from "react";

export default function DeathPopup({ onConfirm, reason }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
        <h2 className="text-3xl font-bold text-red-600 mb-4">
          YOUR DIGIMON HAS DIED
        </h2>
        {reason && (
          <p className="text-sm text-gray-600 mb-6">
            Cause: {reason}
          </p>
        )}
        <div className="flex gap-4 justify-center">
          <button
            onClick={onConfirm}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors"
          >
            사망 확인
          </button>
        </div>
      </div>
    </div>
  );
}


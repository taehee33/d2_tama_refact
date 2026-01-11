// src/components/FeedPopup.jsx
import React from "react";

export default function FeedPopup({ onClose, onSelect }){
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" style={{ padding: '20px' }}>
      <div className="bg-white p-6 rounded shadow-md" style={{ 
        width: '90%', 
        maxWidth: '400px',
        margin: 'auto'
      }}>
        <h2 className="text-xl font-bold mb-4">먹이 주기</h2>
        <div className="flex flex-col space-y-4">
          <button
            className="px-4 py-2 bg-red-400 text-white rounded"
            onClick={()=>onSelect("meat")}
          >
            고기 먹이기
          </button>
          <button
            className="px-4 py-2 bg-green-400 text-white rounded"
            onClick={()=>onSelect("protein")}
          >
            단백질 먹이기
          </button>
          <button
            className="px-4 py-2 bg-gray-400 text-white rounded"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
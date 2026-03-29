// src/components/DigimonMasterDataModal.jsx
// 설정에서 여는 디지몬 마스터 데이터 전용 모달

import React from "react";
import DigimonMasterDataPanel from "./DigimonMasterDataPanel";

export default function DigimonMasterDataModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">디지몬 마스터 데이터</h2>
            <p className="text-sm text-slate-400">
              설정의 개발자 옵션에서 여는 전역 관리자 편집 화면입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
          >
            닫기
          </button>
        </div>

        <DigimonMasterDataPanel />
      </div>
    </div>
  );
}

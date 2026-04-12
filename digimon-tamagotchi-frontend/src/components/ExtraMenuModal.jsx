// src/components/ExtraMenuModal.jsx
// 추가 기능 메뉴 모달

import React from "react";
import "../styles/Battle.css";
import { getGroupedGameMenus, MENU_SURFACES } from "../constants/gameMenus";

export default function ExtraMenuModal({ 
  onClose,
  onOpenSettings,
  onOpenCollection,
  onOpenActivityLog,
  onOpenBattleLog,
  onOpenEncyclopedia,
  onOpenFridge,
}) {
  const groupedMenus = getGroupedGameMenus(MENU_SURFACES.EXTRA);
  const actionMap = {
    activityLog: onOpenActivityLog,
    battleLog: onOpenBattleLog,
    encyclopedia: onOpenEncyclopedia,
    fridge: onOpenFridge,
    collection: onOpenCollection,
    settings: onOpenSettings,
  };

  const groupStyleMap = {
    records: "border-emerald-300 bg-emerald-50",
    reference: "border-violet-300 bg-violet-50",
    storage: "border-cyan-300 bg-cyan-50",
    system: "border-slate-300 bg-slate-50",
  };

  const buttonStyleMap = {
    records: "bg-emerald-600 hover:bg-emerald-700",
    reference: "bg-violet-600 hover:bg-violet-700",
    storage: "bg-cyan-600 hover:bg-cyan-700",
    system: "bg-slate-600 hover:bg-slate-700",
  };

  const handleSelect = (menuId) => {
    actionMap[menuId]?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 p-3"
      onClick={onClose}
    >
      <div
        className="battle-modal battle-modal--interactive extra-menu-modal bg-white rounded-2xl shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-menu-modal-title"
      >
        <div className="battle-modal__header">
          <h2 id="extra-menu-modal-title" className="text-xl font-bold text-slate-900">
            추가 기능
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="battle-modal__close"
            aria-label="추가 기능 닫기"
          >
            ✕
          </button>
        </div>

        <div className="battle-modal__body extra-menu-modal__body flex flex-col space-y-4">
          {groupedMenus.map((group) => (
            <section
              key={group.id}
              className={`extra-menu-modal__section rounded-xl border p-4 ${groupStyleMap[group.id] || "border-slate-200 bg-slate-50"}`}
              aria-label={group.label}
            >
              <h3 className="mb-3 text-sm font-bold tracking-wide text-slate-700">{group.label}</h3>
              <div className="extra-menu-modal__actions flex flex-col gap-3">
                {group.menus.map((menu) => (
                  <button
                    key={menu.id}
                    onClick={() => handleSelect(menu.id)}
                    className={`extra-menu-modal__action flex items-center justify-between gap-3 rounded-lg px-4 py-3 font-bold text-white transition-colors ${buttonStyleMap[group.id] || "bg-slate-600 hover:bg-slate-700"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden="true">
                        {menu.icon}
                      </span>
                      <span>{menu.label}</span>
                    </span>
                    <span className="text-xs font-medium text-white/80">열기</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <button
            onClick={onClose}
            className="px-6 py-3 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// src/components/DigimonStatusDetailModal.jsx
import React from "react";
import {
  DIGIMON_STATUS_CATEGORY_META,
  DIGIMON_STATUS_CATEGORY_ORDER,
} from "./digimonStatusMessages";

/**
 * DigimonStatusDetailModal 컴포넌트
 * 상단 요약에서 접힌 상태까지 포함해 전체 상태를 카테고리별로 보여줍니다.
 */
const DigimonStatusDetailModal = ({
  statusMessages = [],
  onClose,
}) => {
  const groupedMessages = DIGIMON_STATUS_CATEGORY_ORDER.map((category) => ({
    category,
    meta: DIGIMON_STATUS_CATEGORY_META[category],
    messages: statusMessages.filter((message) => message.category === category),
  })).filter((section) => section.messages.length > 0);

  return (
    <div
      className="digimon-status-detail-modal fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="digimon-status-detail-modal__surface bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto pixel-art-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="digimon-status-detail-modal__content p-6">
          <div className="digimon-status-detail-modal__header flex justify-between items-start gap-4 mb-5">
            <div>
              <h2 className="digimon-status-detail-modal__title text-2xl font-bold text-slate-900">디지몬 상태 상세</h2>
              <p className="digimon-status-detail-modal__description text-sm text-slate-500 mt-1">
                상단 요약에서 접힌 상태까지 모두 모아 보여드려요.
              </p>
            </div>
            <button
              onClick={onClose}
              className="digimon-status-detail-modal__close text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none"
              aria-label="상태 상세 닫기"
            >
              ✕
            </button>
          </div>

          {groupedMessages.length === 0 ? (
            <div className="digimon-status-detail-modal__empty rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-500">
              지금은 표시할 상태가 없어요.
            </div>
          ) : (
            <div className="digimon-status-detail-modal__sections">
              {groupedMessages.map(({ category, meta, messages }) => (
                <section
                  key={category}
                  className={`digimon-status-detail-modal__section rounded-2xl border px-4 py-4 ${meta.containerClass}`}
                >
                  <div className="mb-3">
                    <h3 className={`text-base font-bold ${meta.titleClass}`}>{meta.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{meta.description}</p>
                  </div>
                  <div className="space-y-2">
                    {messages.map((message) => (
                      <article
                        key={message.id}
                        className="digimon-status-detail-modal__message rounded-xl border border-white/80 bg-white/80 px-3 py-3 shadow-sm"
                      >
                        <div className={`font-semibold ${message.color}`}>{message.text}</div>
                        {message.detailHint && (
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {message.detailHint}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div className="digimon-status-detail-modal__footer mt-6 text-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-700 text-white rounded-full font-semibold hover:bg-slate-800 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigimonStatusDetailModal;

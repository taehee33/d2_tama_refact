// src/components/DeckBuildingModal.jsx
// 배틀 덱 편집 모달: 카드 풀에서 추가/제거, Firestore에 저장

import React, { useState, useMemo } from "react";
import {
  BATTLE_CARD_POOL,
  BATTLE_CARD_BY_ID,
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  DEFAULT_BATTLE_DECK,
} from "../data/battleCards";

export default function DeckBuildingModal({
  onClose,
  battleDeck = [],
  setBattleDeck,
  saveBattleDeck,
  slotId,
}) {
  // 편집 중인 덱 (모달 내부 상태, 저장 시에만 부모 반영)
  const [workingDeck, setWorkingDeck] = useState(() =>
    Array.isArray(battleDeck) && battleDeck.length > 0 ? [...battleDeck] : [...DEFAULT_BATTLE_DECK]
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // 덱에 있는 카드 ID별 개수
  const countById = useMemo(() => {
    const c = {};
    workingDeck.forEach((id) => {
      c[id] = (c[id] || 0) + 1;
    });
    return c;
  }, [workingDeck]);

  const canAdd = (cardId) => {
    const max = BATTLE_CARD_BY_ID[cardId]?.maxInDeck ?? 0;
    const current = countById[cardId] || 0;
    return current < max && workingDeck.length < DECK_MAX_SIZE;
  };

  const addCard = (cardId) => {
    if (!canAdd(cardId)) return;
    setWorkingDeck((prev) => [...prev, cardId]);
    setMessage(null);
  };

  const removeCardAt = (index) => {
    if (index < 0 || index >= workingDeck.length) return;
    setWorkingDeck((prev) => prev.filter((_, i) => i !== index));
    setMessage(null);
  };

  const handleSave = async () => {
    if (workingDeck.length < DECK_MIN_SIZE) {
      setMessage(`덱은 최소 ${DECK_MIN_SIZE}장 이상이어야 합니다.`);
      return;
    }
    if (workingDeck.length > DECK_MAX_SIZE) {
      setMessage(`덱은 최대 ${DECK_MAX_SIZE}장까지입니다.`);
      return;
    }
    if (!saveBattleDeck || slotId == null) {
      setMessage("저장할 수 없습니다.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveBattleDeck(slotId, workingDeck);
      if (setBattleDeck) setBattleDeck(workingDeck);
      onClose();
    } catch (err) {
      console.error(err);
      setMessage("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setWorkingDeck([...DEFAULT_BATTLE_DECK]);
    setMessage(null);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-center">배틀 덱 편집</h2>
        <p className="text-sm text-gray-600 mb-4">
          덱: {workingDeck.length}장 (최소 {DECK_MIN_SIZE}장, 최대 {DECK_MAX_SIZE}장)
        </p>

        {/* 카드 풀: 추가 버튼 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2">카드 추가</h3>
          <ul className="space-y-2">
            {BATTLE_CARD_POOL.map((card) => {
              const count = countById[card.id] || 0;
              const canAddThis = canAdd(card.id);
              return (
                <li
                  key={card.id}
                  className="flex items-center justify-between bg-gray-100 rounded px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{card.nameKo}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({count}/{card.maxInDeck})
                    </span>
                    <p className="text-xs text-gray-600">{card.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCard(card.id)}
                    disabled={!canAddThis}
                    className="px-3 py-1 rounded bg-amber-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    추가
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 현재 덱 목록: 제거 가능 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2">현재 덱 ({workingDeck.length}장)</h3>
          <div className="flex flex-wrap gap-2">
            {workingDeck.map((cardId, index) => {
              const meta = BATTLE_CARD_BY_ID[cardId];
              return (
                <button
                  key={`${cardId}-${index}`}
                  type="button"
                  onClick={() => removeCardAt(index)}
                  className="px-2 py-1 rounded bg-amber-200 text-gray-800 text-sm hover:bg-amber-300"
                  title="제거"
                >
                  {meta?.nameKo ?? cardId} ×
                </button>
              );
            })}
            {workingDeck.length === 0 && (
              <p className="text-gray-500 text-sm">덱이 비어 있습니다. 위에서 카드를 추가하세요.</p>
            )}
          </div>
        </div>

        {message && <p className="text-red-600 text-sm mb-2">{message}</p>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-4 py-2 rounded bg-gray-300 text-gray-800 font-medium"
          >
            기본 덱으로
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || workingDeck.length < DECK_MIN_SIZE}
            className="px-4 py-2 rounded bg-amber-500 text-white font-medium disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-500 text-white font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

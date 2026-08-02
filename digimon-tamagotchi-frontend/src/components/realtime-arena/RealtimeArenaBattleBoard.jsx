import React, { useEffect, useState } from "react";
import RealtimeArenaActionPanel from "./RealtimeArenaActionPanel";
import { translateStage } from "../../utils/stageTranslator";
import { getRealtimeArenaAttributeBonus } from "../../logic/realtime-arena/damage";
import "../../styles/RealtimeArenaBattle.css";

const ACTION_LABELS = {
  attack: "공격",
  guard: "방어",
  special_attack: "특수공격",
  no_action: "미선택",
};

const ATTRIBUTE_LABELS = {
  Vaccine: "백신",
  Virus: "바이러스",
  Data: "데이터",
  Free: "프리",
};
const ATTRIBUTE_RELATION_FALLBACK_RULES = { attribute: { advantageBonus: 1 } };

export function getRealtimeArenaActionLabel(action) {
  return ACTION_LABELS[action] || "알 수 없음";
}

function presentationPhase(battle, active, clockMs) {
  if (!active || !battle.presentationEndsAt) return "selection";
  const duration = Number(battle.rulesSnapshot?.presentationWindowMs || 2200);
  const elapsed = Math.max(0, clockMs - (new Date(battle.presentationEndsAt).getTime() - duration));
  if (elapsed < 350) return "reveal";
  if (elapsed < 1300) return "action";
  if (elapsed < 1850) return "impact";
  return "settle";
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;
    const update = () => setReduced(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

function getAttributeRelation(attribute, opponentAttribute, rules) {
  const resolvedRules = rules?.attribute
    ? rules
    : ATTRIBUTE_RELATION_FALLBACK_RULES;
  if (getRealtimeArenaAttributeBonus(attribute, opponentAttribute, resolvedRules) > 0) return "advantage";
  if (getRealtimeArenaAttributeBonus(opponentAttribute, attribute, resolvedRules) > 0) return "disadvantage";
  return "neutral";
}

function Fighter({ label, data, opponent, rules, hp, damage, action, phase, side, opponentAction }) {
  const ratio = Math.max(0, Math.min(100, (hp / data.maxHp) * 100));
  const hitVisible = phase === "impact" || phase === "settle";
  const attacking = phase === "action" && (action === "attack" || action === "special_attack");
  const defended = hitVisible && action === "guard" && damage === 0 && ["attack", "special_attack"].includes(opponentAction);
  const relation = getAttributeRelation(data.attribute, opponent.attribute, rules);
  const relationLabel = relation === "advantage" ? "유리" : relation === "disadvantage" ? "불리" : "중립";
  const attributeLabel = ATTRIBUTE_LABELS[data.attribute] || data.attribute || "프리";
  return (
    <article className={`realtime-arena-fighter is-${side} ${hitVisible && damage > 0 ? "is-hit" : ""}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="realtime-arena-fighter__sprite-wrap">
        <img
          className={`realtime-arena-fighter__sprite ${attacking ? "is-attacking" : ""}`}
          src={`${data.spriteBasePath || "/images"}/${data.sprite ?? 0}.png`}
          alt={`${data.digimonName} 모습`}
        />
        {hitVisible && damage > 0 && <strong className="realtime-arena-damage" aria-label={`${damage} 피해`}>-{damage}</strong>}
        {defended && <strong className="realtime-arena-blocked">방어 성공</strong>}
      </div>
      <p className="font-bold">{data.digimonName}</p>
      <p className="realtime-arena-fighter__meta">
        <span>{translateStage(data.stage)}</span>
        <span>파워 {Number(data.sourcePower || 0)}</span>
        <span className={`is-${relation}`}>{attributeLabel}({relationLabel})</span>
      </p>
      <p className="text-sm">HP {hp} / {data.maxHp}</p>
      <div className="mt-1 h-2 overflow-hidden rounded bg-slate-200" role="progressbar" aria-label={`${label} HP`} aria-valuemin="0" aria-valuemax={data.maxHp} aria-valuenow={hp}>
        <div className="realtime-arena-hp h-full bg-emerald-500" style={{ width: `${ratio}%` }} />
      </div>
    </article>
  );
}

function Projectile({ side, participant, action, phase }) {
  if (phase !== "action" || !["attack", "special_attack"].includes(action)) return null;
  return (
    <img
      className={`realtime-arena-projectile is-${side} ${action === "special_attack" ? "is-special" : ""}`}
      src={`${participant.spriteBasePath || "/images"}/${participant.attackSprite ?? participant.sprite ?? 0}.png`}
      alt=""
      aria-hidden="true"
    />
  );
}

function Shield({ side, action, phase }) {
  if (action !== "guard" || !["action", "impact", "settle"].includes(phase)) return null;
  return <span className={`realtime-arena-shield is-${side}`} aria-label="방패 방어">🛡️</span>;
}

function ActionChip({ label, action, source, tone }) {
  return (
    <div className={`realtime-arena-action-chip is-${tone}`} role="group" aria-label={`${label} 행동`}>
      <span>{label}: <strong>{action ? getRealtimeArenaActionLabel(action) : "선택 대기"}</strong></span>
      {source === "auto" && <small>자동 선택</small>}
      {source === "cpu" && <small>CPU 선택</small>}
    </div>
  );
}

export default function RealtimeArenaBattleBoard({
  battle,
  viewer,
  remainingMs,
  busy,
  selectedAction,
  selectionSaving,
  recovering,
  presentationActive,
  selectionOpen,
  clockMs,
  onSubmit,
  onForfeit,
}) {
  const latest = battle.resolvedRounds?.[battle.resolvedRounds.length - 1];
  const reducedMotion = usePrefersReducedMotion();
  const phase = reducedMotion && presentationActive ? "settle" : presentationPhase(battle, presentationActive, clockMs);
  const ownRole = viewer?.role === "guest" ? "guest" : "host";
  const opponentRole = ownRole === "host" ? "guest" : "host";
  const opponentLabel = battle.mode === "cpu" ? "CPU" : "상대";
  const own = battle.participants[ownRole];
  const opponent = battle.participants[opponentRole];
  const ownAction = latest?.[`${ownRole}Action`];
  const opponentAction = latest?.[`${opponentRole}Action`];
  const ownDamage = Number(latest?.[`${ownRole}DamageTaken`] || 0);
  const opponentDamage = Number(latest?.[`${opponentRole}DamageTaken`] || 0);
  const hpSettled = phase === "impact" || phase === "settle" || phase === "selection";
  const ownHpAfter = Number(battle.currentHp[ownRole]);
  const opponentHpAfter = Number(battle.currentHp[opponentRole]);
  const ownHp = presentationActive && !hpSettled ? ownHpAfter + ownDamage : ownHpAfter;
  const opponentHp = presentationActive && !hpSettled ? opponentHpAfter + opponentDamage : opponentHpAfter;
  const displayedRound = presentationActive && latest ? latest.round : battle.round;
  const ownSource = latest?.selectionSources?.[ownRole];
  const opponentSource = latest?.selectionSources?.[opponentRole];
  const resultAnnouncement = presentationActive && latest
    ? `나 ${getRealtimeArenaActionLabel(ownAction)}, ${opponentLabel} ${getRealtimeArenaActionLabel(opponentAction)}. 나 ${ownDamage} 피해, ${opponentLabel} ${opponentDamage} 피해.`
    : "";
  const displayedOwnAction = presentationActive ? ownAction : selectedAction;
  const displayedOpponentAction = presentationActive ? opponentAction : null;
  const displayedOwnSource = presentationActive ? ownSource : null;
  const displayedOpponentSource = presentationActive ? opponentSource : null;

  return (
    <div className="space-y-4 realtime-arena-board">
      <div className="flex items-center justify-between">
        <strong>라운드 {displayedRound} / {battle.maxRounds}</strong>
        {presentationActive && <span className="font-bold" aria-label="판정 진행 중">판정 중</span>}
      </div>

      {recovering && <p className="rounded bg-blue-50 p-2 text-center text-xs font-semibold text-blue-700">연결 복구 중...</p>}

      <div className={`realtime-arena-stage phase-${phase}`}>
        <Fighter label="나" data={own} opponent={opponent} rules={battle.rulesSnapshot} hp={ownHp} damage={ownDamage} action={ownAction} opponentAction={opponentAction} phase={phase} side="left" />
        <div className="realtime-arena-effects" aria-hidden="true">
          <Projectile side="left" participant={own} action={ownAction} phase={phase} />
          <Projectile side="right" participant={opponent} action={opponentAction} phase={phase} />
        </div>
        <Shield side="left" action={ownAction} phase={phase} />
        <Shield side="right" action={opponentAction} phase={phase} />
        <Fighter label={opponentLabel} data={opponent} opponent={own} rules={battle.rulesSnapshot} hp={opponentHp} damage={opponentDamage} action={opponentAction} opponentAction={ownAction} phase={phase} side="right" />
      </div>

      <p className="sr-only" aria-live="assertive">{resultAnnouncement}</p>

      <div className="realtime-arena-action-status" role="region" aria-label="양쪽 행동 현황">
        <ActionChip label="나" action={displayedOwnAction} source={displayedOwnSource} tone="own" />
        <ActionChip label={opponentLabel} action={displayedOpponentAction} source={displayedOpponentSource} tone="opponent" />
      </div>

      {battle.status === "selecting" && !presentationActive && (
        <RealtimeArenaActionPanel
          disabled={busy || !selectionOpen}
          selectedAction={selectedAction}
          saving={selectionSaving}
          remainingMs={remainingMs}
          onSubmit={onSubmit}
        />
      )}

      {!presentationActive && latest && (
        <div className="realtime-arena-recent-round" role="region" aria-label="최근 라운드 결과">
          <strong className="realtime-arena-recent-round__title">최근 라운드</strong>
          <div className="realtime-arena-recent-round__players">
            <div className="realtime-arena-recent-round__player is-own" aria-label="나 최근 결과">
              <span className="realtime-arena-recent-round__label">나</span>
              <span className="realtime-arena-recent-round__action">
                {getRealtimeArenaActionLabel(ownAction)}
                {ownSource === "auto" && <small>자동</small>}
              </span>
              <span className="realtime-arena-recent-round__damage">받은 피해 <strong>{ownDamage}</strong></span>
            </div>
            <div className="realtime-arena-recent-round__player is-opponent" aria-label={`${opponentLabel} 최근 결과`}>
              <span className="realtime-arena-recent-round__label">{opponentLabel}</span>
              <span className="realtime-arena-recent-round__action">
                {getRealtimeArenaActionLabel(opponentAction)}
                {opponentSource === "auto" && <small>자동</small>}
              </span>
              <span className="realtime-arena-recent-round__damage">받은 피해 <strong>{opponentDamage}</strong></span>
            </div>
          </div>
        </div>
      )}

      {battle.status === "selecting" && (
        <button type="button" className="w-full rounded border border-red-500 px-3 py-2 text-red-600 disabled:opacity-50" onClick={onForfeit} disabled={busy || presentationActive}>포기</button>
      )}
    </div>
  );
}

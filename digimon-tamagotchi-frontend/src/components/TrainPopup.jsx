// src/components/TrainPopup.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doVer1Training, getVer1DefensePattern } from "../logic/training";
import "../styles/TrainPopup.css";

const ROUND_COUNT = 5;
const ROUND_TIME_LIMIT = 5;
const ATTACK_REVEAL_DELAY_MS = 220;
const RESULT_HOLD_DELAY_MS = 420;
const PUPPET_SPRITE_SRC = "/images/567.png";
const HIT_EFFECT_FRAMES = ["/images/122.png", "/images/123.png"];

const TRAINING_LANES = [
  { key: "U", label: "상단", buttonLabel: "↑", assistiveLabel: "위" },
  { key: "D", label: "하단", buttonLabel: "↓", assistiveLabel: "아래" },
];
const MOBILE_BREAKPOINT = 720;

function formatDirection(direction) {
  return direction === "U" ? "상단" : "하단";
}

function buildDisplayName(digimonName, digimonNickname) {
  const nickname = typeof digimonNickname === "string" ? digimonNickname.trim() : "";
  return nickname ? `${nickname}(${digimonName})` : digimonName;
}

function getStatDeltaLabel(delta, suffix = "") {
  const sign = delta > 0 ? "+" : "";
  return `(${sign}${delta}${suffix})`;
}

function getStatDeltaTone(delta) {
  if (delta > 0) return "is-positive";
  if (delta < 0) return "is-negative";
  return "is-neutral";
}

function FinalResultPanel({ beforeStats, finalResult }) {
  if (!beforeStats || !finalResult?.updatedStats) return null;

  const updatedStats = finalResult.updatedStats;
  const statChanges = {
    weight: (updatedStats.weight || 0) - beforeStats.weight,
    energy: (updatedStats.energy || 0) - beforeStats.energy,
    strength: (updatedStats.strength || 0) - beforeStats.strength,
    effort: (updatedStats.effort || 0) - beforeStats.effort,
  };

  return (
    <section className="train-popup__final-result" aria-label="최종 훈련 결과">
      <div className="train-popup__final-header">
        <h3>최종 훈련 결과</h3>
        <p>{finalResult.message}</p>
      </div>

      <div className="train-popup__final-summary">
        <span className={finalResult.isSuccess ? "is-success" : "is-fail"}>
          {finalResult.isSuccess ? "성공" : "실패"}
        </span>
        <span>
          {finalResult.hits} HIT / {finalResult.fails} FAIL
        </span>
      </div>

      <dl className="train-popup__stat-grid">
        <div>
          <dt>체중</dt>
          <dd>
            <span>
              {beforeStats.weight}g → {updatedStats.weight}g
            </span>
            <strong className={getStatDeltaTone(statChanges.weight)}>
              {getStatDeltaLabel(statChanges.weight, "g")}
            </strong>
          </dd>
        </div>
        <div>
          <dt>에너지</dt>
          <dd>
            <span>
              {beforeStats.energy} → {updatedStats.energy}
            </span>
            <strong className={getStatDeltaTone(statChanges.energy)}>
              {getStatDeltaLabel(statChanges.energy)}
            </strong>
          </dd>
        </div>
        <div>
          <dt>힘</dt>
          <dd>
            <span>
              {beforeStats.strength} → {updatedStats.strength}
            </span>
            <strong className={getStatDeltaTone(statChanges.strength)}>
              {statChanges.strength ? getStatDeltaLabel(statChanges.strength) : "(변화 없음)"}
            </strong>
          </dd>
        </div>
        <div>
          <dt>노력</dt>
          <dd>
            <span>
              {beforeStats.effort} → {updatedStats.effort}
            </span>
            <strong className={getStatDeltaTone(statChanges.effort)}>
              {statChanges.effort ? getStatDeltaLabel(statChanges.effort) : "(변화 없음)"}
            </strong>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default function TrainPopup({
  onClose,
  digimonStats,
  setDigimonStatsAndSave,
  onTrainResult,
  selectedDigimon = "",
  digimonNickname = "",
  digimonDataForSlot = {},
}) {
  const [phase, setPhase] = useState("ready");
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_LIMIT);
  const [interactionState, setInteractionState] = useState("idle");
  const [partialResults, setPartialResults] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [beforeStats, setBeforeStats] = useState(null);
  const [chosenPattern, setChosenPattern] = useState([]);
  const [currentExchange, setCurrentExchange] = useState(null);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  const lifecycleTokenRef = useRef(0);
  const transitionTokenRef = useRef(0);
  const timeoutIdsRef = useRef([]);
  const roundDeadlineRef = useRef(0);

  const currentDigimonData = useMemo(() => {
    return digimonDataForSlot?.[selectedDigimon] || {};
  }, [digimonDataForSlot, selectedDigimon]);
  const latestDigimonStats = finalResult?.updatedStats || digimonStats;

  const digimonName = currentDigimonData?.name || selectedDigimon || "내 디지몬";
  const digimonDisplayName = buildDisplayName(digimonName, digimonNickname);
  const digimonSpriteBasePath = currentDigimonData?.spriteBasePath || "/images";
  const digimonSprite = currentDigimonData?.sprite ?? digimonStats?.sprite ?? 0;
  const digimonAttackSprite =
    currentDigimonData?.stats?.attackSprite ??
    currentDigimonData?.attackSprite ??
    latestDigimonStats?.attackSprite ??
    digimonSprite;
  const digimonSpriteSrc = `${digimonSpriteBasePath}/${digimonSprite}.png`;
  const digimonAttackSpriteSrc = `${digimonSpriteBasePath}/${digimonAttackSprite}.png`;
  const isAwaitingInput = phase === "battle" && interactionState === "awaiting-input";
  const shouldRevealDefense = phase === "final" || (phase === "battle" && interactionState !== "awaiting-input");
  const exchangeResultLabel = currentExchange
    ? currentExchange.isHit
      ? "명중 성공"
      : "방어당함"
    : "";

  const clearScheduledTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
  }, []);

  const queueStep = useCallback((callback, delay, transitionToken = transitionTokenRef.current) => {
    const lifecycleToken = lifecycleTokenRef.current;
    const timeoutId = setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter(
        (registeredId) => registeredId !== timeoutId
      );

      if (lifecycleToken !== lifecycleTokenRef.current) return;
      if (transitionToken !== transitionTokenRef.current) return;

      callback();
    }, delay);

    timeoutIdsRef.current.push(timeoutId);
    return timeoutId;
  }, []);

  useEffect(() => {
    lifecycleTokenRef.current += 1;

    return () => {
      lifecycleTokenRef.current += 1;
      clearScheduledTimeouts();
    };
  }, [clearScheduledTimeouts]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncLayoutMode = () => {
      setIsMobileLayout(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    syncLayoutMode();
    window.addEventListener("resize", syncLayoutMode);

    return () => {
      window.removeEventListener("resize", syncLayoutMode);
    };
  }, []);

  const closePopup = useCallback(() => {
    clearScheduledTimeouts();
    roundDeadlineRef.current = 0;
    onClose();
  }, [clearScheduledTimeouts, onClose]);

  const beginInputWindow = useCallback((nextRound) => {
    roundDeadlineRef.current = Date.now() + ROUND_TIME_LIMIT * 1000;
    setRound(nextRound);
    setTimeLeft(ROUND_TIME_LIMIT);
    setCurrentExchange(null);
    setInteractionState("awaiting-input");
  }, []);

  function startTrain() {
    const currentWeight = latestDigimonStats.weight || 0;
    const currentEnergy = latestDigimonStats.energy || 0;

    if (currentWeight <= 0) {
      alert("⚠️ 체중이 너무 낮습니다!\n먹이로 체중을 늘려 주세요.");
      return;
    }

    if (currentEnergy <= 0) {
      alert("⚠️ 에너지가 부족합니다!\n잠을 재워 에너지를 회복해 주세요.");
      return;
    }

    clearScheduledTimeouts();
    transitionTokenRef.current += 1;

    setChosenPattern(getVer1DefensePattern(latestDigimonStats.trainings || 0));
    setBeforeStats({
      weight: latestDigimonStats.weight || 0,
      energy: latestDigimonStats.energy || 0,
      strength: latestDigimonStats.strength || 0,
      effort: latestDigimonStats.effort || 0,
    });
    setPartialResults([]);
    setFinalResult(null);
    setPhase("battle");
    beginInputWindow(1);
  }

  const finalizeTraining = useCallback(async (roundResults, transitionToken) => {
    try {
      let trainResult;

      if (onTrainResult) {
        trainResult = await onTrainResult(roundResults);
        if (!trainResult) {
          closePopup();
          return;
        }
      } else {
        trainResult = doVer1Training(latestDigimonStats, roundResults);
        setDigimonStatsAndSave(trainResult.updatedStats);
      }

      if (transitionToken !== transitionTokenRef.current) return;

      setFinalResult(trainResult);
      setPhase("final");
      setInteractionState("revealed");
      roundDeadlineRef.current = 0;
      setTimeLeft(0);
    } catch (error) {
      console.error("훈련 결과 처리 오류:", error);
      closePopup();
    }
  }, [closePopup, latestDigimonStats, onTrainResult, setDigimonStatsAndSave]);

  const handleAttackSelection = useCallback((attackDirection, autoSelected = false) => {
    if (!isAwaitingInput || !chosenPattern.length) return;

    const currentRound = round;
    const defendDirection = chosenPattern[currentRound - 1];
    const nextExchange = {
      round: currentRound,
      attack: attackDirection,
      defend: defendDirection,
      isHit: attackDirection !== defendDirection,
      autoSelected,
    };
    const nextRoundResults = [...partialResults, nextExchange];
    const nextTransitionToken = transitionTokenRef.current + 1;

    transitionTokenRef.current = nextTransitionToken;
    setCurrentExchange(nextExchange);
    setInteractionState("attacking");

    queueStep(() => {
      setPartialResults(nextRoundResults);
      setInteractionState("revealed");
    }, ATTACK_REVEAL_DELAY_MS, nextTransitionToken);

    queueStep(() => {
      if (currentRound >= ROUND_COUNT) {
        finalizeTraining(nextRoundResults, nextTransitionToken);
        return;
      }

      beginInputWindow(currentRound + 1);
    }, ATTACK_REVEAL_DELAY_MS + RESULT_HOLD_DELAY_MS, nextTransitionToken);
  }, [
    beginInputWindow,
    chosenPattern,
    finalizeTraining,
    isAwaitingInput,
    partialResults,
    queueStep,
    round,
  ]);

  useEffect(() => {
    if (!isAwaitingInput) return undefined;

    const syncCountdown = () => {
      const remainingMs = Math.max(0, roundDeadlineRef.current - Date.now());
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      setTimeLeft((previousTimeLeft) =>
        previousTimeLeft === remainingSeconds ? previousTimeLeft : remainingSeconds
      );
    };

    syncCountdown();
    const timer = setInterval(syncCountdown, 250);

    return () => clearInterval(timer);
  }, [isAwaitingInput, round]);

  useEffect(() => {
    if (!isAwaitingInput || timeLeft > 0) return;

    const autoDirection = Math.random() < 0.5 ? "U" : "D";
    handleAttackSelection(autoDirection, true);
  }, [handleAttackSelection, isAwaitingInput, timeLeft]);

  const statusMessage = (() => {
    if (phase === "final" && finalResult) {
      return "훈련이 끝났습니다. 최종 결과를 확인해 주세요.";
    }

    if (!currentExchange || interactionState === "awaiting-input") {
      return "?표로 가려진 방어를 읽고 위/아래 공격을 선택하세요.";
    }

    if (interactionState === "attacking") {
      return `${formatDirection(currentExchange.attack)} 공격이 들어갑니다.`;
    }

    return currentExchange.isHit
      ? `${formatDirection(currentExchange.attack)} 공격이 명중했습니다.`
      : `${formatDirection(currentExchange.defend)} 방어에 막혔습니다.`;
  })();
  const getDummyGuardLabel = (laneKey) => {
    if (!shouldRevealDefense || !currentExchange) return " ";
    if (currentExchange.attack === laneKey && currentExchange.isHit) return "피격";
    if (currentExchange.defend === laneKey) return "막음";
    return " ";
  };
  const getDummyGuardState = (laneKey) => {
    if (!shouldRevealDefense || !currentExchange) return "";
    if (currentExchange.attack === laneKey && currentExchange.isHit) return "is-hit";
    if (currentExchange.defend === laneKey) return "is-active";
    return "";
  };
  const renderAttackControls = (variant = "inline") => (
    <aside
      className={`train-popup__control-panel train-popup__control-panel--${variant}`}
      aria-label={variant === "mobile" ? "모바일 입력 패드" : "입력 패드"}
    >
      <div className="train-popup__input-grid">
        {TRAINING_LANES.map((lane) => (
          <button
            key={`${variant}-${lane.key}`}
            type="button"
            aria-label={`${lane.label} 공격 ${lane.assistiveLabel}`}
            onClick={() => handleAttackSelection(lane.key)}
            disabled={!isAwaitingInput}
            className={`train-popup__attack-button train-popup__attack-button--grid ${
              lane.key === "U" ? "is-upper" : "is-lower"
            } ${
              currentExchange?.attack === lane.key && shouldRevealDefense ? "is-selected" : ""
            }`}
          >
            <span>{lane.label} 공격</span>
            <strong>{lane.buttonLabel}</strong>
          </button>
        ))}
      </div>
    </aside>
  );

  if (phase === "ready") {
    return (
      <div className="train-popup__overlay">
        <div className="train-popup__shell train-popup__shell--ready">
          <div className="train-popup__ready-copy">
            <span className="train-popup__eyebrow">TRAINING MODE</span>
            <h2>훈련 시작</h2>
            <p>원작풍 상하 공격 훈련으로 5라운드 동안 샌드백의 방어를 읽어 보세요.</p>
          </div>

          <div className="train-popup__ready-card">
            <div className="train-popup__ready-avatar">
              <img
                src={digimonSpriteSrc}
                alt={digimonName}
                className="train-popup__player-sprite"
              />
            </div>
            <div className="train-popup__ready-meta">
              <strong>{digimonDisplayName}</strong>
              <span>상단 또는 하단을 골라 3회 이상 명중하면 성공입니다.</span>
            </div>
          </div>

          <div className="train-popup__ready-actions">
            <button type="button" onClick={startTrain} className="train-popup__primary-button">
              시작
            </button>
            <button type="button" onClick={closePopup} className="train-popup__secondary-button">
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="train-popup__overlay">
      <div className="train-popup__shell">
        <header className="train-popup__header">
          <div className="train-popup__header-copy">
            <span className="train-popup__eyebrow">원작풍 상하 공격 훈련</span>
            <h2>숨은 방어를 뚫어 보세요</h2>
            <p>{statusMessage}</p>
          </div>

          <button type="button" onClick={closePopup} className="train-popup__close-button">
            닫기
          </button>
        </header>

        <section className="train-popup__scoreboard" aria-label="훈련 진행 현황">
          <div className="train-popup__score-card">
            <span>ROUND</span>
            <strong>
              {Math.min(round, ROUND_COUNT)} / {ROUND_COUNT}
            </strong>
          </div>
          <div className="train-popup__score-card">
            <span>남은 시간</span>
            <strong
              className={phase === "battle" && timeLeft <= 3 ? "is-urgent" : ""}
            >
              {phase === "battle" ? timeLeft : 0}초
            </strong>
          </div>
          <div className="train-popup__round-history" role="list" aria-label="히트 히스토리">
            {Array.from({ length: ROUND_COUNT }, (_, index) => {
              const result = partialResults[index];
              const isCurrentRound = !result && phase === "battle" && round === index + 1;
              const label = result ? (result.isHit ? "명중" : "막힘") : isCurrentRound ? "진행 중" : "대기";

              return (
                <div
                  key={index + 1}
                  role="listitem"
                  className={`train-popup__round-chip ${
                    result
                      ? result.isHit
                        ? "is-hit"
                        : "is-block"
                      : isCurrentRound
                        ? "is-current"
                        : ""
                  }`}
                >
                  <span>R{index + 1}</span>
                  <strong>{label}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="train-popup__arena" aria-label="훈련 전투 무대">
          <section
            className="train-popup__player-panel"
            aria-label={isMobileLayout ? "내 디지몬" : "내 디지몬과 공격 패드"}
          >
            <div className="train-popup__player-panel-grid">
              <article className="train-popup__fighter-card train-popup__fighter-card--player">
                <span className="train-popup__fighter-label">내 디지몬</span>
                <div className="train-popup__fighter-frame">
                  <img
                    src={digimonSpriteSrc}
                    alt={digimonName}
                    aria-label="내 디지몬 스프라이트"
                    className="train-popup__player-sprite"
                  />
                </div>
                <strong>{digimonDisplayName}</strong>
                <span className="train-popup__fighter-caption">선택한 방향으로 즉시 공격합니다.</span>
              </article>

              {!isMobileLayout && renderAttackControls("inline")}
            </div>
          </section>

          <div className="train-popup__lanes" aria-label="공격 경로">
            {!shouldRevealDefense && (
              <div className="train-popup__lane-question" aria-label="방어 위치 숨김">
                ?
              </div>
            )}

            {shouldRevealDefense && currentExchange && (
              <div className={`train-popup__lane-result-badge ${currentExchange.isHit ? "is-hit" : "is-block"}`}>
                {exchangeResultLabel}
              </div>
            )}

            {TRAINING_LANES.map((lane) => {
              const isAttackLane = currentExchange?.attack === lane.key;
              const isDefendLane = currentExchange?.defend === lane.key;
              const isHit = Boolean(currentExchange?.isHit && isAttackLane);
              const isBlockedAttack = Boolean(
                shouldRevealDefense && currentExchange && !currentExchange.isHit && isAttackLane
              );
              const laneToneClass = lane.key === "U" ? "is-upper" : "is-lower";
              const laneResultClass =
                shouldRevealDefense && isAttackLane
                  ? currentExchange?.isHit
                    ? "is-hit-result"
                    : "is-block-result"
                  : "";
              const projectileClass = interactionState === "attacking"
                ? currentExchange?.isHit
                  ? "is-traveling-hit"
                  : "is-traveling-block"
                : interactionState === "revealed" || phase === "final"
                  ? isHit
                    ? "is-hit"
                    : isAttackLane
                      ? "is-blocked"
                      : ""
                  : "";

              return (
                <div key={lane.key} className={`train-popup__lane-row ${laneToneClass} ${laneResultClass}`} aria-label={`${lane.label} 공격 경로`}>
                  <div className="train-popup__lane-track">
                    <div className="train-popup__lane-rail">
                      {isBlockedAttack && (
                        <span className={`train-popup__lane-shield ${laneToneClass}`} aria-label="방패 방어">
                          🛡️
                        </span>
                      )}
                      {isAttackLane && currentExchange && (
                        <span className={`train-popup__lane-projectile-shell ${laneToneClass} ${projectileClass}`}>
                          <img
                            src={digimonAttackSpriteSrc}
                            alt="공격 스프라이트"
                            className="train-popup__lane-projectile"
                          />
                        </span>
                      )}
                    </div>
                    <span
                      className={`train-popup__lane-callout train-popup__lane-callout--enemy ${laneToneClass} ${
                        shouldRevealDefense && isDefendLane ? "is-visible is-defense" : shouldRevealDefense ? "is-visible is-open" : ""
                      }`}
                    >
                      {shouldRevealDefense
                        ? isDefendLane
                          ? "막음"
                          : isAttackLane && currentExchange?.isHit
                            ? "명중"
                            : ""
                        : ""}
                    </span>
                  </div>
                  {phase !== "ready" && currentExchange?.autoSelected && currentExchange.attack === lane.key && (
                    <span className="train-popup__auto-note">자동 선택</span>
                  )}
                </div>
              );
            })}
          </div>

          <article className="train-popup__fighter-card train-popup__fighter-card--dummy">
            <span className="train-popup__fighter-label">샌드백</span>
            <div className="train-popup__dummy-stage" aria-label="샌드백">
              <div className={`train-popup__dummy-top-guard ${getDummyGuardState("U")}`}>
                {getDummyGuardLabel("U")}
              </div>
              <div
                className={`train-popup__dummy-puppet ${
                  shouldRevealDefense && currentExchange?.isHit ? "is-hit" : ""
                } ${
                  shouldRevealDefense && currentExchange?.isHit && currentExchange.attack === "U"
                    ? "is-upper-hit"
                    : shouldRevealDefense && currentExchange?.isHit && currentExchange.attack === "D"
                      ? "is-lower-hit"
                      : ""
                }`}
              >
                <img
                  src={PUPPET_SPRITE_SRC}
                  alt="훈련 샌드백 스프라이트"
                  className="train-popup__dummy-sprite"
                />
              </div>
              {shouldRevealDefense && currentExchange?.isHit && (
                <>
                  <div
                    className={`train-popup__hit-effect ${
                      currentExchange.attack === "U" ? "is-upper" : "is-lower"
                    }`}
                    data-testid="train-hit-effect"
                  >
                    {HIT_EFFECT_FRAMES.map((frameSrc, index) => (
                      <img
                        key={frameSrc}
                        src={frameSrc}
                        alt=""
                        aria-hidden="true"
                        data-testid={`train-hit-effect-${index === 0 ? "122" : "123"}`}
                        className={`train-popup__hit-effect-frame ${
                          index === 0 ? "is-frame-122" : "is-frame-123"
                        }`}
                      />
                    ))}
                  </div>
                  <div
                    className={`train-popup__dummy-impact ${
                      currentExchange.attack === "U" ? "is-upper" : "is-lower"
                    }`}
                  >
                    피격!
                  </div>
                </>
              )}
              <div className={`train-popup__dummy-bottom-guard ${getDummyGuardState("D")}`}>
                {getDummyGuardLabel("D")}
              </div>
            </div>
            {isMobileLayout && renderAttackControls("mobile")}
            <span className="train-popup__fighter-caption">
              입력 전에는 중앙 ?로 방어가 숨겨집니다.
            </span>
          </article>
        </section>

        {partialResults.length > 0 && (
          <section className="train-popup__log-strip" aria-label="라운드 기록">
            {partialResults.map((result) => (
              <div key={result.round} className={`train-popup__log-chip ${result.isHit ? "is-hit" : "is-block"}`}>
                <strong>R{result.round}</strong>
                <span>
                  {formatDirection(result.attack)} 공격 / {formatDirection(result.defend)} 방어
                </span>
                <em>{result.isHit ? "명중" : "막힘"}</em>
              </div>
            ))}
          </section>
        )}

        {phase === "final" && finalResult && (
          <div className="train-popup__result-overlay" role="dialog" aria-modal="true" aria-label="최종 훈련 결과 팝업">
            <div className="train-popup__result-modal">
              <FinalResultPanel beforeStats={beforeStats} finalResult={finalResult} />
              <div className="train-popup__result-actions">
                <button type="button" onClick={startTrain} className="train-popup__primary-button">
                  한번 더
                </button>
                <button type="button" onClick={closePopup} className="train-popup__secondary-button">
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

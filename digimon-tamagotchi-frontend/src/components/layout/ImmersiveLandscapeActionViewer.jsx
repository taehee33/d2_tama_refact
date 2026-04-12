import React, { useEffect, useMemo } from "react";
import TrainPopup from "../TrainPopup";
import {
  buildDigimonStatusMessages,
  DIGIMON_STATUS_CATEGORY_META,
  DIGIMON_STATUS_CATEGORY_ORDER,
} from "../digimonStatusMessages";
import { getGroupedGameMenus, MENU_SURFACES } from "../../constants/gameMenus";

const INTERACTION_ACTIONS = [
  {
    id: "diet",
    title: "다이어트",
    description: "포만감이 너무 높을 때 가볍게 줄입니다.",
    tone: "diet",
  },
  {
    id: "rest",
    title: "누워있기",
    description: "힘 수치를 조금 낮추며 상태를 정리합니다.",
    tone: "rest",
  },
  {
    id: "detox",
    title: "디톡스",
    description: "프로틴 과다 상태를 정리할 때 사용합니다.",
    tone: "detox",
  },
  {
    id: "playOrSnack",
    title: "놀아주기/간식주기",
    description: "최근 케어미스를 해소할 기회를 만듭니다.",
    tone: "play",
  },
  {
    id: "tease",
    title: "괜히 괴롭히기",
    description: "장난은 되지만 케어미스가 늘어날 수 있습니다.",
    tone: "tease",
  },
];

function formatCompactDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "준비됨";
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}일 ${hours}시간`;
  }

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  return `${Math.max(1, minutes)}분`;
}

function StatusSummaryCards({ digimonStats = {} }) {
  const summaryItems = [
    { label: "포만감", value: `${digimonStats.fullness || 0} / 4` },
    { label: "힘", value: `${digimonStats.strength || 0} / 4` },
    { label: "배변", value: `${digimonStats.poopCount || 0}개` },
    { label: "케어미스", value: `${digimonStats.careMistakes || 0}회` },
    { label: "부상", value: digimonStats.isInjured ? "치료 필요" : `${digimonStats.injuries || 0}회` },
    {
      label: "진화까지",
      value: formatCompactDuration(digimonStats.timeToEvolveSeconds || 0),
    },
  ];

  return (
    <div className="immersive-landscape-action-status__summary-grid">
      {summaryItems.map((item) => (
        <article
          key={item.label}
          className="immersive-landscape-action-status__summary-card"
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </div>
  );
}

function StatusMessageSections({
  digimonStats = {},
  currentAnimation = "idle",
  feedType = null,
  canEvolve = false,
  sleepSchedule = null,
  wakeUntil = null,
  sleepLightOnStart = null,
  deathReason = null,
  sleepStatus = "AWAKE",
  currentTime = Date.now(),
}) {
  const statusMessages = useMemo(
    () =>
      buildDigimonStatusMessages({
        digimonStats,
        sleepStatus,
        isDead: digimonStats.isDead,
        currentAnimation,
        feedType,
        canEvolve,
        sleepSchedule,
        wakeUntil,
        sleepLightOnStart,
        deathReason,
        currentTime,
      }),
    [
      canEvolve,
      currentAnimation,
      currentTime,
      deathReason,
      digimonStats,
      feedType,
      sleepLightOnStart,
      sleepSchedule,
      sleepStatus,
      wakeUntil,
    ]
  );

  const groupedMessages = DIGIMON_STATUS_CATEGORY_ORDER.map((category) => ({
    category,
    meta: DIGIMON_STATUS_CATEGORY_META[category],
    messages: statusMessages.filter((message) => message.category === category),
  })).filter((section) => section.messages.length > 0);

  const summaryMessages = statusMessages
    .filter((message) => message.summaryEligible)
    .slice(0, 4);

  return (
    <>
      <div className="immersive-landscape-action-status__highlights">
        {summaryMessages.length > 0 ? (
          summaryMessages.map((message) => (
            <div
              key={message.id}
              className="immersive-landscape-action-status__highlight"
            >
              <strong className={message.color}>{message.text}</strong>
              {message.detailHint ? <span>{message.detailHint}</span> : null}
            </div>
          ))
        ) : (
          <div className="immersive-landscape-action-status__empty">
            지금은 급한 상태가 없어요.
          </div>
        )}
      </div>

      <div className="immersive-landscape-action-status__detail-list">
        {groupedMessages.map(({ category, meta, messages }) => (
          <details
            key={category}
            className={`immersive-landscape-action-status__detail ${meta.containerClass}`}
            open={category === "critical" || category === "warning"}
          >
            <summary>
              <span className={meta.titleClass}>{meta.title}</span>
              <span>{messages.length}건</span>
            </summary>
            <div className="immersive-landscape-action-status__detail-body">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className="immersive-landscape-action-status__detail-card"
                >
                  <strong className={message.color}>{message.text}</strong>
                  {message.detailHint ? <p>{message.detailHint}</p> : null}
                </article>
              ))}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

function LandscapeStatusPanel({
  slotName = "",
  slotVersion = "",
  digimonLabel = "",
  currentTimeText = "",
  digimonStats = {},
  currentAnimation = "idle",
  feedType = null,
  canEvolve = false,
  sleepSchedule = null,
  wakeUntil = null,
  sleepLightOnStart = null,
  deathReason = null,
  sleepStatus = "AWAKE",
  currentTime = Date.now(),
}) {
  return (
    <div className="immersive-landscape-action-status">
      <header className="immersive-landscape-action-status__header">
        <div>
          <p className="service-section-label">가로 상태 요약</p>
          <h3>{digimonLabel || "디지몬 상태"}</h3>
        </div>
        <dl className="immersive-landscape-action-status__meta">
          <div>
            <dt>슬롯</dt>
            <dd>{slotName || "-"}</dd>
          </div>
          <div>
            <dt>버전</dt>
            <dd>{slotVersion || "-"}</dd>
          </div>
          <div>
            <dt>현재 시간</dt>
            <dd>{currentTimeText || "-"}</dd>
          </div>
        </dl>
      </header>

      <StatusSummaryCards digimonStats={digimonStats} />
      <StatusMessageSections
        digimonStats={digimonStats}
        currentAnimation={currentAnimation}
        feedType={feedType}
        canEvolve={canEvolve}
        sleepSchedule={sleepSchedule}
        wakeUntil={wakeUntil}
        sleepLightOnStart={sleepLightOnStart}
        deathReason={deathReason}
        sleepStatus={sleepStatus}
        currentTime={currentTime}
      />
    </div>
  );
}

function LandscapeInteractionPanel({ onSelectAction = () => {} }) {
  return (
    <div className="immersive-landscape-action-grid">
      {INTERACTION_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          className={`immersive-landscape-action-card immersive-landscape-action-card--${action.tone}`.trim()}
          onClick={() => onSelectAction(action.id)}
        >
          <strong>{action.title}</strong>
          <span>{action.description}</span>
          <em>실행하기</em>
        </button>
      ))}
    </div>
  );
}

function LandscapeExtraPanel({ onOpenMenu = () => {} }) {
  const groupedMenus = getGroupedGameMenus(MENU_SURFACES.EXTRA);

  return (
    <div className="immersive-landscape-extra">
      {groupedMenus.map((group) => (
        <section
          key={group.id}
          className="immersive-landscape-extra__group"
          aria-labelledby={`immersive-landscape-extra-${group.id}`}
        >
          <div
            id={`immersive-landscape-extra-${group.id}`}
            className="immersive-landscape-extra__group-title"
          >
            {group.label}
          </div>
          <div className="immersive-landscape-extra__group-grid">
            {group.menus.map((menu) => (
              <button
                key={menu.id}
                type="button"
                className="immersive-landscape-action-card immersive-landscape-action-card--extra"
                onClick={() => onOpenMenu(menu.id)}
              >
                <strong>{menu.label}</strong>
                <span>{typeof menu.icon === "string" ? menu.icon : "•"}</span>
                <em>열기</em>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LandscapeTrainPanel({ trainProps = {} }) {
  return (
    <div className="immersive-landscape-action-train">
      <TrainPopup {...trainProps} renderMode="embedded" />
    </div>
  );
}

function getActionTitle(activeAction) {
  switch (activeAction) {
    case "status":
      return "상태";
    case "train":
      return "훈련";
    case "communication":
      return "교감";
    case "extra":
      return "더보기";
    default:
      return "상세 액션";
  }
}

export default function ImmersiveLandscapeActionViewer({
  isOpen = false,
  isMobile = false,
  activeAction = null,
  onClose = () => {},
  statusPanelProps = null,
  trainPanelProps = null,
  interactionPanelProps = null,
  extraPanelProps = null,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !activeAction) {
    return null;
  }

  let bodyNode = null;

  if (activeAction === "status") {
    bodyNode = <LandscapeStatusPanel {...(statusPanelProps || {})} />;
  } else if (activeAction === "train") {
    bodyNode = <LandscapeTrainPanel trainProps={trainPanelProps} />;
  } else if (activeAction === "communication") {
    bodyNode = (
      <LandscapeInteractionPanel
        onSelectAction={interactionPanelProps?.onSelectAction}
      />
    );
  } else if (activeAction === "extra") {
    bodyNode = <LandscapeExtraPanel onOpenMenu={extraPanelProps?.onOpenMenu} />;
  }

  return (
    <>
      <button
        type="button"
        className="immersive-landscape-action-viewer-backdrop"
        aria-label="가로 액션 뷰어 닫기"
        onClick={onClose}
      />
      <section
        className={`immersive-landscape-action-viewer ${
          isMobile ? "immersive-landscape-action-viewer--mobile" : ""
        } immersive-landscape-action-viewer--${activeAction}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="immersive-landscape-action-viewer-title"
      >
        <header className="immersive-landscape-action-viewer__header">
          <h3 id="immersive-landscape-action-viewer-title" className="sr-only">
            {getActionTitle(activeAction)}
          </h3>
          <button
            type="button"
            className="immersive-landscape-action-viewer__close"
            onClick={onClose}
          >
            닫기
          </button>
        </header>

        <div className="immersive-landscape-action-viewer__body">{bodyNode}</div>
      </section>
    </>
  );
}

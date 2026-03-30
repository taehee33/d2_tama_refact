import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DesktopIcon from "../components/home/DesktopIcon";
import MemoryNotesPanel from "../components/home/MemoryNotesPanel";
import { useAuth } from "../contexts/AuthContext";
import notebookFileIslandVariant from "../data/homeLandingVariants";
import useTamerProfile from "../hooks/useTamerProfile";
import useUserSlots from "../hooks/useUserSlots";
import { getSlotDisplayName, getSlotStageLabel } from "../utils/slotViewUtils";

const SYSTEM_WINDOW_META = {
  "file-island": {
    code: "SYSTEM.LOGIN",
    title: "DIGITAL WORLD",
    subtitle: "안녕은 새로운 시작의 이름",
    inputLabel: "PARTNER CODE",
    placeholder: "Enter Digivice ID...",
    note: "* (while you still can)",
  },
  "folder-island": {
    code: "FILE.ARCHIVE",
    title: "FILE ARCHIVE",
    subtitle: "기록과 가이드를 다시 여는 폴더",
    inputLabel: "OPEN FOLDER",
    placeholder: "guide / collection / support",
    note: "* 기록은 천천히 열수록 오래 남습니다.",
  },
  memories: {
    code: "MEMORY.NOTE",
    title: "MEMORY NOTE",
    subtitle: "마지막 열차는 늘 조용히 플랫폼을 떠납니다",
    inputLabel: "ARCHIVE LINE",
    placeholder: "last train / station note / shell memo",
    note: "* 잊지 않기 위해 남겨 둔 문장들.",
  },
};

function NotebookLanding() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { displayTamerName, maxSlots } = useTamerProfile();
  const { loading, recentSlot } = useUserSlots({ maxSlots });
  const [activeWindowId, setActiveWindowId] = useState(
    notebookFileIslandVariant.defaultWindowId
  );

  const activeIcon = useMemo(
    () =>
      notebookFileIslandVariant.icons.find((icon) => icon.id === activeWindowId) ||
      notebookFileIslandVariant.icons[0],
    [activeWindowId]
  );

  const systemMeta = SYSTEM_WINDOW_META[activeWindowId] || SYSTEM_WINDOW_META["file-island"];
  const metaDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const partnerCodeValue = currentUser
    ? `${displayTamerName.replace(/\s+/g, "_")}::${recentSlot ? `SLOT-${recentSlot.id}` : "NEW"}`
    : "";

  const primaryButtonLabel = !currentUser
    ? "접속하기 (START)"
    : recentSlot
      ? "이어가기 (START)"
      : "플레이 허브 열기 (START)";

  const handlePrimaryAction = () => {
    if (!currentUser) {
      navigate("/auth");
      return;
    }

    if (recentSlot) {
      navigate(`/play/${recentSlot.id}`);
      return;
    }

    navigate("/play");
  };

  const renderPanelBody = () => {
    if (activeWindowId === "folder-island") {
      return (
        <div className="notebook-system-panel__content notebook-system-panel__content--archive">
          <div className="notebook-system-panel__copy">
            <h1 className="notebook-system-panel__title">
              <span>FILE</span>
              <span>ARCHIVE</span>
            </h1>
            <p className="notebook-system-panel__subtitle">{systemMeta.subtitle}</p>
          </div>

          <div className="notebook-system-panel__field">
            <span>{systemMeta.inputLabel}</span>
            <div className="notebook-system-panel__fake-input">
              <span>{systemMeta.placeholder}</span>
            </div>
          </div>

          <div className="notebook-system-panel__archive-links">
            <Link className="notebook-archive-link" to="/guide">
              <strong>진화 가이드</strong>
              <span>기종 차이, 성장 루트, 배틀 조건을 다시 확인합니다.</span>
            </Link>
            <Link className="notebook-archive-link" to={currentUser ? "/me/collection" : "/auth"}>
              <strong>도감과 기록</strong>
              <span>내 디지몬, 수집 도감, 최근 활동 기록을 엽니다.</span>
            </Link>
            <Link className="notebook-archive-link" to="/support">
              <strong>저장 방식 확인</strong>
              <span>현재 저장 구조와 문제 해결 문서를 바로 확인합니다.</span>
            </Link>
          </div>

          <p className="notebook-system-panel__footnote">{systemMeta.note}</p>
        </div>
      );
    }

    if (activeWindowId === "memories") {
      return (
        <div className="notebook-system-panel__content notebook-system-panel__content--memory">
          <div className="notebook-system-panel__copy">
            <h1 className="notebook-system-panel__title">
              <span>MEMORY</span>
              <span>NOTE</span>
            </h1>
            <p className="notebook-system-panel__subtitle">{systemMeta.subtitle}</p>
          </div>

          <div className="notebook-system-panel__field">
            <span>{systemMeta.inputLabel}</span>
            <div className="notebook-system-panel__fake-input">
              <span>{systemMeta.placeholder}</span>
            </div>
          </div>

          <p className="notebook-system-panel__quote">
            마지막 열차에서 안녕. 플랫폼에 남은 건 작은 디지바이스의 빛과 다시 만나자는 짧은 인사뿐이었습니다.
          </p>
          <MemoryNotesPanel notes={notebookFileIslandVariant.memoryNotes} />
          <p className="notebook-system-panel__footnote">{systemMeta.note}</p>
        </div>
      );
    }

    return (
      <div className="notebook-system-panel__content">
        <div className="notebook-system-panel__copy">
          <h1 className="notebook-system-panel__title">
            <span>DIGITAL</span>
            <span>WORLD</span>
          </h1>
          <p className="notebook-system-panel__subtitle">{systemMeta.subtitle}</p>
        </div>

        <div className="notebook-system-panel__field">
          <span>{systemMeta.inputLabel}</span>
          <div className="notebook-system-panel__fake-input">
            <span>{currentUser ? partnerCodeValue : systemMeta.placeholder}</span>
          </div>
        </div>

        {currentUser ? (
          <div className="notebook-system-panel__summary">
            <span>{recentSlot ? getSlotDisplayName(recentSlot) : `${displayTamerName}님의 첫 디지몬`}</span>
            <span>{loading ? "디지몬 기록을 불러오는 중..." : recentSlot ? getSlotStageLabel(recentSlot) : "플레이 허브에서 시작 가능"}</span>
          </div>
        ) : null}

        <button
          type="button"
          className="notebook-system-panel__cta"
          onClick={handlePrimaryAction}
        >
          {primaryButtonLabel}
        </button>
        <p className="notebook-system-panel__footnote">{systemMeta.note}</p>
      </div>
    );
  };

  return (
    <section className="notebook-home notebook-home--v2">
      <div className="notebook-home__frame">
        <div className="notebook-home__frame-tab" aria-hidden="true" />
        <div className="notebook-home__frame-pin notebook-home__frame-pin--left" aria-hidden="true" />
        <div className="notebook-home__frame-pin notebook-home__frame-pin--right" aria-hidden="true" />

        <div className="notebook-home__desktop">
          <div className="notebook-home__wallpaper" aria-hidden="true" />
          <div className="notebook-home__noise" aria-hidden="true" />

          <aside className="notebook-home__icon-column">
            {notebookFileIslandVariant.icons.map((icon) => (
              <DesktopIcon
                key={icon.id}
                icon={icon.icon}
                label={icon.label}
                description={icon.description}
                isActive={icon.id === activeWindowId}
                onClick={() => setActiveWindowId(icon.id)}
              />
            ))}
          </aside>

          <div className="notebook-home__center-column">
            <p className="notebook-home__panel-meta">{`No. 260 | @hansol_notebook | ${metaDate}`}</p>

            <section className="notebook-system-panel" aria-label={activeIcon.label}>
              <header className="notebook-system-panel__header">
                <span>{systemMeta.code}</span>
                <div className="notebook-system-panel__window-actions" aria-hidden="true">
                  <span />
                  <span />
                </div>
              </header>

              {renderPanelBody()}
            </section>
          </div>

          <aside className="notebook-home__utility-column">
            <button
              type="button"
              className={`notebook-utility-card${
                activeWindowId === "folder-island" ? " notebook-utility-card--active" : ""
              }`}
              onClick={() => setActiveWindowId("folder-island")}
            >
              <span>HISTORICAL LOG</span>
              <strong>진화 기록소</strong>
            </button>
            <button
              type="button"
              className={`notebook-utility-card${
                activeWindowId === "memories" ? " notebook-utility-card--active" : ""
              }`}
              onClick={() => setActiveWindowId("memories")}
            >
              <span>CUSTOMIZATION</span>
              <strong>셸 커스터마이징</strong>
            </button>
          </aside>
        </div>
      </div>

      <div className="notebook-home__gold-strip" aria-hidden="true" />

      <footer className="notebook-taskbar">
        <button
          type="button"
          className="notebook-taskbar__start"
          onClick={() => setActiveWindowId("file-island")}
        >
          <span className="notebook-taskbar__start-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          START
        </button>

        <Link className="notebook-taskbar__label notebook-taskbar__label--link" to="/">
          HANSOL_NOTEBOOK
        </Link>
        <div className="notebook-taskbar__status">BATTERY: 88%</div>
        <div className="notebook-taskbar__status">SIGNAL: MAX</div>
      </footer>
    </section>
  );
}

export default NotebookLanding;

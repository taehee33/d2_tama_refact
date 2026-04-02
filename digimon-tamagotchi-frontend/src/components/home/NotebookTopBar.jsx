import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import notebookFileIslandVariant from "../../data/homeLandingVariants";
import {
  communityBoards,
  getCommunityBoardHref,
  resolveCommunityBoardId,
} from "../../data/serviceContent";

const notebookMenuLinks = [
  { to: "/landing", label: "둘러보기" },
  { to: "/guide", label: "가이드" },
  { id: "community", label: "커뮤니티" },
  { to: "/news", label: "소식" },
];

function NotebookTopBar() {
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [isCommunityMenuOpen, setIsCommunityMenuOpen] = useState(false);
  const communityMenuRef = useRef(null);
  const isCommunityRoute = location.pathname === "/community";
  const activeCommunityBoardId = resolveCommunityBoardId(location.search);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setIsCommunityMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isCommunityMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!communityMenuRef.current?.contains(event.target)) {
        setIsCommunityMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCommunityMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCommunityMenuOpen]);

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(now),
    [now]
  );

  const formattedTime = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now),
    [now]
  );

  return (
    <header className="notebook-topbar notebook-topbar--v2">
      <div className="notebook-topbar__inner">
        <Link className="notebook-topbar__title" to="/notebook">
          {`${notebookFileIslandVariant.metaBarText}: OK`}
        </Link>

        <nav className="notebook-topbar__nav" aria-label="노트북 빠른 메뉴">
          {notebookMenuLinks.map((item) => (
            item.id === "community" ? (
              <div
                key={item.id}
                className="notebook-topbar__item notebook-topbar__item--menu"
                ref={communityMenuRef}
              >
                <button
                  type="button"
                  className={`notebook-topbar__link notebook-topbar__link--button${
                    isCommunityRoute ? " notebook-topbar__link--active" : ""
                  }${isCommunityMenuOpen ? " notebook-topbar__link--open" : ""}`}
                  onClick={() => setIsCommunityMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={isCommunityMenuOpen}
                  aria-label="커뮤니티"
                >
                  {item.label}
                </button>

                {isCommunityMenuOpen ? (
                  <div
                    className="notebook-topbar__menu"
                    role="menu"
                    aria-label="커뮤니티 게시판 메뉴"
                  >
                    {communityBoards.map((board) => {
                      const isActiveBoard =
                        isCommunityRoute && board.id === activeCommunityBoardId;

                      return (
                        <Link
                          key={board.id}
                          to={getCommunityBoardHref(board.id)}
                          className={`notebook-topbar__menu-link${
                            isActiveBoard
                              ? " notebook-topbar__menu-link--active"
                              : ""
                          }`}
                          onClick={() => setIsCommunityMenuOpen(false)}
                        >
                          <strong>{board.title}</strong>
                          <span>{board.status}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `notebook-topbar__link${isActive ? " notebook-topbar__link--active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            )
          ))}
        </nav>

        <div className="notebook-topbar__statusline">
          <Link className="notebook-topbar__return" to="/">
            HOME:// RETURN
          </Link>

          <div className="notebook-topbar__clock" aria-label="현재 날짜와 시각">
            <span>{formattedDate}</span>
            <strong>{formattedTime}</strong>
          </div>
        </div>
      </div>
    </header>
  );
}

export default NotebookTopBar;

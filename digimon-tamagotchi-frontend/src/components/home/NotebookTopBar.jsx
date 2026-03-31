import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import notebookFileIslandVariant from "../../data/homeLandingVariants";

const notebookMenuLinks = [
  { to: "/landing", label: "둘러보기" },
  { to: "/guide", label: "가이드" },
  { to: "/community", label: "커뮤니티" },
  { to: "/news", label: "소식" },
];

function NotebookTopBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `notebook-topbar__link${isActive ? " notebook-topbar__link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
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

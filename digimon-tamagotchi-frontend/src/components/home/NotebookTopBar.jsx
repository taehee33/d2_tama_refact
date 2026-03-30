import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import notebookFileIslandVariant from "../../data/homeLandingVariants";

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

import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import NotebookTopBar from "../home/NotebookTopBar";

const links = [
  { to: "/", label: "홈" },
  { to: "/play", label: "플레이" },
  { to: "/guide", label: "가이드" },
  { to: "/community", label: "커뮤니티" },
  { to: "/news", label: "소식" },
];

function TopNavigation() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const isNotebookRoute = location.pathname === "/notebook";

  if (isNotebookRoute) {
    return <NotebookTopBar />;
  }

  return (
    <header className="service-topnav">
      <div className="service-topnav__inner">
        <Link className="service-brand" to="/">
          <span className="service-brand__eyebrow">D2 TAMAGOTCHI</span>
          <span className="service-brand__title">디지몬 키우기</span>
        </Link>

        <nav className="service-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `service-nav__link${isActive ? " service-nav__link--active" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
          {currentUser && (
            <NavLink
              to="/me"
              className={({ isActive }) =>
                `service-nav__link${isActive ? " service-nav__link--active" : ""}`
              }
            >
              마이
            </NavLink>
          )}
          <NavLink
            to="/notebook"
            className={({ isActive }) =>
              `service-nav__link${isActive ? " service-nav__link--active" : ""}`
            }
          >
            노트북
          </NavLink>
        </nav>

        <div className="service-topnav__actions">
          <Link className="service-topnav__cta" to={currentUser ? "/play" : "/auth"}>
            {currentUser ? "내 디지몬 보기" : "로그인"}
          </Link>
        </div>
      </div>
    </header>
  );
}

export default TopNavigation;

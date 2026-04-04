import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function getDisplayTamerName(currentUser, tamerName) {
  return (
    tamerName ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "익명의 테이머"
  );
}

export function useHeaderAccountMenu({ tamerName = "" } = {}) {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const accountMenuRef = useRef(null);
  const displayTamerName = getDisplayTamerName(currentUser, tamerName);

  useEffect(() => {
    setIsAccountMenuOpen(false);
    setMenuError("");
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
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
  }, [isAccountMenuOpen]);

  const toggleAccountMenu = () => {
    setMenuError("");
    setIsAccountMenuOpen((prev) => !prev);
  };

  const closeAccountMenu = () => {
    setIsAccountMenuOpen(false);
  };

  const handleSettingsClick = () => {
    closeAccountMenu();
    navigate("/me/settings");
  };

  const handleLogoutClick = async () => {
    setIsLogoutLoading(true);
    setMenuError("");

    try {
      await logout();
      closeAccountMenu();
      navigate("/auth");
    } catch (error) {
      setMenuError(error.message || "로그아웃 중 오류가 발생했습니다.");
    } finally {
      setIsLogoutLoading(false);
    }
  };

  return {
    currentUser,
    displayTamerName,
    isAccountMenuOpen,
    isLogoutLoading,
    menuError,
    accountMenuRef,
    toggleAccountMenu,
    closeAccountMenu,
    handleSettingsClick,
    handleLogoutClick,
  };
}

export default useHeaderAccountMenu;

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getTamerName } from "../utils/tamerNameUtils";
import {
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
  getAchievementsAndMaxSlots,
} from "../utils/userProfileUtils";

export const TAMER_PROFILE_REFRESH_EVENT = "d2:tamer-profile-refresh";

function getFallbackTamerName(currentUser) {
  return (
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "익명의 테이머"
  );
}

export function emitTamerProfileRefresh(detail = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(TAMER_PROFILE_REFRESH_EVENT, {
      detail,
    })
  );
}

export function useTamerProfile() {
  const { currentUser } = useAuth();
  const [tamerName, setTamerName] = useState("");
  const [achievements, setAchievements] = useState([]);
  const [maxSlots, setMaxSlots] = useState(10);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!currentUser) {
      setTamerName("");
      setAchievements([]);
      setMaxSlots(10);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [resolvedTamerName, profile] = await Promise.all([
        getTamerName(currentUser.uid, currentUser.displayName),
        getAchievementsAndMaxSlots(currentUser.uid),
      ]);

      setTamerName(resolvedTamerName || getFallbackTamerName(currentUser));
      setAchievements(profile.achievements || []);
      setMaxSlots(profile.maxSlots ?? 10);
    } catch (error) {
      console.error("테이머 프로필 로드 오류:", error);
      setTamerName(getFallbackTamerName(currentUser));
      setAchievements([]);
      setMaxSlots(10);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleProfileRefresh = (event) => {
      const refreshedUid = event?.detail?.uid;

      if (refreshedUid && currentUser?.uid && refreshedUid !== currentUser.uid) {
        return;
      }

      refreshProfile();
    };

    window.addEventListener(TAMER_PROFILE_REFRESH_EVENT, handleProfileRefresh);

    return () => {
      window.removeEventListener(TAMER_PROFILE_REFRESH_EVENT, handleProfileRefresh);
    };
  }, [currentUser, refreshProfile]);

  return {
    currentUser,
    tamerName,
    setTamerName,
    achievements,
    maxSlots,
    loading,
    refreshProfile,
    displayTamerName: tamerName || getFallbackTamerName(currentUser),
    hasVer1Master: achievements.includes(ACHIEVEMENT_VER1_MASTER),
    hasVer2Master: achievements.includes(ACHIEVEMENT_VER2_MASTER),
  };
}

export default useTamerProfile;

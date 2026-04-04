import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { loadEncyclopedia } from "./useEncyclopedia";
import { buildEncyclopediaSummary } from "../utils/encyclopediaSummary";

const EMPTY_SUMMARY = buildEncyclopediaSummary({});

export function useEncyclopediaSummary() {
  const { currentUser } = useAuth();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const loadSummary = async () => {
      if (!currentUser) {
        setSummary(EMPTY_SUMMARY);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const encyclopedia = await loadEncyclopedia(currentUser);

        if (!isCancelled) {
          setSummary(buildEncyclopediaSummary(encyclopedia));
        }
      } catch (error) {
        console.error("도감 요약 로드 오류:", error);
        if (!isCancelled) {
          setSummary(EMPTY_SUMMARY);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadSummary();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  return {
    ...summary,
    loading,
  };
}

export default useEncyclopediaSummary;


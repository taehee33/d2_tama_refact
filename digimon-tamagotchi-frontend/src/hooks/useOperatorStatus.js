import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchOperatorStatus } from "../utils/operatorApi";

const EMPTY_OPERATOR_STATUS = {
  isOperator: false,
  canAccessUserDirectory: false,
};

export default function useOperatorStatus() {
  const { currentUser } = useAuth();
  const [operatorStatus, setOperatorStatus] = useState(EMPTY_OPERATOR_STATUS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) {
      setOperatorStatus(EMPTY_OPERATOR_STATUS);
      setIsLoading(false);
      setError("");
      return undefined;
    }

    let isMounted = true;

    void (async () => {
      try {
        if (isMounted) {
          setIsLoading(true);
          setError("");
        }

        const nextStatus = await fetchOperatorStatus(currentUser);

        if (isMounted) {
          setOperatorStatus({
            ...EMPTY_OPERATOR_STATUS,
            ...nextStatus,
          });
        }
      } catch (nextError) {
        if (isMounted) {
          setOperatorStatus(EMPTY_OPERATOR_STATUS);
          setError(nextError.message || "운영자 상태를 확인하지 못했습니다.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  return {
    operatorStatus,
    isLoading,
    error,
  };
}

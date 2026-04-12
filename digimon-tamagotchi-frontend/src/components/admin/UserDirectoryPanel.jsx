import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchArenaUserDirectory, setArenaUserOperatorRole } from "../../utils/arenaApi";

function createEmptyUserDirectorySummary() {
  return {
    totalUsers: 0,
    operatorCount: 0,
    generalUserCount: 0,
  };
}

function formatUserTimestamp(value) {
  if (!value) {
    return "기록 없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "기록 없음";
  }

  return date.toLocaleString("ko-KR");
}

function getUserRoleBadgeClassName(user) {
  if (user?.isOperator) {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-slate-100 text-slate-600";
}

export default function UserDirectoryPanel({ currentUser }) {
  const [userDirectory, setUserDirectory] = useState([]);
  const [userDirectorySummary, setUserDirectorySummary] = useState(createEmptyUserDirectorySummary());
  const [userDirectoryLoading, setUserDirectoryLoading] = useState(false);
  const [userDirectoryError, setUserDirectoryError] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userActionUid, setUserActionUid] = useState("");

  const filteredUserDirectory = useMemo(() => {
    const query = String(userSearchQuery || "").trim().toLowerCase();

    if (!query) {
      return userDirectory;
    }

    return userDirectory.filter((user) =>
      [user.tamerName, user.displayName, user.email, user.uid, user.roleLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [userDirectory, userSearchQuery]);

  const operatorCount = useMemo(() => {
    if (Number.isFinite(Number(userDirectorySummary.operatorCount))) {
      return Number(userDirectorySummary.operatorCount);
    }

    return userDirectory.filter((user) => user.isOperator).length;
  }, [userDirectory, userDirectorySummary.operatorCount]);

  const loadUserDirectory = useCallback(async () => {
    if (!currentUser) {
      setUserDirectory([]);
      setUserDirectorySummary(createEmptyUserDirectorySummary());
      setUserDirectoryError("로그인이 필요합니다.");
      return;
    }

    try {
      setUserDirectoryLoading(true);
      setUserDirectoryError("");
      const payload = await fetchArenaUserDirectory(currentUser);
      setUserDirectory(Array.isArray(payload?.users) ? payload.users : []);
      setUserDirectorySummary(payload?.summary || createEmptyUserDirectorySummary());
    } catch (error) {
      console.error("사용자 목록 로드 오류:", error);
      setUserDirectory([]);
      setUserDirectorySummary(createEmptyUserDirectorySummary());
      setUserDirectoryError(error.message || "사용자 목록을 불러오지 못했습니다.");
    } finally {
      setUserDirectoryLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadUserDirectory();
  }, [loadUserDirectory]);

  const isLastOperator = useCallback(
    (user) => Boolean(user?.isOperator) && operatorCount <= 1,
    [operatorCount]
  );

  const handleOperatorRoleChange = useCallback(
    async (user, nextIsOperator) => {
      if (!currentUser || !user?.uid) {
        return;
      }

      if (!nextIsOperator && isLastOperator(user)) {
        setUserDirectoryError("마지막 운영자 권한은 해제할 수 없습니다.");
        return;
      }

      const actionLabel = nextIsOperator ? "부여" : "해제";
      const targetLabel = user.tamerName || user.displayName || user.email || user.uid;
      const shouldProceed =
        typeof window === "undefined" || typeof window.confirm !== "function"
          ? true
          : window.confirm(`${targetLabel} 계정에 운영자 권한을 ${actionLabel}할까요?`);

      if (!shouldProceed) {
        return;
      }

      try {
        setUserActionUid(user.uid);
        setUserDirectoryError("");
        await setArenaUserOperatorRole(currentUser, {
          targetUid: user.uid,
          isOperator: nextIsOperator,
        });
        await loadUserDirectory();
      } catch (error) {
        console.error("운영자 권한 변경 오류:", error);
        setUserDirectoryError(error.message || "운영자 권한을 변경하지 못했습니다.");
      } finally {
        setUserActionUid("");
      }
    },
    [currentUser, isLastOperator, loadUserDirectory]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">전체 사용자 목록</p>
          <p className="text-xs text-gray-500">
            운영자 여부는 Firestore `operator_roles` 문서 기준으로 즉시 반영됩니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:w-72"
            placeholder="테이머명, 이메일, UID 검색"
            value={userSearchQuery}
            onChange={(event) => setUserSearchQuery(event.target.value)}
          />
          <button
            type="button"
            onClick={() => void loadUserDirectory()}
            disabled={userDirectoryLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {userDirectoryLoading ? "새로고침 중..." : "새로고침"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">전체 사용자</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{userDirectorySummary.totalUsers}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">운영자</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{userDirectorySummary.operatorCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">일반 사용자</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{userDirectorySummary.generalUserCount}</p>
        </div>
      </div>

      {userDirectoryError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {userDirectoryError}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">사용자 디렉터리</h3>
          <p className="text-xs text-gray-500">현재 표시 {filteredUserDirectory.length}명</p>
        </div>

        {userDirectoryLoading ? (
          <p className="text-sm text-gray-500">사용자 목록을 불러오는 중입니다.</p>
        ) : filteredUserDirectory.length === 0 ? (
          <p className="text-sm text-gray-500">조건에 맞는 사용자가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {filteredUserDirectory.map((user) => {
              const isCurrentUser = currentUser?.uid === user.uid;
              const disableDemote = userActionUid === user.uid || isLastOperator(user);
              const disablePromote = userActionUid === user.uid;

              return (
                <article
                  key={user.uid}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-lg text-gray-900">{user.tamerName || "이름 없음"}</strong>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${getUserRoleBadgeClassName(
                            user
                          )}`}
                        >
                          {user.isOperator ? "운영자" : "일반"}
                        </span>
                        {isCurrentUser ? (
                          <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                            현재 계정
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <p>이메일: {user.email || "미등록"}</p>
                        <p>UID: {user.uid}</p>
                        <p>표시명: {user.displayName || "없음"}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {user.isOperator ? (
                          <button
                            type="button"
                            onClick={() => void handleOperatorRoleChange(user, false)}
                            disabled={disableDemote}
                            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {userActionUid === user.uid ? "변경 중..." : "운영자 해제"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleOperatorRoleChange(user, true)}
                            disabled={disablePromote}
                            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {userActionUid === user.uid ? "변경 중..." : "운영자 지정"}
                          </button>
                        )}
                      </div>

                      {user.isOperator && isLastOperator(user) ? (
                        <p className="text-xs font-medium text-rose-600">
                          마지막 운영자는 해제할 수 없습니다.
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:min-w-[420px]">
                      <div className="rounded-lg border border-white bg-white px-3 py-2">
                        <p className="text-xs text-gray-500">업적 / 최대 슬롯</p>
                        <p className="font-semibold text-gray-900">
                          {user.achievementCount}개 / {user.maxSlots}칸
                        </p>
                      </div>
                      <div className="rounded-lg border border-white bg-white px-3 py-2">
                        <p className="text-xs text-gray-500">최근 갱신</p>
                        <p className="font-semibold text-gray-900">
                          {formatUserTimestamp(user.updatedAt)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white bg-white px-3 py-2">
                        <p className="text-xs text-gray-500">권한 갱신</p>
                        <p className="font-semibold text-gray-900">
                          {formatUserTimestamp(user.roleUpdatedAt)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white bg-white px-3 py-2">
                        <p className="text-xs text-gray-500">생성 시각</p>
                        <p className="font-semibold text-gray-900">
                          {formatUserTimestamp(user.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

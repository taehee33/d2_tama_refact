import React from "react";
import UserDirectoryPanel from "../components/admin/UserDirectoryPanel";
import { useAuth } from "../contexts/AuthContext";
import useOperatorStatus from "../hooks/useOperatorStatus";

function OperatorUsers() {
  const { currentUser } = useAuth();
  const { operatorStatus, isLoading, error } = useOperatorStatus();

  return (
    <section className="service-page">
      <div className="service-card">
        <p className="service-section-label">운영자 도구</p>
        <h1>사용자 디렉터리</h1>
        <p>
          전체 사용자 흐름과 현재 운영 권한 분포를 한 화면에서 확인할 수 있도록
          정리했습니다.
        </p>
        {operatorStatus.isOperator ? (
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              운영자
            </span>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="service-card service-card--soft">
          <p className="service-section-label">권한 확인</p>
          <h2>운영자 권한을 확인하고 있습니다</h2>
          <p className="service-muted">잠시만 기다리면 사용자 디렉터리를 불러옵니다.</p>
        </div>
      ) : error ? (
        <div className="service-card service-card--soft">
          <p className="service-section-label">오류</p>
          <h2>운영자 상태를 확인하지 못했습니다</h2>
          <p className="service-muted">{error}</p>
        </div>
      ) : !operatorStatus.canAccessUserDirectory ? (
        <div className="service-card service-card--soft">
          <p className="service-section-label">접근 제한</p>
          <h2>운영자 권한이 필요합니다</h2>
          <p className="service-muted">
            이 페이지는 현재 운영 권한을 가진 계정만 볼 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="service-card">
          <UserDirectoryPanel currentUser={currentUser} />
        </div>
      )}
    </section>
  );
}

export default OperatorUsers;

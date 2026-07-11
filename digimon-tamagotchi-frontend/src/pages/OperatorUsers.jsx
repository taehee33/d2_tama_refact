import React, { useState } from "react";
import UserDirectoryPanel from "../components/admin/UserDirectoryPanel";
import DigimonMasterDataPanel from "../components/DigimonMasterDataPanel";
import { useAuth } from "../contexts/AuthContext";
import useOperatorStatus from "../hooks/useOperatorStatus";

function OperatorUsers() {
  const { currentUser } = useAuth();
  const { operatorStatus, isLoading, error } = useOperatorStatus();
  const [activeTab, setActiveTab] = useState("users");

  return (
    <section className="service-page">
      <div className="service-card">
        <p className="service-section-label">운영자 전용</p>
        <h1>운영자 설정</h1>
        <p>
          사용자 권한과 디지몬 마스터 데이터를 한곳에서 관리합니다.
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
        <>
          <div className="operator-settings-tabs" role="tablist" aria-label="운영자 설정 메뉴">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "users"}
              className={`operator-settings-tab${activeTab === "users" ? " operator-settings-tab--active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              사용자관리
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "master-data"}
              className={`operator-settings-tab${activeTab === "master-data" ? " operator-settings-tab--active" : ""}`}
              onClick={() => setActiveTab("master-data")}
            >
              디지몬 마스터 데이터
            </button>
          </div>

          {activeTab === "users" ? (
            <div className="service-card" role="tabpanel">
              <UserDirectoryPanel currentUser={currentUser} />
            </div>
          ) : (
            <div className="operator-master-data" role="tabpanel">
              <div className="operator-master-data__header">
                <p className="service-section-label">전역 게임 데이터</p>
                <h2>디지몬 마스터 데이터</h2>
                <p>Firestore 기준의 종족 기본값과 스냅샷, 복원 데이터를 관리합니다.</p>
              </div>
              <DigimonMasterDataPanel />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default OperatorUsers;

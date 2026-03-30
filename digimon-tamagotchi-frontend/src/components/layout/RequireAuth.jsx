import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

function RequireAuth({ children }) {
  const location = useLocation();
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-5 text-sm text-slate-200 shadow-lg">
          로그인 상태를 확인하는 중...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children || <Outlet />;
}

export default RequireAuth;

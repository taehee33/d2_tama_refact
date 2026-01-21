// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { initializeTamerName } from "../utils/tamerNameUtils";

function Login() {
  const navigate = useNavigate();
  const { signInWithGoogle, currentUser, isFirebaseAvailable } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 이미 로그인되어 있으면 select 페이지로 이동
  useEffect(() => {
    if (currentUser) {
      navigate("/select");
    }
  }, [currentUser, navigate]);

  // Firebase가 없으면 에러 표시
  useEffect(() => {
    if (!isFirebaseAvailable) {
      console.error('Firebase가 설정되지 않았습니다. Firebase 설정이 필요합니다.');
    }
  }, [isFirebaseAvailable]);

  // Google 로그인 처리
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Firebase signInWithPopup을 사용하여 Google 로그인
      const result = await signInWithGoogle();
      const user = result.user;

      if (user) {
        console.log("로그인 성공:", user.uid);
        
        // Firestore의 /users/{uid}에 유저 정보 저장
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          tamerName: null, // null이면 displayName 사용
          createdAt: new Date(),
          updatedAt: new Date(),
        }, { merge: true });
        
        // 테이머명 초기화 (기존 tamerName이 없으면 displayName 사용)
        await initializeTamerName(user.uid, user.displayName);

        // 로그인 성공 후 SelectScreen으로 리디렉션
        // AuthContext의 onAuthStateChanged 리스너가 currentUser를 업데이트하므로
        // SelectScreen에서 자동으로 인증 상태를 감지함
        navigate("/select");
      }
    } catch (err) {
      console.error("로그인 오류:", err);
      setError(err.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center">디지몬 다마고치</h1>
        
        {!isFirebaseAvailable ? (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            <p className="font-semibold">Firebase가 설정되지 않았습니다.</p>
            <p className="text-sm mt-1">Firebase 설정이 필요합니다. .env 파일에 Firebase 설정을 추가해주세요.</p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6 text-center">
              Google 계정으로 로그인하여 시작하세요
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>로그인 중...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Google로 로그인</span>
            </>
          )}
        </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
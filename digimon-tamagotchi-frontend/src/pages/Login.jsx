// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { initializeTamerName } from "../utils/tamerNameUtils";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithGoogle, signInAnonymously, currentUser, isFirebaseAvailable } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(null); // 'google', 'anonymous'
  const [error, setError] = useState(null);
  const redirectTo = location.state?.from?.pathname || "/play";

  // 이미 로그인되어 있으면 플레이 허브로 이동
  useEffect(() => {
    if (currentUser) {
      navigate(redirectTo, { replace: true });
    }
  }, [currentUser, navigate, redirectTo]);

  // Firebase가 없으면 에러 표시
  useEffect(() => {
    if (!isFirebaseAvailable) {
      console.error('Firebase가 설정되지 않았습니다. Firebase 설정이 필요합니다.');
    }
  }, [isFirebaseAvailable]);

  // 공통 로그인 후 처리 함수
  const handlePostLogin = async (user, isAnonymous = false) => {
    console.log(`${isAnonymous ? '익명/임시' : 'Google'} 로그인 성공:`, user.uid);
    
    // Firestore의 /users/{uid}에 유저 정보 저장
    const userRef = doc(db, 'users', user.uid);
    const userData = {
      email: user.email || null,
      displayName: user.displayName || (isAnonymous ? `게스트_${user.uid.slice(0, 6)}` : null),
      photoURL: user.photoURL || null,
      tamerName: null, // null이면 displayName 사용
      isAnonymous: isAnonymous,
      updatedAt: new Date(),
    };

    // 기존 문서가 있는지 확인
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // 새 사용자인 경우에만 createdAt 설정
      userData.createdAt = new Date();
    }
    
    await setDoc(userRef, userData, { merge: true });
    
    // 테이머명 초기화
    const displayName = user.displayName || (isAnonymous ? `게스트_${user.uid.slice(0, 6)}` : null);
    await initializeTamerName(user.uid, displayName);

    // 로그인 성공 후 플레이 허브로 리디렉션
    navigate(redirectTo, { replace: true });
  };

  // Google 로그인 처리
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setLoadingType('google');
      setError(null);
      
      const result = await signInWithGoogle();
      const user = result.user;

      if (user) {
        await handlePostLogin(user, false);
      }
    } catch (err) {
      console.error("Google 로그인 오류:", err);
      setError(err.message || "Google 로그인에 실패했습니다.");
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  // 익명 로그인 처리
  const handleAnonymousLogin = async () => {
    try {
      setLoading(true);
      setLoadingType('anonymous');
      setError(null);
      
      const result = await signInAnonymously();
      const user = result.user;

      if (user) {
        await handlePostLogin(user, true);
      }
    } catch (err) {
      console.error("익명 로그인 오류:", err);
      
      // Firebase 오류 코드에 따른 사용자 친화적 메시지
      let errorMessage = "익명 로그인에 실패했습니다.";
      if (err.code === 'auth/admin-restricted-operation') {
        errorMessage = "익명 로그인이 활성화되지 않았습니다. Firebase Console에서 익명 로그인을 활성화해주세요.";
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = "익명 로그인이 허용되지 않았습니다. Firebase Console에서 익명 로그인을 활성화해주세요.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };



  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(250,242,231,0.96)_45%,_rgba(235,247,243,0.96)_100%)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-[40px] border border-white/80 bg-white/80 p-8 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
            Auth
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-slate-900 sm:text-5xl">
            디지몬 서비스 셸에 로그인
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
            플레이 허브, 몰입형 플레이, 테이머 허브를 같은 계정 흐름으로 이어서 사용할 수 있도록 로그인 구조를 정리했습니다.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] bg-[#f7f4ed] p-5">
              <h2 className="text-lg font-black text-slate-900">플레이 허브</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                새 디지몬 생성, 이어하기, 슬롯 정리를 한 화면에서 처리합니다.
              </p>
            </div>
            <div className="rounded-[28px] bg-[#edf7f4] p-5">
              <h2 className="text-lg font-black text-slate-900">테이머 허브</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                도감, 계정 설정, 최근 디지몬 흐름을 서비스처럼 탐색합니다.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-white/80 bg-white/92 p-8 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-black text-center text-slate-900">로그인 방법 선택</h2>
        
        {!isFirebaseAvailable ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">Firebase가 설정되지 않았습니다.</p>
            <p className="text-sm mt-1">Firebase 설정이 필요합니다. .env 파일에 Firebase 설정을 추가해주세요.</p>
          </div>
        ) : (
          <>
            <p className="mt-3 mb-6 text-center text-sm text-slate-600">
              로그인 후에는 기본적으로 플레이 허브로 이동합니다.
            </p>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* Google 로그인 */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && loadingType === 'google' ? (
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

              {/* 익명 로그인 */}
              <button
                onClick={handleAnonymousLogin}
                disabled={loading}
                className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-[#0f766e] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && loadingType === 'anonymous' ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>로그인 중...</span>
                  </>
                ) : (
                  <>
                    <span>👤</span>
                    <span>게스트로 시작</span>
                  </>
                )}
              </button>

            </div>

            <div className="mt-4 rounded-3xl border border-yellow-200 bg-yellow-50 p-4 text-xs text-yellow-800">
              <p className="mb-1 font-semibold">로그인 방법 안내</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Google 로그인:</strong> 같은 Google 계정으로 로그인하면 여러 기기에서 이어서 플레이하기 쉽습니다.</li>
                <li><strong>게스트 로그인(익명):</strong> 빠르게 시작할 수 있지만, 익명 계정은 로그아웃하거나 기기를 바꾸면 이어서 플레이하기 어려울 수 있습니다.</li>
                <li><strong>현재 저장 계약:</strong> 슬롯 저장은 Firestore 기준이며, 완전 오프라인 localStorage 슬롯 모드는 현재 공식 지원하지 않습니다.</li>
              </ul>
            </div>
          </>
        )}
        </section>
      </div>
    </div>
  );
}

export default Login;

// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signInAnonymously,
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Firebase가 초기화되었는지 확인
  const isFirebaseAvailable = () => {
    return auth !== null;
  };

  // Google 로그인
  const signInWithGoogle = async () => {
    if (!isFirebaseAvailable()) {
      throw new Error('Firebase가 설정되지 않았습니다. .env 파일에 Firebase 설정을 추가하세요.');
    }
    
    const provider = new GoogleAuthProvider();
    // 매번 계정 선택 창이 뜨도록 prompt 옵션 추가
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const result = await signInWithPopup(auth, provider);
      return result; // UserCredential 반환
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      throw error;
    }
  };

  // 익명 로그인
  const signInAnonymouslyAuth = async () => {
    if (!isFirebaseAvailable()) {
      throw new Error('Firebase가 설정되지 않았습니다. .env 파일에 Firebase 설정을 추가하세요.');
    }
    
    try {
      const result = await signInAnonymously(auth);
      return result; // UserCredential 반환
    } catch (error) {
      console.error('익명 로그인 실패:', error);
      throw error;
    }
  };

  // 로그아웃
  const logout = async () => {
    if (!isFirebaseAvailable()) {
      return;
    }
    
    try {
      await signOut(auth);
    } catch (error) {
      console.error('로그아웃 실패:', error);
      throw error;
    }
  };

  // 인증 상태 변경 감지
  useEffect(() => {
    if (!isFirebaseAvailable()) {
      // Firebase가 없으면 로딩 완료 처리 (localStorage 모드)
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    signInWithGoogle,
    signInAnonymously: signInAnonymouslyAuth,
    logout,
    loading,
    isFirebaseAvailable: isFirebaseAvailable(),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};


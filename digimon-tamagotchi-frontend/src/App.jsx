// src/App.jsx
import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import ReactGA from "react-ga4";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AblyContextProvider } from "./contexts/AblyContext";
import { ChannelProvider } from "ably/react";
import ChatRoom from "./components/ChatRoom";
import { getTamerName } from "./utils/tamerNameUtils";
import Login from "./pages/Login";
import SelectScreen from "./pages/SelectScreen";
import Game from "./pages/Game";

const CHANNEL_NAME = 'tamer-lobby';

const GA_ID = process.env.REACT_APP_GA_ID;

// 페이지뷰 추적을 위한 컴포넌트
function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    // GA4 초기화 (한 번만)
    if (GA_ID && !window.gaInitialized) {
      ReactGA.initialize(GA_ID);
      window.gaInitialized = true;
    }

    // 페이지뷰 전송 (라우트 변경 시)
    if (GA_ID && window.gaInitialized) {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    }
  }, [location]);

  return null;
}

// ChatRoom을 렌더링하는 컴포넌트 (AblyProvider 내부에서만 사용)
function ChatRoomWrapper() {
  const location = useLocation();
  const { currentUser } = useAuth();

  // 로그인 페이지가 아닐 때만 ChatRoom 표시
  if (!currentUser || location.pathname === '/') {
    return null;
  }

  // ChannelProvider로 감싸서 usePresence, useChannel 등이 작동하도록 함
  return (
    <ChannelProvider channelName={CHANNEL_NAME}>
      <ChatRoom />
    </ChannelProvider>
  );
}

// Ably 및 ChatRoom을 포함한 내부 컴포넌트
function AppContent() {
  const { currentUser } = useAuth();
  const [tamerName, setTamerName] = useState("");

  // 테이머명 로드
  useEffect(() => {
    const loadTamerName = async () => {
      if (currentUser) {
        try {
          const name = await getTamerName(currentUser.uid, currentUser.displayName);
          setTamerName(name);
        } catch (error) {
          console.error("테이머명 로드 오류:", error);
          setTamerName(currentUser.displayName || currentUser.email?.split('@')[0] || "");
        }
      } else {
        setTamerName("");
      }
    };
    loadTamerName();
  }, [currentUser]);

  return (
    <Router>
      <AblyContextProvider 
        tamerName={tamerName} 
        renderChatRoom={() => <ChatRoomWrapper />}
      >
        <PageViewTracker />
        <Routes>
          {/* 로그인 페이지 */}
          <Route path="/" element={<Login />} />

          {/* 기종/버전/슬롯 선택 화면 */}
          <Route path="/select" element={<SelectScreen />} />

          {/* 게임 화면 (슬롯ID 기반) */}
          <Route path="/game/:slotId" element={<Game />} />
        </Routes>
      </AblyContextProvider>
    </Router>
  );
}

function App() {
  useEffect(() => {
    // GA4 초기화 (컴포넌트 마운트 시, 한 번만)
    // PageViewTracker에서도 초기화하지만, 첫 페이지 로드 시 즉시 전송을 위해 여기서도 초기화
    if (GA_ID && !window.gaInitialized) {
      ReactGA.initialize(GA_ID);
      ReactGA.send("pageview");
      window.gaInitialized = true;
    }

    // Ably 채널 detached 상태 및 Connection closed 오류를 무시하는 전역 에러 핸들러
    const originalError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      // Ably 관련 정상적인 클린업 오류는 무시
      if (
        error &&
        (error.message?.includes('Channel operation failed') ||
         error.message?.includes('channel state is detached') ||
         error.message?.includes('detached') ||
         error.message?.includes('Connection closed') ||
         error.message?.includes('closed'))
      ) {
        console.log('⏳ Ably 정상적인 클린업 오류 무시:', error.message);
        return true; // 에러를 처리했음을 표시
      }
      
      // 다른 오류는 기존 핸들러로 전달
      if (originalError) {
        return originalError(message, source, lineno, colno, error);
      }
      return false;
    };

    // React 에러 경계를 위한 unhandledrejection 핸들러
    const handleUnhandledRejection = (event) => {
      if (
        event.reason &&
        (event.reason.message?.includes('Channel operation failed') ||
         event.reason.message?.includes('channel state is detached') ||
         event.reason.message?.includes('detached') ||
         event.reason.message?.includes('Connection closed') ||
         event.reason.message?.includes('closed'))
      ) {
        console.log('⏳ Ably 정상적인 클린업 Promise rejection 무시:', event.reason.message);
        event.preventDefault(); // 에러를 처리했음을 표시
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.onerror = originalError;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <AuthProvider>
      <AppContent />
      {/* Vercel Analytics */}
      <Analytics />
    </AuthProvider>
  );
}

export default App;
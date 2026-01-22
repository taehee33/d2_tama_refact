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

// ChatRoom을 렌더링하는 컴포넌트 (Router 내부에서 사용)
function ChatRoomWrapper() {
  const location = useLocation();
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

  // 로그인 페이지가 아닐 때만 ChatRoom 표시
  if (!currentUser || !tamerName || location.pathname === '/') {
    return null;
  }

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
    <AblyContextProvider tamerName={tamerName} renderChatRoom={() => null}>
      <Router>
        <PageViewTracker />
        <Routes>
          {/* 로그인 페이지 */}
          <Route path="/" element={<Login />} />

          {/* 기종/버전/슬롯 선택 화면 */}
          <Route path="/select" element={<SelectScreen />} />

          {/* 게임 화면 (슬롯ID 기반) */}
          <Route path="/game/:slotId" element={<Game />} />
        </Routes>
        {/* ChatRoom은 Router 내부에서 렌더링 */}
        <ChatRoomWrapper />
      </Router>
    </AblyContextProvider>
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
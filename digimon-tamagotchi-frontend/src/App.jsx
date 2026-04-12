// src/App.jsx
import { useEffect } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import ReactGA from "react-ga4";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AblyContextProvider } from "./contexts/AblyContext";
import { MasterDataProvider, useMasterData } from "./contexts/MasterDataContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ChannelProvider } from "ably/react";
import PlayChatDrawer from "./components/chat/PlayChatDrawer";
import RequireAuth from "./components/layout/RequireAuth";
import ServiceLayout from "./components/layout/ServiceLayout";
import LandingShell from "./components/landing/LandingShell";
import { useTamerProfile } from "./hooks/useTamerProfile";
import Collection from "./pages/Collection";
import Community from "./pages/Community";
import Guide from "./pages/Guide";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Game from "./pages/Game";
import Me from "./pages/Me";
import News from "./pages/News";
import NotebookLanding from "./pages/NotebookLanding";
import OperatorUsers from "./pages/OperatorUsers";
import PlayFull from "./pages/PlayFull";
import PlayHub from "./pages/PlayHub";
import SelectScreen from "./pages/SelectScreen";
import Settings from "./pages/Settings";
import Support from "./pages/Support";

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
function ChatRoomWrapper({ clientReady }) {
  const location = useLocation();
  const { currentUser } = useAuth();
  const isNotebookRoute = location.pathname === "/notebook";
  const isAuthRoute = location.pathname.startsWith("/auth");
  const shouldShowLobbyDrawer =
    !isNotebookRoute &&
    !isAuthRoute &&
    !location.pathname.endsWith("/full");

  if (!currentUser || location.pathname.endsWith("/full")) {
    return null;
  }

  if (shouldShowLobbyDrawer) {
    if (!clientReady) {
      return null;
    }

    return (
      <ChannelProvider channelName={CHANNEL_NAME}>
        <PlayChatDrawer />
      </ChannelProvider>
    );
  }

  return null;
}

// Ably 및 ChatRoom을 포함한 내부 컴포넌트
function AppContent() {
  const { currentUser } = useAuth();
  const { isMasterDataReady } = useMasterData();
  const { tamerName } = useTamerProfile();

  if (!isMasterDataReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-5 text-center text-sm text-slate-200 shadow-lg">
          디지몬 마스터 데이터를 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <Router>
      <AblyContextProvider 
        tamerName={currentUser ? tamerName : null}
        renderChatRoom={(chatState) => <ChatRoomWrapper {...chatState} />}
      >
        <PageViewTracker />
        <Routes>
          <Route element={<ServiceLayout tamerName={currentUser ? tamerName : ""} />}>
            <Route path="/" element={<RootEntry />} />
            <Route path="/notebook" element={<NotebookLanding />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/community" element={<Community />} />
            <Route path="/news" element={<News />} />
            <Route path="/support" element={<Support />} />

            <Route element={<RequireAuth />}>
              <Route path="/play" element={<PlayHub />} />
              <Route path="/me" element={<Me />} />
              <Route path="/me/collection" element={<Collection />} />
              <Route path="/me/settings" element={<Settings />} />
              <Route path="/operators/users" element={<OperatorUsers />} />
            </Route>
          </Route>

          <Route
            path="/landing"
            element={<LandingEntry tamerName={currentUser ? tamerName : ""} />}
          />
          <Route path="/auth" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route path="/play/:slotId" element={<Game />} />
            <Route path="/play/:slotId/full" element={<PlayFull />} />
          </Route>

          <Route path="/select" element={<SelectScreen />} />
          <Route path="/game/:slotId" element={<LegacyGameRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AblyContextProvider>
    </Router>
  );
}

export function RootEntry() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/landing" replace />;
  }

  return <Home />;
}

export function LandingEntry({ tamerName = "" }) {
  return <LandingShell tamerName={tamerName} />;
}

function LegacyGameRedirect() {
  const { slotId } = useParams();
  return <Navigate to={`/play/${slotId}`} replace />;
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
      <ThemeProvider>
        <MasterDataProvider>
          <AppContent />
        </MasterDataProvider>
      </ThemeProvider>
      {/* Vercel Analytics */}
      <Analytics />
    </AuthProvider>
  );
}

export default App;

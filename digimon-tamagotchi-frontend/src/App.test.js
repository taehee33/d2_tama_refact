import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("react-router-dom", () => {
  const React = require("react");

  return {
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <div>{children}</div>,
    Route: ({ element }) => element,
    useLocation: () => ({ pathname: "/", search: "" }),
  };
}, { virtual: true });

jest.mock("@vercel/analytics/react", () => ({
  Analytics: () => null,
}), { virtual: true });

jest.mock("react-ga4", () => ({
  initialize: jest.fn(),
  send: jest.fn(),
}), { virtual: true });

jest.mock("ably/react", () => ({
  ChannelProvider: ({ children }) => <div>{children}</div>,
}), { virtual: true });

jest.mock("./contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    currentUser: null,
  }),
}));

jest.mock("./contexts/AblyContext", () => ({
  AblyContextProvider: ({ children }) => <div>{children}</div>,
}));

jest.mock("./contexts/MasterDataContext", () => ({
  MasterDataProvider: ({ children }) => <div>{children}</div>,
  useMasterData: () => ({
    isMasterDataReady: true,
  }),
}));

jest.mock("./components/ChatRoom", () => () => <div>채팅방</div>);
jest.mock("./pages/Login", () => () => <div>로그인 화면</div>);
jest.mock("./pages/SelectScreen", () => () => <div>슬롯 선택 화면</div>);
jest.mock("./pages/Game", () => () => <div>게임 화면</div>);

test("앱 기본 라우트가 렌더링된다", () => {
  render(<App />);
  expect(screen.getByText("로그인 화면")).toBeInTheDocument();
});

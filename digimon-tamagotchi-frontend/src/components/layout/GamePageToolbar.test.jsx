import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GamePageToolbar from "./GamePageToolbar";

function buildProps(overrides = {}) {
  return {
    currentUser: {
      displayName: "테이머",
      email: "tamer@example.com",
      photoURL: "",
    },
    isFirebaseAvailable: true,
    tamerName: "용사",
    hasVer1Master: true,
    hasVer2Master: false,
    showProfileMenu: false,
    onToggleProfileMenu: jest.fn(),
    onCloseProfileMenu: jest.fn(),
    onOpenAccountSettings: jest.fn(),
    onOpenSettings: jest.fn(),
    onOpenPlayHub: jest.fn(),
    onOpenImmersiveView: jest.fn(),
    onlineUsersNode: <div>접속자 3명</div>,
    ...overrides,
  };
}

describe("GamePageToolbar", () => {
  test("모바일 툴바는 허브, 설정, 몰입형 버튼과 프로필 요약을 렌더링한다", () => {
    const props = buildProps();
    render(<GamePageToolbar {...props} isMobile />);

    expect(screen.getByText("← 허브")).toBeInTheDocument();
    expect(screen.getByText("접속자 3명")).toBeInTheDocument();
    expect(screen.getByTitle("몰입형 플레이")).toBeInTheDocument();
    expect(screen.getByTitle("설정")).toBeInTheDocument();
    expect(screen.getByText("테이머: 용사")).toBeInTheDocument();
    expect(screen.getAllByText("👑 Ver.1")).toHaveLength(2);

    fireEvent.click(screen.getByText("← 허브"));
    fireEvent.click(screen.getByTitle("몰입형 플레이"));
    fireEvent.click(screen.getByTitle("설정"));

    expect(props.onOpenPlayHub).toHaveBeenCalledTimes(1);
    expect(props.onOpenImmersiveView).toHaveBeenCalledTimes(1);
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test("데스크톱 툴바는 드롭다운 메뉴를 열고 계정 설정 액션을 호출한다", () => {
    const props = buildProps({
      showProfileMenu: true,
    });
    render(<GamePageToolbar {...props} />);

    expect(screen.getByText("몰입형 플레이")).toBeInTheDocument();
    expect(screen.getAllByText("테이머: 용사").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("계정 설정/로그아웃")[0]).toBeInTheDocument();

    fireEvent.click(screen.getByText("← 플레이 허브"));
    fireEvent.click(screen.getByText("계정 설정/로그아웃"));
    fireEvent.click(screen.getByText("▼"));

    expect(props.onOpenPlayHub).toHaveBeenCalledTimes(1);
    expect(props.onOpenAccountSettings).toHaveBeenCalledTimes(1);
    expect(props.onToggleProfileMenu).toHaveBeenCalledTimes(1);
  });
});

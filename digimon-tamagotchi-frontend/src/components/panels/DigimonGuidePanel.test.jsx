import React from "react";
import { render, screen } from "@testing-library/react";
import DigimonGuidePanel from "./DigimonGuidePanel";

function hasListText(text) {
  return (_, element) =>
    element?.tagName.toLowerCase() === "li" && element.textContent?.includes(text);
}

describe("DigimonGuidePanel", () => {
  test("기본 가이드가 실제 메뉴 구조와 같은 그룹 문구를 보여준다", () => {
    render(<DigimonGuidePanel initialView="GUIDE" />);

    expect(screen.queryByText(/상단 메뉴/)).not.toBeInTheDocument();
    expect(screen.queryByText(/하단 메뉴/)).not.toBeInTheDocument();
    expect(screen.getByText(hasListText("기본 조작: 상태, 먹이, 훈련, 배틀, 교감"))).toBeInTheDocument();
    expect(screen.getByText(hasListText("케어·도구: 화장실, 조명, 치료, 호출, 더보기"))).toBeInTheDocument();
    expect(screen.getByText(hasListText("더보기: 기록(활동 로그, 배틀 기록)"))).toBeInTheDocument();
  });

  test("Ver.3 조그레스는 Ver.4/Ver.5 데이터가 추가되면 로컬 지원 문구로 표시한다", () => {
    render(
      <DigimonGuidePanel
        initialView="EVOLUTION"
        slotVersion="Ver.3"
        currentDigimonName="BanchoLeomon"
        currentDigimonData={{
          name: "반쵸레오몬",
          evolutions: [
            {
              targetId: "Chaosmon",
              targetName: "카오스몬",
              jogress: {
                partner: "Darkdramon",
                partnerName: "다크드라몬",
                partnerVersion: "Ver.4",
              },
            },
          ],
        }}
        currentStats={{}}
        digimonDataMap={{
          Chaosmon: {
            name: "카오스몬",
          },
        }}
      />
    );

    expect(
      screen.getByText(
        "현재 앱에서 로컬 조그레스로 진행할 수 있습니다. 온라인 조그레스는 Ver.1/Ver.2만 지원합니다."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("파트너: 다크드라몬 Ver.4")).toBeInTheDocument();
  });
});

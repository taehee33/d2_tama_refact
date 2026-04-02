import {
  landingEggStates,
  landingGrowthContent,
  landingHeroContent,
  landingMemorySceneContent,
} from "./landingContent";

describe("landingContent", () => {
  test("핵심 4개 스프라이트 경로를 랜딩 데이터에 연결한다", () => {
    expect(landingHeroContent.imageSrc).toBe("/images/133.png");
    expect(landingEggStates.map((state) => state.imageSrc)).toContain("/images/210.png");
    expect(landingGrowthContent.imageSrc).toBe("/images/225.png");
    expect(landingGrowthContent.nextImageSrc).toBe("/images/240.png");
  });

  test("대형 아트가 없어도 기본 스프라이트 모드로 렌더링할 수 있는 optional 필드를 가진다", () => {
    expect(landingHeroContent.backgroundArtworkSrc).toBeNull();
    expect(landingMemorySceneContent.backgroundArtworkSrc).toBeNull();
    expect(landingMemorySceneContent.overlayQuote).toBeTruthy();
  });
});

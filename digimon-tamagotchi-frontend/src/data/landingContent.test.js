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

  test("주어진 히어로 배경과 중간 대표컷 3장을 랜딩 데이터에 연결한다", () => {
    expect(landingHeroContent.backgroundArtworkSrc).toBe("/images/landing/hero-memory-window.png");
    expect(landingHeroContent.backgroundArtworkAlt).toBe(
      "선택받은 아이들이 창밖으로 손을 흔드는 히어로 장면"
    );
    expect(landingHeroContent.backgroundArtworkPosition).toBe("center top");
    expect(landingHeroContent.backgroundArtworkSize).toBe("cover");
    expect(landingMemorySceneContent.backgroundArtworkSrc).toBeNull();
    expect(landingMemorySceneContent.backgroundArtworkPosition).toBe("center");
    expect(landingMemorySceneContent.backgroundArtworkSize).toBe("cover");
    expect(landingMemorySceneContent.featuredArtworkSrc).toBeNull();
    expect(landingMemorySceneContent.featuredArtworkItems).toHaveLength(3);
    expect(landingMemorySceneContent.featuredArtworkItems.map((item) => item.src)).toEqual([
      "/images/landing/memory-cut-01.png",
      "/images/landing/memory-cut-02.jpg",
      "/images/landing/memory-cut-03.png",
    ]);
    expect(landingMemorySceneContent.overlayQuote).toBeTruthy();
  });
});

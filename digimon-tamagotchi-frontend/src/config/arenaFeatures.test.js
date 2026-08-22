import {
  resolveArenaGhostV2Enabled,
  resolveRealtimeArenaMvpEnabled,
} from "./arenaFeatures";

test("Ghost 아레나 V2는 개발환경에서 별도 플래그 없이 활성화된다", () => {
  expect(resolveArenaGhostV2Enabled({ nodeEnv: "development", featureFlag: undefined })).toBe(true);
});

test("Ghost 아레나 V2는 개발환경에서도 명시적으로 비활성화할 수 있다", () => {
  expect(resolveArenaGhostV2Enabled({ nodeEnv: "development", featureFlag: "false" })).toBe(false);
});

test("Ghost 아레나 V2는 운영환경에서 명시적으로 활성화한 경우에만 열린다", () => {
  expect(resolveArenaGhostV2Enabled({ nodeEnv: "production", featureFlag: undefined })).toBe(false);
  expect(resolveArenaGhostV2Enabled({ nodeEnv: "production", featureFlag: "true" })).toBe(true);
});

test("실시간 배틀은 개발환경에서 별도 플래그 없이 활성화된다", () => {
  expect(resolveRealtimeArenaMvpEnabled({ nodeEnv: "development", featureFlag: undefined })).toBe(true);
});

test("운영환경에서는 명시적으로 활성화한 경우에만 열린다", () => {
  expect(resolveRealtimeArenaMvpEnabled({ nodeEnv: "production", featureFlag: undefined })).toBe(false);
  expect(resolveRealtimeArenaMvpEnabled({ nodeEnv: "production", featureFlag: "true" })).toBe(true);
});

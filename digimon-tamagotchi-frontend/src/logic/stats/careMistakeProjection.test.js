import {
  CARE_MISTAKE_TRANSITION_TYPES,
  applyCareMistakeTransition,
  buildCareMistakeIncidentId,
  buildEvolutionStageInstanceId,
  deriveCareMistakeProjection,
  validateCareMistakeProjection,
} from "./careMistakeProjection";
import { buildCareMistakeReconciliationPlan } from "../../persistence/careMistakeReconciliation";

const identity = {
  slotInstanceId: "slot-4-instance",
  digimonInstanceId: "life-4",
  evolutionStageInstanceId: "stage-life-4-child-1000",
};

function occurrence(transitionId, reasonKey, occurredAt, index = 0) {
  return {
    transitionType: CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
    transitionId,
    identity,
    reasonKey,
    occurredAt,
    text: `케어미스(${reasonKey})`,
    index,
  };
}

describe("careMistakeProjection", () => {
  test("incident 5건과 projection 5건을 동일 reducer에서 계산한다", () => {
    let state = { stats: {}, incidents: [] };
    for (let index = 0; index < 5; index += 1) {
      const result = applyCareMistakeTransition({
        ...state,
        transition: occurrence(`t-${index}`, "hunger_call", 1000 + index, index),
      });
      state = { stats: result.stats, incidents: result.incidents };
    }

    expect(state.incidents).toHaveLength(5);
    expect(state.stats).toMatchObject({
      careMistakes: 5,
      unresolvedCareMistakeCount: 5,
      latestCareMistakeAt: 1004,
    });
    expect(validateCareMistakeProjection({
      stats: state.stats,
      incidents: state.incidents,
      identity,
    }).valid).toBe(true);
    expect(state.stats.careMistakeLedger).toBeUndefined();
  });

  test("교감 성공 3회는 최신 incident부터 5건을 2건으로 해소한다", () => {
    let state = { stats: {}, incidents: [] };
    for (let index = 0; index < 5; index += 1) {
      const result = applyCareMistakeTransition({
        ...state,
        transition: occurrence(`t-${index}`, "hunger_call", 1000 + index, index),
      });
      state = { stats: result.stats, incidents: result.incidents };
    }

    for (let index = 0; index < 3; index += 1) {
      const result = applyCareMistakeTransition({
        ...state,
        transition: {
          transitionId: `resolve-${index}`,
          transitionType: CARE_MISTAKE_TRANSITION_TYPES.RESOLVED,
          identity,
          createdAt: 2000 + index,
        },
      });
      state = { stats: result.stats, incidents: result.incidents };
    }

    expect(state.stats.careMistakes).toBe(2);
    expect(state.incidents.filter((incident) => incident.status === "resolved")).toHaveLength(3);
    expect(deriveCareMistakeProjection({ incidents: state.incidents, identity }).careMistakes).toBe(2);
  });

  test("읽음 확인과 냉장고 전이는 care projection을 변경하지 않는다", () => {
    const occurred = applyCareMistakeTransition({
      stats: {},
      incidents: [],
      transition: occurrence("t-1", "hunger_call", 1000),
    });
    const acknowledged = applyCareMistakeTransition({
      stats: occurred.stats,
      incidents: occurred.incidents,
      transition: {
        transitionId: "ack-1",
        transitionType: CARE_MISTAKE_TRANSITION_TYPES.CALL_HISTORY_ACKNOWLEDGED,
        identity,
        callIds: ["call-1"],
      },
    });
    const frozen = applyCareMistakeTransition({
      stats: acknowledged.stats,
      incidents: acknowledged.incidents,
      transition: {
        transitionId: "fridge-1",
        transitionType: CARE_MISTAKE_TRANSITION_TYPES.FRIDGE_ENTERED,
        identity,
        createdAt: 3000,
      },
    });

    expect(acknowledged.stats).toMatchObject({ careMistakes: 1, unresolvedCareMistakeCount: 1 });
    expect(acknowledged.stats.acknowledgedRecentCallIds).toEqual(["call-1"]);
    expect(frozen.stats).toMatchObject({ careMistakes: 1, unresolvedCareMistakeCount: 1, isFrozen: true });
  });

  test("5→냉장고 진입→해제→재로드 후에도 5를 유지한다", () => {
    let state = { stats: {}, incidents: [] };
    for (let index = 0; index < 5; index += 1) {
      const result = applyCareMistakeTransition({
        ...state,
        transition: occurrence(`fridge-care-${index}`, "hunger_call", 1000 + index, index),
      });
      state = { stats: result.stats, incidents: result.incidents };
    }
    const entered = applyCareMistakeTransition({
      ...state,
      transition: {
        transitionId: "fridge-enter",
        transitionType: CARE_MISTAKE_TRANSITION_TYPES.FRIDGE_ENTERED,
        identity,
        createdAt: 2000,
      },
    });
    const exited = applyCareMistakeTransition({
      stats: entered.stats,
      incidents: entered.incidents,
      transition: {
        transitionId: "fridge-exit",
        transitionType: CARE_MISTAKE_TRANSITION_TYPES.FRIDGE_EXITED,
        identity,
        createdAt: 3000,
      },
    });
    const reloadedProjection = deriveCareMistakeProjection({
      incidents: JSON.parse(JSON.stringify(exited.incidents)),
      identity,
    });

    expect(exited.stats).toMatchObject({
      careMistakes: 5,
      unresolvedCareMistakeCount: 5,
      isFrozen: false,
    });
    expect(reloadedProjection).toMatchObject({
      careMistakes: 5,
      unresolvedCareMistakeCount: 5,
    });
  });

  test("incident ID와 stage ID는 재시도에서 결정론적이다", () => {
    const stageId = buildEvolutionStageInstanceId({
      digimonInstanceId: "life-1",
      evolutionStageStartedAt: 1000,
      evolutionStage: "Child",
    });
    const first = buildCareMistakeIncidentId({
      ...identity,
      evolutionStageInstanceId: stageId,
      reasonKey: "hunger_call",
      occurredAt: 1000,
    });
    const second = buildCareMistakeIncidentId({
      ...identity,
      evolutionStageInstanceId: stageId,
      reasonKey: "hunger_call",
      occurredAt: 1000,
    });
    expect(first).toBe(second);
  });
});

describe("careMistakeReconciliation", () => {
  test("projection 0이어도 현재 stage 로그 2건을 verified incident 2건으로 복구한다", () => {
    const stageStartedAt = 1000;
    const plan = buildCareMistakeReconciliationPlan({
      slotData: {
        slotInstanceId: "slot-5-instance",
        digimonInstanceId: "life-5",
        selectedDigimon: "Yuramon",
        evolutionStage: "Child",
        evolutionStageStartedAt: stageStartedAt,
      },
      savedStats: {
        careMistakes: 0,
        evolutionStage: "Child",
        evolutionStageStartedAt: stageStartedAt,
      },
      activityLogs: [
        { type: "CAREMISTAKE", text: "케어미스(사유: 배고픔 콜 10분 무시)", timestamp: 2000 },
        { type: "CAREMISTAKE", text: "케어미스(사유: 힘 콜 10분 무시)", timestamp: 3000 },
      ],
    });

    expect(plan.status).toBe("verified");
    expect(plan.projection).toMatchObject({ careMistakes: 2, unresolvedCareMistakeCount: 2 });
    expect(plan.incidents).toHaveLength(2);
  });

  test("projection 2와 현재 stage 로그 5건은 5건으로 복구하고 임의 해소하지 않는다", () => {
    const plan = buildCareMistakeReconciliationPlan({
      slotData: {
        slotInstanceId: "slot-4-instance",
        digimonInstanceId: "life-4",
        evolutionStage: "Child",
        evolutionStageStartedAt: 1000,
      },
      savedStats: { careMistakes: 2, evolutionStage: "Child", evolutionStageStartedAt: 1000 },
      activityLogs: Array.from({ length: 5 }, (_, index) => ({
        type: "CAREMISTAKE",
        text: "케어미스(사유: 배고픔 콜 10분 무시)",
        timestamp: 2000 + index,
      })),
    });

    expect(plan.status).toBe("verified");
    expect(plan.projection.careMistakes).toBe(5);
    expect(plan.incidents.every((incident) => incident.status === "unresolved")).toBe(true);
  });

  test("현재 stage 시작 시각을 증명할 수 없으면 projection을 추측하지 않는다", () => {
    const plan = buildCareMistakeReconciliationPlan({
      slotData: { slotInstanceId: "slot-x", digimonInstanceId: "life-x" },
      savedStats: { careMistakes: 3 },
      activityLogs: [{ type: "CAREMISTAKE", text: "케어미스", timestamp: 2000 }],
    });

    expect(plan.status).toBe("ambiguous");
    expect(plan.canActivateProjection).toBe(false);
  });
});

import { initializeApp } from "firebase/app";
import { getFirestore, doc } from "firebase/firestore";
import {
  buildGameTransitionEnvelope,
  commitGameTransition,
  GameTransitionConflictError,
} from "./careMistakeTransition";
import { CARE_MISTAKE_TRANSITION_TYPES, buildCareMistakeIncidentId } from "../logic/stats/careMistakeProjection";

function snapshot(data = null) {
  return {
    exists: () => data != null,
    data: () => data,
  };
}

const identity = {
  slotInstanceId: "slot-instance-1",
  digimonInstanceId: "digimon-instance-1",
  evolutionStageInstanceId: "stage-1",
};

function createDbAndSlot() {
  const app = initializeApp({ projectId: "care-transition-test" }, `care-transition-${Math.random()}`);
  return { db: getFirestore(app), slotRef: doc(getFirestore(app), "users/u/slots/slot1") };
}

test("케어미스 발생은 incident·로그·projection·receipt를 한 transaction에 쓴다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const transition = buildGameTransitionEnvelope({
    identity,
    clientInstanceId: "client-1",
    localSequence: 1,
    baseRevision: 0,
    transitionType: CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
    reasonKey: "hunger_call",
    occurredAt: 1000,
    text: "케어미스(사유: 배고픔 콜 10분 무시)",
    resultingState: { careMistakes: 1 },
  });
  const transaction = {
    get: jest.fn(async (ref) => {
      if (ref.path.endsWith(`/gameTransitions/${transition.transitionId}`)) return snapshot();
      if (ref.path === slotRef.path) {
        return snapshot({
          revision: 0,
          slotInstanceId: identity.slotInstanceId,
          digimonInstanceId: identity.digimonInstanceId,
          evolutionStageInstanceId: identity.evolutionStageInstanceId,
          careMistakes: 0,
          unresolvedCareMistakeCount: 0,
          latestUnresolvedCareMistakeIncidentId: null,
          digimonStats: { fullness: 0 },
        });
      }
      return snapshot();
    }),
    update: jest.fn(),
    set: jest.fn(),
    create: jest.fn(),
  };

  const result = await commitGameTransition({
    db,
    slotRef,
    transition,
    updateData: { digimonStats: { fullness: 1, careMistakes: 0 } },
    runTransaction: async (_db, callback) => callback(transaction),
    committedAtValue: 1001,
  });

  expect(result).toMatchObject({ revision: 1, idempotent: false, projection: { careMistakes: 1 } });
  expect(transaction.update).toHaveBeenCalledWith(
    slotRef,
    expect.objectContaining({
      revision: 1,
      careMistakes: 1,
      unresolvedCareMistakeCount: 1,
      digimonStats: expect.objectContaining({ careMistakes: 1, unresolvedCareMistakeCount: 1 }),
    })
  );
  expect(transaction.create).toHaveBeenCalledTimes(1);
  expect(transaction.set).toHaveBeenCalledTimes(2);
  expect(transaction.set.mock.calls.some(([, value]) => value.transitionId === transition.transitionId)).toBe(true);
  expect(transaction.set.mock.calls.some(([, value]) => value.type === "CAREMISTAKE")).toBe(true);
});

test("같은 transition을 10회 재시도해도 receipt만 반환하고 revision을 다시 올리지 않는다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const transition = buildGameTransitionEnvelope({
    identity,
    clientInstanceId: "client-1",
    localSequence: 1,
    baseRevision: 4,
    transitionType: CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
    reasonKey: "strength_call",
    occurredAt: 2000,
  });
  const transaction = {
    get: jest.fn(async () => snapshot({
      requestFingerprint: transition.requestFingerprint,
      resultRevision: 5,
      eventIds: ["event-1"],
      incidentIds: ["incident-1"],
      projection: { careMistakes: 1 },
    })),
    update: jest.fn(),
    set: jest.fn(),
  };

  const results = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    results.push(await commitGameTransition({
      db,
      slotRef,
      transition,
      runTransaction: async (_db, callback) => callback(transaction),
    }));
  }

  expect(results).toHaveLength(10);
  results.forEach((result) => {
    expect(result).toMatchObject({ revision: 5, idempotent: true });
  });
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).not.toHaveBeenCalled();
});

test("revision 또는 생애 identity 충돌은 어떤 쓰기도 하지 않는다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const transition = buildGameTransitionEnvelope({
    identity,
    clientInstanceId: "client-1",
    localSequence: 1,
    baseRevision: 0,
    transitionType: CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
    reasonKey: "tease",
    occurredAt: 3000,
  });
  const transaction = {
    get: jest.fn(async (ref) => {
      if (ref.path.endsWith(`/gameTransitions/${transition.transitionId}`)) return snapshot();
      return snapshot({
        revision: 1,
        slotInstanceId: "other-slot",
        digimonInstanceId: identity.digimonInstanceId,
      });
    }),
    update: jest.fn(),
    set: jest.fn(),
  };

  await expect(commitGameTransition({
    db,
    slotRef,
    transition,
    runTransaction: async (_db, callback) => callback(transaction),
  })).rejects.toBeInstanceOf(GameTransitionConflictError);
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).not.toHaveBeenCalled();
});

test("교감 성공은 최신 incident를 해소하고 이전 head를 복원한다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const incidentId = buildCareMistakeIncidentId({
    ...identity,
    reasonKey: "hunger_call",
    occurredAt: 4000,
  });
  const transition = buildGameTransitionEnvelope({
    identity,
    clientInstanceId: "client-1",
    localSequence: 2,
    baseRevision: 1,
    transitionType: CARE_MISTAKE_TRANSITION_TYPES.RESOLVED,
    incidentId,
    resolvedAt: 5000,
  });
  const transaction = {
    get: jest.fn(async (ref) => {
      if (ref.path.endsWith(`/gameTransitions/${transition.transitionId}`)) return snapshot();
      if (ref.path === slotRef.path) {
        return snapshot({
          revision: 1,
          slotInstanceId: identity.slotInstanceId,
          digimonInstanceId: identity.digimonInstanceId,
          evolutionStageInstanceId: identity.evolutionStageInstanceId,
          careMistakes: 1,
          unresolvedCareMistakeCount: 1,
          latestUnresolvedCareMistakeIncidentId: incidentId,
          latestCareMistakeAt: 4000,
          digimonStats: {},
        });
      }
      return snapshot({
        incidentId,
        ...identity,
        occurredAt: 4000,
        reasonKey: "hunger_call",
        text: "케어미스",
        status: "unresolved",
        previousUnresolvedIncidentId: null,
      });
    }),
    update: jest.fn(),
    set: jest.fn(),
  };

  const result = await commitGameTransition({
    db,
    slotRef,
    transition,
    runTransaction: async (_db, callback) => callback(transaction),
  });

  expect(result.projection).toMatchObject({
    careMistakes: 0,
    latestUnresolvedCareMistakeIncidentId: null,
  });
  expect(transaction.set.mock.calls.some(([, value]) => value.status === "resolved")).toBe(true);
});

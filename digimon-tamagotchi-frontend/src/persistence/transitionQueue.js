import {
  buildGameTransitionEnvelope,
  buildGameTransitionId,
} from "./careMistakeTransition";

export const TRANSITION_STORE = "game_transitions";
export const TRANSITION_SEQUENCE_STORE = "game_transition_sequences";
export const TRANSITION_SEQUENCE_CONFLICT = "game/transition-sequence-conflict";

export const TRANSITION_STATUS = Object.freeze({
  PENDING: "pending",
  COMMITTED: "committed",
  BLOCKED: "blocked",
  DISCARDED: "discarded",
});

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${fieldName}가 필요합니다.`);
  }
  return value.trim();
}

function normalizeInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new TypeError(`${fieldName}은(는) 0 이상의 정수여야 합니다.`);
  }
  return number;
}

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function buildTransitionScopeKey({ uid, slotId, slotInstanceId } = {}) {
  return [
    normalizeRequiredString(String(uid ?? ""), "uid"),
    normalizeRequiredString(String(slotId ?? ""), "slotId"),
    normalizeRequiredString(slotInstanceId, "slotInstanceId"),
  ].join("::");
}

function normalizeTransitionIdentity(input = {}) {
  return {
    uid: normalizeRequiredString(String(input.uid ?? ""), "uid"),
    slotId: normalizeRequiredString(String(input.slotId ?? ""), "slotId"),
    slotInstanceId: normalizeRequiredString(input.slotInstanceId, "slotInstanceId"),
    digimonInstanceId: normalizeRequiredString(input.digimonInstanceId, "digimonInstanceId"),
  };
}

export function normalizeTransitionRecord(input = {}, { nowMs = Date.now() } = {}) {
  const identity = normalizeTransitionIdentity(input);
  const scopeKey = input.scopeKey || buildTransitionScopeKey(identity);
  const localSequence = normalizeInteger(input.localSequence, "localSequence");
  const transitionType = normalizeRequiredString(input.transitionType, "transitionType");
  const transitionId = input.transitionId || buildGameTransitionId({
    slotInstanceId: identity.slotInstanceId,
    clientInstanceId: normalizeRequiredString(input.clientInstanceId, "clientInstanceId"),
    localSequence,
    transitionType,
  });
  const createdAt = Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : nowMs;
  return {
    kind: "game-transition",
    ...identity,
    scopeKey,
    transitionId,
    clientInstanceId: normalizeRequiredString(input.clientInstanceId, "clientInstanceId"),
    localSequence,
    parentTransitionId: input.parentTransitionId || null,
    transitionType,
    baseRevision: normalizeInteger(input.baseRevision ?? 0, "baseRevision"),
    createdAt,
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : createdAt,
    status: Object.values(TRANSITION_STATUS).includes(input.status)
      ? input.status
      : TRANSITION_STATUS.PENDING,
    transition: clone(input.transition || input),
    resultingState: clone(input.resultingState),
    updateData: clone(input.updateData),
    activityEvents: clone(input.activityEvents || []),
    eventIds: clone(input.eventIds || []),
    incidentIds: clone(input.incidentIds || []),
    requestFingerprint: input.requestFingerprint || null,
    resultRevision: input.resultRevision == null ? null : normalizeInteger(input.resultRevision, "resultRevision"),
    errorCode: input.errorCode || null,
    ...(input.careEpoch ? { careEpoch: clone(input.careEpoch) } : {}),
  };
}

function sortTransitionRecords(records = []) {
  return [...records].sort((left, right) =>
    left.localSequence - right.localSequence ||
    left.createdAt - right.createdAt ||
    String(left.transitionId).localeCompare(String(right.transitionId))
  );
}

export function getNextTransitionToCommit(records = [], identity = {}) {
  const scopeKey = buildTransitionScopeKey(identity);
  const pendingRecords = sortTransitionRecords(records.filter((record) =>
    record.scopeKey === scopeKey &&
    record.digimonInstanceId === identity.digimonInstanceId &&
    (record.status === TRANSITION_STATUS.PENDING || record.status === TRANSITION_STATUS.BLOCKED)
  ));
  const blocked = pendingRecords.find((record) => record.status === TRANSITION_STATUS.BLOCKED);
  if (blocked) {
    return { status: TRANSITION_STATUS.BLOCKED, record: clone(blocked) };
  }
  const candidate = pendingRecords[0];
  if (!candidate) return { status: "empty", record: null };

  if (!candidate.parentTransitionId) {
    return { status: "ready", record: clone(candidate) };
  }

  const parent = records.find((record) => record.transitionId === candidate.parentTransitionId);
  if (!parent || parent.status === TRANSITION_STATUS.PENDING) {
    return { status: "waiting", record: null, waitingFor: candidate.parentTransitionId };
  }
  if (
    parent.status === TRANSITION_STATUS.BLOCKED ||
    parent.status === TRANSITION_STATUS.DISCARDED
  ) {
    return { status: TRANSITION_STATUS.BLOCKED, record: clone(parent) };
  }
  return { status: "ready", record: clone(candidate) };
}

async function atomicUpdateMany(storage, operations) {
  if (typeof storage.atomicUpdateMany === "function") {
    return storage.atomicUpdateMany(operations);
  }

  // 외부 테스트용 최소 storage와의 호환 경로. 실제 IndexedDB adapter는
  // 항상 하나의 native transaction으로 이 경로를 사용하지 않는다.
  const results = [];
  for (const operation of operations) {
    results.push(await storage.atomicUpdate(operation.storeName, operation.key, operation.updater));
  }
  return results;
}

export function createTransitionQueue({ storage, now = () => Date.now() } = {}) {
  if (!storage) throw new TypeError("transition queue storage가 필요합니다.");
  let lock = Promise.resolve();

  const withLock = (task) => {
    const result = lock.catch(() => undefined).then(task);
    lock = result.catch(() => undefined);
    return result;
  };

  const getSequence = async (scopeKey) =>
    (await storage.get(TRANSITION_SEQUENCE_STORE, scopeKey)) || {
      scopeKey,
      nextLocalSequence: 1,
      headTransitionId: null,
      headDigimonInstanceId: null,
      updatedAt: now(),
    };

  return {
    enqueue(input = {}) {
      return withLock(async () => {
        const identity = normalizeTransitionIdentity(input);
        const scopeKey = buildTransitionScopeKey(identity);
        const existing = input.transitionId
          ? await storage.get(TRANSITION_STORE, input.transitionId)
          : null;
        if (existing) {
          if (
            existing.scopeKey === scopeKey &&
            existing.digimonInstanceId === identity.digimonInstanceId
          ) {
            return clone(existing);
          }
          const collisionError = new Error("다른 슬롯 또는 생애가 이미 transition ID를 사용하고 있습니다.");
          collisionError.code = "game/transition-id-collision";
          throw collisionError;
        }

        let lastSequenceConflict = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const sequence = await getSequence(scopeKey);
          const expectedNextLocalSequence = Math.max(
            1,
            normalizeInteger(sequence.nextLocalSequence ?? 1, "nextLocalSequence")
          );
          const requestedLocalSequence = input.localSequence == null
            ? null
            : normalizeInteger(input.localSequence, "localSequence");
          const localSequence = requestedLocalSequence ?? expectedNextLocalSequence;
          if (localSequence !== expectedNextLocalSequence) {
            const sequenceError = new Error("로컬 transition sequence가 현재 대기열과 일치하지 않습니다.");
            sequenceError.code = TRANSITION_SEQUENCE_CONFLICT;
            sequenceError.expectedLocalSequence = expectedNextLocalSequence;
            sequenceError.actualLocalSequence = localSequence;
            throw sequenceError;
          }

          const transitionType = normalizeRequiredString(input.transitionType, "transitionType");
          const transitionId = input.transitionId || buildGameTransitionId({
            slotInstanceId: identity.slotInstanceId,
            clientInstanceId: input.clientInstanceId,
            localSequence,
            transitionType,
          });
          let parentTransitionId = input.parentTransitionId;
          if (parentTransitionId === undefined) {
            const headRecord = sequence.headTransitionId
              ? await storage.get(TRANSITION_STORE, sequence.headTransitionId)
              : null;
            parentTransitionId =
              headRecord?.digimonInstanceId === identity.digimonInstanceId
                ? sequence.headTransitionId
                : null;
          }
          const createdAt = Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : now();
          const record = normalizeTransitionRecord({
            ...input,
            ...identity,
            scopeKey,
            transitionId,
            localSequence,
            parentTransitionId,
            createdAt,
            updatedAt: createdAt,
            transition: input.transition?.requestFingerprint
              ? input.transition
              : buildGameTransitionEnvelope({
                  ...(input.transition || {}),
                  identity: input.transition?.identity || identity,
                  transitionId,
                  clientInstanceId: input.clientInstanceId,
                  localSequence,
                  parentTransitionId,
                  transitionType,
                  baseRevision: input.baseRevision ?? 0,
                  createdAt,
                }),
          }, { nowMs: createdAt });
          const nextSequence = {
            ...sequence,
            scopeKey,
            clientInstanceId: input.clientInstanceId,
            nextLocalSequence: localSequence + 1,
            headTransitionId: transitionId,
            headDigimonInstanceId: identity.digimonInstanceId,
            updatedAt: createdAt,
          };

          try {
            // sequence를 먼저 비교·갱신하되, native IndexedDB transaction 안에서
            // transition record와 함께 처리한다. 다른 탭이 먼저 sequence를
            // 소비하면 전체 transaction이 abort되어 다시 읽고 재시도한다.
            const results = await atomicUpdateMany(storage, [
              {
                storeName: TRANSITION_SEQUENCE_STORE,
                key: scopeKey,
                updater: (current) => {
                  const currentNextLocalSequence = current == null
                    ? 1
                    : normalizeInteger(current.nextLocalSequence ?? 1, "nextLocalSequence");
                  const currentHeadTransitionId = current?.headTransitionId || null;
                  if (
                    currentNextLocalSequence !== expectedNextLocalSequence ||
                    currentHeadTransitionId !== (sequence.headTransitionId || null)
                  ) {
                    const error = new Error("다른 로컬 writer가 transition sequence를 먼저 발급했습니다.");
                    error.code = TRANSITION_SEQUENCE_CONFLICT;
                    throw error;
                  }
                  return { action: "put", value: nextSequence, result: clone(nextSequence) };
                },
              },
              {
                storeName: TRANSITION_STORE,
                key: transitionId,
                updater: (current) => {
                  if (current) {
                    const error = new Error("transition ID가 이미 사용 중입니다.");
                    error.code = "game/transition-id-collision";
                    throw error;
                  }
                  return { action: "put", value: record, result: clone(record) };
                },
              },
            ]);
            return clone(results[1] || record);
          } catch (error) {
            if (error?.code !== TRANSITION_SEQUENCE_CONFLICT) throw error;
            lastSequenceConflict = error;
          }
        }
        throw lastSequenceConflict || new Error("로컬 transition sequence 발급에 실패했습니다.");
      });
    },

    async get(input = {}) {
      const identity = normalizeTransitionIdentity(input);
      const record = await storage.get(TRANSITION_STORE, input.transitionId);
      return record && record.scopeKey === buildTransitionScopeKey(identity) &&
        record.digimonInstanceId === identity.digimonInstanceId
        ? clone(record)
        : null;
    },

    async list(input = {}) {
      const identity = normalizeTransitionIdentity(input);
      const scopeKey = buildTransitionScopeKey(identity);
      const records = await storage.getAll(TRANSITION_STORE);
      return sortTransitionRecords(records.filter((record) =>
        record.scopeKey === scopeKey && record.digimonInstanceId === identity.digimonInstanceId
      )).map(clone);
    },

    async getNext(input = {}) {
      return getNextTransitionToCommit(await this.list(input), input);
    },

    updateStatus(input = {}) {
      return withLock(async () => {
        const identity = normalizeTransitionIdentity(input);
        const scopeKey = buildTransitionScopeKey(identity);
        const transitionId = normalizeRequiredString(input.transitionId, "transitionId");
        const status = normalizeRequiredString(input.status, "status");
        if (!Object.values(TRANSITION_STATUS).includes(status)) {
          throw new TypeError("알 수 없는 transition 상태입니다.");
        }
        return storage.atomicUpdate(TRANSITION_STORE, transitionId, (current) => {
          if (!current || current.scopeKey !== scopeKey || current.digimonInstanceId !== identity.digimonInstanceId) {
            return { action: "keep", result: null };
          }
          const updated = {
            ...current,
            status,
            resultRevision: input.resultRevision == null
              ? current.resultRevision
              : normalizeInteger(input.resultRevision, "resultRevision"),
            errorCode: input.errorCode || null,
            updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : now(),
          };
          return { action: "put", value: updated, result: clone(updated) };
        });
      });
    },

    async blockFrom(input = {}) {
      const identity = normalizeTransitionIdentity(input);
      const records = await this.list(identity);
      const startSequence = normalizeInteger(input.localSequence, "localSequence");
      const targets = records.filter((record) =>
        record.localSequence >= startSequence &&
        (record.status === TRANSITION_STATUS.PENDING || record.status === TRANSITION_STATUS.BLOCKED)
      );
      for (const record of targets) {
        await this.updateStatus({
          ...identity,
          transitionId: record.transitionId,
          status: TRANSITION_STATUS.BLOCKED,
          errorCode: input.errorCode || "TRANSITION_CHAIN_BLOCKED",
        });
      }
      return targets.length;
    },

    async discard(input = {}) {
      return this.updateStatus({
        ...input,
        status: TRANSITION_STATUS.DISCARDED,
      });
    },
  };
}

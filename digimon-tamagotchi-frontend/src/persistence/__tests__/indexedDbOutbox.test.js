import {
  createIndexedDbOutbox,
  createIndexedDbStorage,
  INDEXED_DB_UNAVAILABLE,
  IndexedDbUnavailableError,
  isIndexedDbUnavailableError,
} from '../indexedDbOutbox';

function createMemoryStorage() {
  const stores = {
    state_mutations: new Map(),
    events: new Map(),
    legacy_quarantine: new Map(),
    game_transitions: new Map(),
    game_transition_sequences: new Map(),
  };

  const keyFields = {
    state_mutations: 'scopeKey',
    events: 'eventKey',
    legacy_quarantine: 'quarantineKey',
    game_transitions: 'transitionId',
    game_transition_sequences: 'scopeKey',
  };

  return {
    async get(storeName, key) {
      const record = stores[storeName].get(key);
      return record == null ? null : clone(record);
    },
    async put(storeName, value) {
      const keyField = keyFields[storeName];
      stores[storeName].set(value[keyField], clone(value));
      return value[keyField];
    },
    async delete(storeName, key) {
      stores[storeName].delete(key);
    },
    async getAll(storeName) {
      return Array.from(stores[storeName].values()).map(clone);
    },
    async atomicUpdate(storeName, key, updater) {
      const existing = clone(stores[storeName].get(key) ?? null);
      const action = updater(existing);
      if (action.action === 'put') {
        const value = clone(action.value);
        stores[storeName].set(value[keyFields[storeName]], value);
      } else if (action.action === 'delete') {
        stores[storeName].delete(key);
      }
      return clone(action.result);
    },
    async atomicUpdateMany(operations) {
      const existing = operations.map((operation) =>
        clone(stores[operation.storeName].get(operation.key) ?? null)
      );
      const actions = operations.map((operation, index) => operation.updater(existing[index]));
      actions.forEach((action, index) => {
        const operation = operations[index];
        if (action.action === 'put') {
          const value = clone(action.value);
          stores[operation.storeName].set(value[keyFields[operation.storeName]], value);
        } else if (action.action === 'delete') {
          stores[operation.storeName].delete(operation.key);
        }
      });
      return actions.map((action) => clone(action.result));
    },
    async deleteWhere(storeNames, predicate) {
      let deletedCount = 0;
      for (const storeName of storeNames) {
        for (const [key, record] of stores[storeName]) {
          if (!predicate(storeName, clone(record))) continue;
          stores[storeName].delete(key);
          deletedCount += 1;
        }
      }
      return deletedCount;
    },
    async migrateLegacyRecords(nowTimestamp) {
      let quarantinedCount = 0;
      for (const storeName of ['state_mutations', 'events']) {
        for (const [key, record] of stores[storeName]) {
          if (typeof record.slotInstanceId === 'string' && record.slotInstanceId.trim()) {
            continue;
          }
          stores.legacy_quarantine.set(`${storeName}:${key}`, {
            quarantineKey: `${storeName}:${key}`,
            originalStore: storeName,
            originalKey: String(key),
            reason: 'missing-slot-instance-id',
            quarantinedAt: nowTimestamp,
            record: clone(record),
          });
          stores[storeName].delete(key);
          quarantinedCount += 1;
        }
      }
      return { quarantinedCount };
    },
  };
}

const DEFAULT_IDENTITY = Object.freeze({
  slotInstanceId: 'slot-instance-a',
  digimonInstanceId: 'digimon-life-a',
});

const IDENTITY_METHODS = new Set([
  'putStateMutation',
  'getStateMutation',
  'deleteStateMutation',
  'putActivityEvent',
  'listActivityEvents',
  'deleteActivityEvent',
  'putBattleEvent',
  'listBattleEvents',
  'deleteBattleEvent',
  'putFeedEvent',
  'listFeedEvents',
  'deleteFeedEvent',
  'summarizeFeedBuckets',
  'pruneSyncedFeedEvents',
  'clearSlotInstanceScope',
  'clearDigimonLifeRecords',
  'enqueueTransition',
  'getTransition',
  'listTransitions',
  'getNextTransition',
  'updateTransitionStatus',
  'blockTransitionChain',
  'discardTransition',
]);

function createTestOutbox(options) {
  const outbox = createIndexedDbOutbox(options);
  return new Proxy(outbox, {
    get(target, property) {
      const value = target[property];
      if (typeof value !== 'function' || !IDENTITY_METHODS.has(property)) return value;
      return (input = {}) => value({ ...DEFAULT_IDENTITY, ...input });
    },
  });
}

function createFakeIndexedDbFactory() {
  const databases = new Map();

  return {
    open(name, version) {
      const request = createRequest();

      queueMicrotask(() => {
        let database = databases.get(name);
        const needsUpgrade = !database || (version ?? 1) > database.version;

        if (!database) {
          database = createFakeDatabase(name, version ?? 1);
          databases.set(name, database);
        } else if ((version ?? 1) > database.version) {
          database.version = version ?? 1;
        }

        request.result = database;

        if (needsUpgrade && typeof request.onupgradeneeded === 'function') {
          request.onupgradeneeded({ target: request });
        }

        queueMicrotask(() => {
          if (typeof request.onsuccess === 'function') {
            request.onsuccess({ target: request });
          }
        });
      });

      return request;
    },
  };
}

function createFakeDatabase(name, version) {
  const stores = new Map();

  return {
    name,
    version,
    objectStoreNames: {
      contains(storeName) {
        return stores.has(storeName);
      },
    },
    createObjectStore(storeName, options) {
      stores.set(storeName, {
        keyPath: options.keyPath,
        records: new Map(),
      });
    },
    transaction() {
      const transaction = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore(nameToRead) {
          const store = stores.get(nameToRead);
          if (!store) {
            throw new Error(`알 수 없는 store: ${nameToRead}`);
          }

          return {
            keyPath: store.keyPath,
            get(key) {
              const request = createRequest();
              queueMicrotask(() => {
                request.result = clone(store.records.get(key) ?? null);
                if (typeof request.onsuccess === 'function') {
                  request.onsuccess({ target: request });
                }
                completeTransaction(transaction);
              });
              return request;
            },
            put(value) {
              const request = createRequest();
              queueMicrotask(() => {
                const clonedValue = clone(value);
                store.records.set(clonedValue[store.keyPath], clonedValue);
                request.result = clonedValue[store.keyPath];
                if (typeof request.onsuccess === 'function') {
                  request.onsuccess({ target: request });
                }
                completeTransaction(transaction);
              });
              return request;
            },
            delete(key) {
              const request = createRequest();
              queueMicrotask(() => {
                store.records.delete(key);
                request.result = undefined;
                if (typeof request.onsuccess === 'function') {
                  request.onsuccess({ target: request });
                }
                completeTransaction(transaction);
              });
              return request;
            },
            getAll() {
              const request = createRequest();
              queueMicrotask(() => {
                request.result = Array.from(store.records.values()).map(clone);
                if (typeof request.onsuccess === 'function') {
                  request.onsuccess({ target: request });
                }
                completeTransaction(transaction);
              });
              return request;
            },
          };
        },
        abort() {
          if (typeof transaction.onabort === 'function') {
            transaction.onabort({ target: transaction });
          }
        },
      };

      return transaction;
    },
  };
}

function completeTransaction(transaction) {
  queueMicrotask(() => {
    if (typeof transaction.oncomplete === 'function') {
      transaction.oncomplete({ target: transaction });
    }
  });
}

function createRequest() {
  return {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

describe('indexedDbOutbox', () => {
  it('transition envelope를 sequence 순서로 보관하고 선행 commit 전 후속 전이를 막는다', async () => {
    const outbox = createTestOutbox({ storage: createMemoryStorage(), now: () => 1000 });
    const first = await outbox.enqueueTransition({
      uid: 'user-a',
      slotId: 'slot-1',
      clientInstanceId: 'client-a',
      transitionType: 'CARE_MISTAKE_OCCURRED',
      baseRevision: 0,
      transition: { transitionId: 'care-1' },
    });
    const second = await outbox.enqueueTransition({
      uid: 'user-a',
      slotId: 'slot-1',
      clientInstanceId: 'client-a',
      transitionType: 'FRIDGE_ENTERED',
      baseRevision: 1,
      transition: { transitionId: 'fridge-1' },
    });

    expect(first.localSequence).toBe(1);
    expect(second.localSequence).toBe(2);
    expect(second.parentTransitionId).toBe(first.transitionId);
    await expect(outbox.getNextTransition({ uid: 'user-a', slotId: 'slot-1' })).resolves.toMatchObject({
      status: 'ready',
      record: { transitionId: first.transitionId },
    });

    await outbox.updateTransitionStatus({
      uid: 'user-a',
      slotId: 'slot-1',
      transitionId: first.transitionId,
      status: 'committed',
      resultRevision: 1,
    });
    await expect(outbox.getNextTransition({ uid: 'user-a', slotId: 'slot-1' })).resolves.toMatchObject({
      status: 'ready',
      record: { transitionId: second.transitionId },
    });
  });

  it('오프라인 T1→T2→T3→T4는 각 parent commit 후에만 다음 전이를 연다', async () => {
    const outbox = createTestOutbox({ storage: createMemoryStorage(), now: () => 2000 });
    const transitionTypes = [
      'CARE_MISTAKE_OCCURRED',
      'FRIDGE_ENTERED',
      'FRIDGE_EXITED',
      'CALL_HISTORY_ACKNOWLEDGED',
    ];
    const records = [];
    for (const transitionType of transitionTypes) {
      records.push(await outbox.enqueueTransition({
        uid: 'user-a',
        slotId: 'slot-1',
        clientInstanceId: 'client-a',
        transitionType,
        baseRevision: records.length,
        transition: { transitionType },
      }));
    }

    expect(records.map((record) => record.localSequence)).toEqual([1, 2, 3, 4]);
    expect(records.map((record) => record.parentTransitionId)).toEqual([
      null,
      records[0].transitionId,
      records[1].transitionId,
      records[2].transitionId,
    ]);

    for (let index = 0; index < records.length; index += 1) {
      await expect(outbox.getNextTransition({ uid: 'user-a', slotId: 'slot-1' }))
        .resolves.toMatchObject({
          status: 'ready',
          record: { transitionId: records[index].transitionId },
        });
      await outbox.updateTransitionStatus({
        uid: 'user-a',
        slotId: 'slot-1',
        transitionId: records[index].transitionId,
        status: 'committed',
        resultRevision: index + 1,
      });
    }
    await expect(outbox.getNextTransition({ uid: 'user-a', slotId: 'slot-1' }))
      .resolves.toMatchObject({ status: 'empty' });
  });

  it('uid+slot 범위별로 최신 state mutation만 보관하고 structured clone을 유지한다', async () => {
    const outbox = createTestOutbox({
      storage: createMemoryStorage(),
    });

    const initialState = { hunger: 3, nested: { stage: '성장기' } };
    await outbox.putStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      mutationId: 'm-1',
      updatedAt: 100,
      state: initialState,
    });

    initialState.nested.stage = '완전체';

    await outbox.putStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      mutationId: 'm-older',
      updatedAt: 90,
      state: { hunger: 0 },
    });

    await outbox.putStateMutation({
      uid: 'user-a',
      slotId: 'slot-2',
      mutationId: 'm-2',
      updatedAt: 50,
      state: { hunger: 8 },
    });

    const slotOneMutation = await outbox.getStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
    });
    const slotTwoMutation = await outbox.getStateMutation({
      uid: 'user-a',
      slotId: 'slot-2',
    });

    expect(slotOneMutation).toEqual(expect.objectContaining({
      kind: 'state',
      uid: 'user-a',
      slotId: 'slot-1',
      slotInstanceId: DEFAULT_IDENTITY.slotInstanceId,
      digimonInstanceId: DEFAULT_IDENTITY.digimonInstanceId,
      scopeKey: 'user-a::slot-1::slot-instance-a',
      mutationId: 'm-1',
      updatedAt: 100,
      queuedAt: 100,
      state: { hunger: 3, nested: { stage: '성장기' } },
    }));
    expect(slotOneMutation.recordVersion).toEqual(expect.any(String));
    expect(slotTwoMutation?.mutationId).toBe('m-2');
  });

  it('state mutation 삭제는 mutationId가 현재 값과 일치할 때만 수행한다', async () => {
    const outbox = createTestOutbox({
      storage: createMemoryStorage(),
    });

    const storedRecord = await outbox.putStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      mutationId: 'm-latest',
      updatedAt: 100,
      state: { hunger: 2 },
    });

    await expect(
      outbox.deleteStateMutation({
        uid: 'user-a',
        slotId: 'slot-1',
        mutationId: 'm-stale',
        recordVersion: storedRecord.recordVersion,
      })
    ).resolves.toBe(false);

    await expect(
      outbox.getStateMutation({
        uid: 'user-a',
        slotId: 'slot-1',
      })
    ).resolves.not.toBeNull();

    await expect(
      outbox.deleteStateMutation({
        uid: 'user-a',
        slotId: 'slot-1',
        mutationId: 'm-latest',
        recordVersion: storedRecord.recordVersion,
      })
    ).resolves.toBe(true);

    await expect(
      outbox.getStateMutation({
        uid: 'user-a',
        slotId: 'slot-1',
      })
    ).resolves.toBeNull();
  });

  it('activity와 battle event는 슬롯별로 put/list/delete가 독립 동작한다', async () => {
    const outbox = createTestOutbox({
      storage: createMemoryStorage(),
    });

    await outbox.putActivityEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'activity-1',
      occurredAt: 200,
      payload: { action: '훈련' },
    });
    await outbox.putBattleEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'battle-1',
      occurredAt: 300,
      payload: { enemy: '아구몬' },
    });
    await outbox.putActivityEvent({
      uid: 'user-a',
      slotId: 'slot-2',
      eventId: 'activity-2',
      occurredAt: 400,
      payload: { action: '청소' },
    });

    const slotOneActivities = await outbox.listActivityEvents({
      uid: 'user-a',
      slotId: 'slot-1',
    });
    const slotOneBattles = await outbox.listBattleEvents({
      uid: 'user-a',
      slotId: 'slot-1',
    });

    expect(slotOneActivities).toHaveLength(1);
    expect(slotOneActivities[0].payload).toEqual({ action: '훈련' });
    expect(slotOneBattles).toHaveLength(1);
    expect(slotOneBattles[0].payload).toEqual({ enemy: '아구몬' });

    const activityRecord = slotOneActivities[0];
    await expect(
      outbox.deleteActivityEvent({
        uid: 'user-a',
        slotId: 'slot-1',
        eventId: 'activity-1',
        recordVersion: activityRecord.recordVersion,
      })
    ).resolves.toBe(true);

    await expect(
      outbox.listActivityEvents({
        uid: 'user-a',
        slotId: 'slot-1',
      })
    ).resolves.toEqual([]);

    await expect(
      outbox.listActivityEvents({
        uid: 'user-a',
        slotId: 'slot-2',
      })
    ).resolves.toHaveLength(1);
  });

  it('콜론이 포함된 EVOLUTION eventId도 같은 activity eventKey로 재사용한다', async () => {
    const outbox = createTestOutbox({
      storage: createMemoryStorage(),
    });
    const eventId =
      'activity:evolution:evolution:1700000000000:Agumon:Greymon:abc123';

    await outbox.putActivityEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId,
      occurredAt: 1700000000000,
      payload: {
        type: 'EVOLUTION',
        text: 'Evolution: Evolved to 그레이몬!',
        transitionId: 'evolution:1700000000000:Agumon:Greymon:abc123',
        eventId,
      },
    });
    await outbox.putActivityEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId,
      occurredAt: 1700000000001,
      payload: {
        type: 'EVOLUTION',
        text: 'Evolution: Evolved to 그레이몬!',
        transitionId: 'evolution:1700000000000:Agumon:Greymon:abc123',
        eventId,
        retried: true,
      },
    });

    const events = await outbox.listActivityEvents({
      uid: 'user-a',
      slotId: 'slot-1',
    });

    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe(eventId);
    expect(events[0].eventKey).toBe(
      `user-a::slot-1::slot-instance-a::activity::${eventId}`
    );
    expect(events[0].payload.retried).toBe(true);
  });

  it('FEED event는 개별 보존되며 15분 bucket summary를 계산한다', async () => {
    const outbox = createTestOutbox({
      storage: createMemoryStorage(),
    });

    await outbox.putFeedEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'feed-1',
      occurredAt: 5 * 60 * 1000,
      payload: { kind: 'meat', quantity: 2 },
    });
    await outbox.putFeedEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'feed-2',
      occurredAt: 10 * 60 * 1000,
      payload: { kind: 'protein', quantity: 1 },
      syncStatus: 'synced',
      syncedAt: 10 * 60 * 1000,
    });
    await outbox.putFeedEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'feed-3',
      occurredAt: 25 * 60 * 1000,
      payload: { kind: 'meat', quantity: 3 },
    });

    const events = await outbox.listFeedEvents({
      uid: 'user-a',
      slotId: 'slot-1',
    });
    const summaries = await outbox.summarizeFeedBuckets({
      uid: 'user-a',
      slotId: 'slot-1',
    });

    expect(events.map((event) => event.eventId)).toEqual(['feed-1', 'feed-2', 'feed-3']);
    expect(summaries).toEqual([
      {
        uid: 'user-a',
        slotId: 'slot-1',
        slotInstanceId: DEFAULT_IDENTITY.slotInstanceId,
        digimonInstanceId: DEFAULT_IDENTITY.digimonInstanceId,
        bucketStartAt: 0,
        bucketEndAt: 15 * 60 * 1000,
        eventCount: 2,
        totalFeedQuantity: 3,
        syncedCount: 1,
        pendingCount: 1,
        firstOccurredAt: 5 * 60 * 1000,
        lastOccurredAt: 10 * 60 * 1000,
      },
      {
        uid: 'user-a',
        slotId: 'slot-1',
        slotInstanceId: DEFAULT_IDENTITY.slotInstanceId,
        digimonInstanceId: DEFAULT_IDENTITY.digimonInstanceId,
        bucketStartAt: 15 * 60 * 1000,
        bucketEndAt: 30 * 60 * 1000,
        eventCount: 1,
        totalFeedQuantity: 3,
        syncedCount: 0,
        pendingCount: 1,
        firstOccurredAt: 25 * 60 * 1000,
        lastOccurredAt: 25 * 60 * 1000,
      },
    ]);
  });

  it('FEED 정리는 synced 항목만 최근 30일 또는 최신 5000건 기준으로 삭제하고 pending은 유지한다', async () => {
    const nowTimestamp = 60 * 24 * 60 * 60 * 1000;
    const outbox = createTestOutbox({
      storage: createMemoryStorage(),
      now: () => nowTimestamp,
    });

    await outbox.putFeedEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'old-pending',
      occurredAt: 1,
      payload: { kind: 'meat' },
      syncStatus: 'pending',
    });

    for (let index = 0; index < 5002; index += 1) {
      await outbox.putFeedEvent({
        uid: 'user-a',
        slotId: 'slot-1',
        eventId: `synced-${index}`,
        occurredAt: 1000 + index,
        payload: { kind: 'meat' },
        syncStatus: 'synced',
        syncedAt: 2000 + index,
      });
    }

    await outbox.putFeedEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'recent-synced',
      occurredAt: nowTimestamp - 5 * 24 * 60 * 60 * 1000,
      payload: { kind: 'protein' },
      syncStatus: 'synced',
      syncedAt: nowTimestamp - 5 * 24 * 60 * 60 * 1000,
    });

    const pruneResult = await outbox.pruneSyncedFeedEvents({
      uid: 'user-a',
      slotId: 'slot-1',
    });

    const remainingEvents = await outbox.listFeedEvents({
      uid: 'user-a',
      slotId: 'slot-1',
    });

    const remainingEventIds = new Set(remainingEvents.map((event) => event.eventId));

    expect(pruneResult).toEqual({
      deletedCount: 5002,
      keptCount: 1,
      pendingCount: 1,
    });
    expect(remainingEventIds.has('old-pending')).toBe(true);
    expect(remainingEventIds.has('recent-synced')).toBe(true);
    expect(remainingEvents).toHaveLength(2);
  });

  it('raw IndexedDB 어댑터 경로도 fake indexedDB로 동작한다', async () => {
    const storage = createIndexedDbStorage({
      indexedDB: createFakeIndexedDbFactory(),
      dbName: 'test-outbox',
    });
    const outbox = createTestOutbox({ storage });

    await outbox.putBattleEvent({
      uid: 'user-b',
      slotId: 'slot-9',
      eventId: 'battle-1',
      occurredAt: 12,
      payload: { enemy: '파피몬' },
    });

    await expect(
      outbox.listBattleEvents({
        uid: 'user-b',
        slotId: 'slot-9',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        category: 'battle',
        uid: 'user-b',
        slotId: 'slot-9',
        slotInstanceId: DEFAULT_IDENTITY.slotInstanceId,
        digimonInstanceId: DEFAULT_IDENTITY.digimonInstanceId,
        scopeKey: 'user-b::slot-9::slot-instance-a',
        eventId: 'battle-1',
        eventKey: 'user-b::slot-9::slot-instance-a::battle::battle-1',
        eventType: 'BATTLE',
        occurredAt: 12,
        payload: { enemy: '파피몬' },
        syncStatus: 'pending',
        syncedAt: null,
      }),
    ]);
  });

  it('같은 slotId를 재사용해도 slotInstanceId가 다른 이전 슬롯 기록과 격리한다', async () => {
    const outbox = createTestOutbox({ storage: createMemoryStorage() });

    await outbox.putStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      slotInstanceId: 'slot-life-old',
      digimonInstanceId: 'digimon-old',
      mutationId: 'old-state',
      updatedAt: 100,
      state: { hunger: 1 },
    });
    await outbox.putStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      slotInstanceId: 'slot-life-new',
      digimonInstanceId: 'digimon-new',
      mutationId: 'new-state',
      updatedAt: 200,
      state: { hunger: 5 },
    });

    await expect(outbox.getStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      slotInstanceId: 'slot-life-old',
      digimonInstanceId: 'digimon-old',
    })).resolves.toEqual(expect.objectContaining({ mutationId: 'old-state' }));
    await expect(outbox.getStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      slotInstanceId: 'slot-life-new',
      digimonInstanceId: 'digimon-new',
    })).resolves.toEqual(expect.objectContaining({ mutationId: 'new-state' }));
  });

  it('저장 성공 직후 같은 mutationId로 새 값이 생기면 오래된 cleanup이 새 값을 지우지 않는다', async () => {
    const outbox = createTestOutbox({ storage: createMemoryStorage() });
    const first = await outbox.putStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      mutationId: 'coalesced-mutation',
      updatedAt: 100,
      state: { hunger: 2 },
    });
    const second = await outbox.putStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      mutationId: 'coalesced-mutation',
      updatedAt: 101,
      state: { hunger: 3 },
    });

    await expect(outbox.deleteStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
      mutationId: first.mutationId,
      recordVersion: first.recordVersion,
    })).resolves.toBe(false);
    await expect(outbox.getStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
    })).resolves.toEqual(expect.objectContaining({
      recordVersion: second.recordVersion,
      state: { hunger: 3 },
    }));
  });

  it('같은 eventId를 다시 쓴 뒤 오래된 cleanup이 최신 event를 지우지 않는다', async () => {
    const outbox = createTestOutbox({ storage: createMemoryStorage() });
    const first = await outbox.putActivityEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'activity-1',
      occurredAt: 100,
      payload: { text: '첫 값' },
    });
    const second = await outbox.putActivityEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'activity-1',
      occurredAt: 101,
      payload: { text: '최신 값' },
    });

    await expect(outbox.deleteActivityEvent({
      uid: 'user-a',
      slotId: 'slot-1',
      eventId: 'activity-1',
      recordVersion: first.recordVersion,
    })).resolves.toBe(false);
    await expect(outbox.listActivityEvents({
      uid: 'user-a',
      slotId: 'slot-1',
    })).resolves.toEqual([
      expect.objectContaining({
        recordVersion: second.recordVersion,
        payload: { text: '최신 값' },
      }),
    ]);
  });

  it('slotInstanceId가 없는 v1 레코드는 현재 scope로 추측하지 않고 격리한다', async () => {
    const storage = createMemoryStorage();
    await storage.put('state_mutations', {
      scopeKey: 'user-a::slot-1',
      uid: 'user-a',
      slotId: 'slot-1',
      mutationId: 'legacy-state',
      updatedAt: 10,
      state: { hunger: 1 },
    });
    const outbox = createTestOutbox({ storage, now: () => 999 });

    await expect(outbox.getStateMutation({
      uid: 'user-a',
      slotId: 'slot-1',
    })).resolves.toBeNull();
    await expect(outbox.listLegacyQuarantine()).resolves.toEqual([
      expect.objectContaining({
        quarantineKey: 'state_mutations:user-a::slot-1',
        reason: 'missing-slot-instance-id',
        quarantinedAt: 999,
      }),
    ]);
  });

  it('이전 디지몬 생애 정리는 같은 슬롯 인스턴스의 해당 생애 기록만 삭제한다', async () => {
    const outbox = createTestOutbox({ storage: createMemoryStorage() });
    for (const digimonInstanceId of ['digimon-old', 'digimon-new']) {
      await outbox.putActivityEvent({
        uid: 'user-a',
        slotId: 'slot-1',
        digimonInstanceId,
        eventId: `activity-${digimonInstanceId}`,
        occurredAt: 100,
        payload: { digimonInstanceId },
      });
    }

    await expect(outbox.clearDigimonLifeRecords({
      uid: 'user-a',
      slotId: 'slot-1',
      digimonInstanceId: 'digimon-old',
    })).resolves.toBe(1);
    await expect(outbox.listActivityEvents({
      uid: 'user-a',
      slotId: 'slot-1',
      digimonInstanceId: 'digimon-new',
    })).resolves.toHaveLength(1);
  });

  it('IndexedDB unavailable 오류를 별도로 구분한다', () => {
    expect(() => createIndexedDbStorage({ indexedDB: null })).toThrow(
      IndexedDbUnavailableError
    );

    try {
      createIndexedDbStorage({ indexedDB: null });
    } catch (error) {
      expect(error.code).toBe(INDEXED_DB_UNAVAILABLE);
      expect(isIndexedDbUnavailableError(error)).toBe(true);
    }
  });
});

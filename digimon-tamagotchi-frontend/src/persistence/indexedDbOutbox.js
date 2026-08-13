const DEFAULT_DB_NAME = 'd2-tama-outbox';
const DEFAULT_DB_VERSION = 2;
const FEED_RETENTION_DAYS = 30;
const FEED_RETENTION_MAX_COUNT = 5000;
const FEED_BUCKET_MINUTES = 15;

const STATE_STORE = 'state_mutations';
const EVENT_STORE = 'events';
const QUARANTINE_STORE = 'legacy_quarantine';

const EVENT_CATEGORY = {
  ACTIVITY: 'activity',
  BATTLE: 'battle',
  FEED: 'feed',
};

export const INDEXED_DB_UNAVAILABLE = 'INDEXED_DB_UNAVAILABLE';

/**
 * IndexedDB 자체를 사용할 수 없는 환경을 구분하기 위한 에러입니다.
 */
export class IndexedDbUnavailableError extends Error {
  constructor(message = 'IndexedDB를 사용할 수 없는 환경입니다.') {
    super(message);
    this.name = 'IndexedDbUnavailableError';
    this.code = INDEXED_DB_UNAVAILABLE;
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isIndexedDbUnavailableError(error) {
  return Boolean(error && typeof error === 'object' && error.code === INDEXED_DB_UNAVAILABLE);
}

/**
 * raw IndexedDB 위에 얇은 스토리지 어댑터를 만듭니다.
 *
 * @param {{
 *   indexedDB?: IDBFactory | null,
 *   dbName?: string,
 *   dbVersion?: number
 * }} [options]
 */
export function createIndexedDbStorage(options = {}) {
  const indexedDBApi = options.indexedDB ??
    (typeof indexedDB !== 'undefined' ? indexedDB : null);
  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  const dbVersion = options.dbVersion ?? DEFAULT_DB_VERSION;

  if (!indexedDBApi || typeof indexedDBApi.open !== 'function') {
    throw new IndexedDbUnavailableError();
  }

  let dbPromise = null;

  const getDatabase = async () => {
    if (!dbPromise) {
      dbPromise = openDatabase(indexedDBApi, dbName, dbVersion);
    }

    return dbPromise;
  };

  return {
    kind: 'indexeddb',
    async get(storeName, key) {
      const database = await getDatabase();
      return runStoreOperation(database, storeName, 'readonly', (store) =>
        requestToPromise(store.get(key))
      );
    },
    async put(storeName, value) {
      const database = await getDatabase();
      return runStoreOperation(database, storeName, 'readwrite', (store) =>
        requestToPromise(store.put(clonePlainData(value)))
      );
    },
    async delete(storeName, key) {
      const database = await getDatabase();
      return runStoreOperation(database, storeName, 'readwrite', (store) =>
        requestToPromise(store.delete(key))
      );
    },
    async getAll(storeName) {
      const database = await getDatabase();
      return runStoreOperation(database, storeName, 'readonly', (store) =>
        requestToPromise(store.getAll())
      );
    },
    async atomicUpdate(storeName, key, updater) {
      const database = await getDatabase();
      return runAtomicStoreUpdate(database, storeName, key, updater);
    },
    async deleteWhere(storeNames, predicate) {
      const database = await getDatabase();
      return runAtomicDeleteWhere(database, storeNames, predicate);
    },
    async migrateLegacyRecords(nowTimestamp = Date.now()) {
      const database = await getDatabase();
      return migrateLegacyOutboxRecords(database, nowTimestamp);
    },
  };
}

/**
 * 독립적인 outbox 저장소를 생성합니다.
 *
 * @param {{
 *   storage?: {
 *     get: (storeName: string, key: string) => Promise<any>,
 *     put: (storeName: string, value: any) => Promise<any>,
 *     delete: (storeName: string, key: string) => Promise<any>,
 *     getAll: (storeName: string) => Promise<any[]>
 *   },
 *   indexedDB?: IDBFactory | null,
 *   dbName?: string,
 *   dbVersion?: number,
 *   now?: () => number
 * }} [options]
 */
export function createIndexedDbOutbox(options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const storage =
    options.storage ??
    createIndexedDbStorage({
      indexedDB: options.indexedDB,
      dbName: options.dbName,
      dbVersion: options.dbVersion,
    });

  assertStorage(storage);

  let generatedRecordSequence = 0;
  let migrationPromise = null;
  const ensureMigration = () => {
    if (!migrationPromise) {
      migrationPromise = Promise.resolve(storage.migrateLegacyRecords(now())).catch((error) => {
        migrationPromise = null;
        throw error;
      });
    }
    return migrationPromise;
  };

  const getScopedEvents = async (category, input) => {
    await ensureMigration();
    const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: true });
    const scopeKey = buildScopeKey(
      identity.uid,
      identity.slotId,
      identity.slotInstanceId
    );
    const records = await storage.getAll(EVENT_STORE);

    return sortByOccurredAtAsc(
      records.filter(
        (record) =>
          record.scopeKey === scopeKey &&
          record.category === category &&
          record.digimonInstanceId === identity.digimonInstanceId
      )
    ).map(clonePlainData);
  };

  const putEvent = async (category, input) => {
    await ensureMigration();
    const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: true });
    const scopeKey = buildScopeKey(
      identity.uid,
      identity.slotId,
      identity.slotInstanceId
    );
    const occurredAt = normalizeTimestamp(input.occurredAt, now());
    const updatedAt = normalizeTimestamp(input.updatedAt, now());
    const eventId = input.eventId ?? `${category}-${occurredAt}-${generatedRecordSequence++}`;
    const eventKey = buildEventKey(scopeKey, category, eventId);
    const nextRecord = {
      category,
      ...identity,
      scopeKey,
      eventId: String(eventId),
      eventKey,
      recordVersion: createRecordVersion(updatedAt, generatedRecordSequence++),
      eventType: input.eventType ?? defaultEventTypeForCategory(category),
      occurredAt,
      updatedAt,
      payload: clonePlainData(input.payload),
      syncStatus: input.syncStatus === 'synced' ? 'synced' : 'pending',
      syncedAt:
        input.syncStatus === 'synced' || Number.isFinite(input.syncedAt)
          ? normalizeTimestamp(input.syncedAt, occurredAt)
          : null,
    };

    if (category === EVENT_CATEGORY.FEED) {
      nextRecord.feedQuantity = normalizeFeedQuantity(input.feedQuantity, nextRecord.payload);
    }

    return storage.atomicUpdate(EVENT_STORE, eventKey, () => ({
      action: 'put',
      value: nextRecord,
      result: clonePlainData(nextRecord),
    }));
  };

  const deleteEvent = async (category, input) => {
    await ensureMigration();
    const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: true });
    const scopeKey = buildScopeKey(
      identity.uid,
      identity.slotId,
      identity.slotInstanceId
    );
    const eventKey = buildEventKey(scopeKey, category, input.eventId);
    const expectedRecordVersion = normalizeRequiredString(
      input.recordVersion,
      'recordVersion'
    );

    return storage.atomicUpdate(EVENT_STORE, eventKey, (existing) => {
      const matches = Boolean(
        existing &&
          existing.recordVersion === expectedRecordVersion &&
          existing.digimonInstanceId === identity.digimonInstanceId
      );
      return matches
        ? { action: 'delete', result: true }
        : { action: 'keep', result: false };
    });
  };

  return {
    async putStateMutation(input) {
      await ensureMigration();
      const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: true });
      const scopeKey = buildScopeKey(
        identity.uid,
        identity.slotId,
        identity.slotInstanceId
      );
      const updatedAt = normalizeTimestamp(input.updatedAt, now());
      const queuedAt = normalizeTimestamp(input.queuedAt, updatedAt);
      const nextRecord = {
        kind: 'state',
        ...identity,
        scopeKey,
        mutationId: normalizeRequiredString(input.mutationId, 'mutationId'),
        recordVersion: createRecordVersion(updatedAt, generatedRecordSequence++),
        updatedAt,
        queuedAt,
        state: clonePlainData(input.state),
      };

      return storage.atomicUpdate(STATE_STORE, scopeKey, (existing) => {
        const sameLife = existing?.digimonInstanceId === identity.digimonInstanceId;
        if (
          existing &&
          sameLife &&
          normalizeTimestamp(existing.updatedAt, 0) > updatedAt
        ) {
          return { action: 'keep', result: clonePlainData(existing) };
        }

        return {
          action: 'put',
          value: nextRecord,
          result: clonePlainData(nextRecord),
        };
      });
    },

    async getStateMutation(input) {
      await ensureMigration();
      const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: true });
      const scopeKey = buildScopeKey(
        identity.uid,
        identity.slotId,
        identity.slotInstanceId
      );
      const record = await storage.get(STATE_STORE, scopeKey);
      return record?.digimonInstanceId === identity.digimonInstanceId
        ? clonePlainData(record)
        : null;
    },

    async deleteStateMutation(input) {
      await ensureMigration();
      const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: true });
      const scopeKey = buildScopeKey(
        identity.uid,
        identity.slotId,
        identity.slotInstanceId
      );
      const expectedMutationId = normalizeRequiredString(input.mutationId, 'mutationId');
      const expectedRecordVersion = normalizeRequiredString(
        input.recordVersion,
        'recordVersion'
      );

      return storage.atomicUpdate(STATE_STORE, scopeKey, (existing) => {
        const matches = Boolean(
          existing &&
          existing.mutationId === expectedMutationId &&
          existing.recordVersion === expectedRecordVersion &&
          existing.digimonInstanceId === identity.digimonInstanceId
        );
        return matches
          ? { action: 'delete', result: true }
          : { action: 'keep', result: false };
      });
    },

    putActivityEvent(input) {
      return putEvent(EVENT_CATEGORY.ACTIVITY, input);
    },

    listActivityEvents(input) {
      return getScopedEvents(EVENT_CATEGORY.ACTIVITY, input);
    },

    deleteActivityEvent(input) {
      return deleteEvent(EVENT_CATEGORY.ACTIVITY, input);
    },

    putBattleEvent(input) {
      return putEvent(EVENT_CATEGORY.BATTLE, input);
    },

    listBattleEvents(input) {
      return getScopedEvents(EVENT_CATEGORY.BATTLE, input);
    },

    deleteBattleEvent(input) {
      return deleteEvent(EVENT_CATEGORY.BATTLE, input);
    },

    putFeedEvent(input) {
      return putEvent(EVENT_CATEGORY.FEED, input);
    },

    listFeedEvents(input) {
      return getScopedEvents(EVENT_CATEGORY.FEED, input);
    },

    deleteFeedEvent(input) {
      return deleteEvent(EVENT_CATEGORY.FEED, input);
    },

    async clearSlotInstanceScope(input) {
      await ensureMigration();
      const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: false });
      const scopeKey = buildScopeKey(
        identity.uid,
        identity.slotId,
        identity.slotInstanceId
      );
      return storage.deleteWhere(
        [STATE_STORE, EVENT_STORE],
        (_storeName, record) => record?.scopeKey === scopeKey
      );
    },

    async clearDigimonLifeRecords(input) {
      await ensureMigration();
      const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: true });
      const scopeKey = buildScopeKey(
        identity.uid,
        identity.slotId,
        identity.slotInstanceId
      );
      return storage.deleteWhere(
        [STATE_STORE, EVENT_STORE],
        (_storeName, record) =>
          record?.scopeKey === scopeKey &&
          record?.digimonInstanceId === identity.digimonInstanceId
      );
    },

    async listLegacyQuarantine() {
      await ensureMigration();
      return (await storage.getAll(QUARANTINE_STORE)).map(clonePlainData);
    },

    async summarizeFeedBuckets(input) {
      const identity = normalizeOutboxIdentity(input, { requireDigimonInstanceId: true });
      const bucketMinutes = input.bucketMinutes ?? FEED_BUCKET_MINUTES;
      const bucketSizeMs = bucketMinutes * 60 * 1000;
      const fromOccurredAt =
        input.fromOccurredAt == null ? Number.NEGATIVE_INFINITY : input.fromOccurredAt;
      const toOccurredAt =
        input.toOccurredAt == null ? Number.POSITIVE_INFINITY : input.toOccurredAt;
      const feedEvents = await getScopedEvents(EVENT_CATEGORY.FEED, input);
      const bucketMap = new Map();

      feedEvents.forEach((record) => {
        if (record.occurredAt < fromOccurredAt || record.occurredAt > toOccurredAt) return;
        const bucketStartAt = Math.floor(record.occurredAt / bucketSizeMs) * bucketSizeMs;
        const existingBucket = bucketMap.get(bucketStartAt);

        if (existingBucket) {
          existingBucket.eventCount += 1;
          existingBucket.totalFeedQuantity += record.feedQuantity ?? 1;
          existingBucket.syncedCount += isSyncedRecord(record) ? 1 : 0;
          existingBucket.pendingCount += isSyncedRecord(record) ? 0 : 1;
          existingBucket.lastOccurredAt = Math.max(existingBucket.lastOccurredAt, record.occurredAt);
          return;
        }

        bucketMap.set(bucketStartAt, {
          ...identity,
          bucketStartAt,
          bucketEndAt: bucketStartAt + bucketSizeMs,
          eventCount: 1,
          totalFeedQuantity: record.feedQuantity ?? 1,
          syncedCount: isSyncedRecord(record) ? 1 : 0,
          pendingCount: isSyncedRecord(record) ? 0 : 1,
          firstOccurredAt: record.occurredAt,
          lastOccurredAt: record.occurredAt,
        });
      });

      return Array.from(bucketMap.values())
        .sort((left, right) => left.bucketStartAt - right.bucketStartAt)
        .map(clonePlainData);
    },

    async pruneSyncedFeedEvents(input) {
      const retentionDays = input.retentionDays ?? FEED_RETENTION_DAYS;
      const maxCount = input.maxCount ?? FEED_RETENTION_MAX_COUNT;
      const nowTimestamp = normalizeTimestamp(input.nowTimestamp, now());
      const cutoff = nowTimestamp - retentionDays * 24 * 60 * 60 * 1000;
      const feedEvents = await getScopedEvents(EVENT_CATEGORY.FEED, input);
      const syncedEvents = feedEvents.filter(isSyncedRecord).sort(sortByOccurredAtDesc);
      const retainKeys = new Set();

      syncedEvents.forEach((record, index) => {
        if (record.occurredAt >= cutoff && index < maxCount) {
          retainKeys.add(record.eventKey);
        }
      });

      const deletableVersions = new Map(
        syncedEvents
          .filter((record) => !retainKeys.has(record.eventKey))
          .map((record) => [record.eventKey, record.recordVersion])
      );
      const deletedCount = await storage.deleteWhere(
        [EVENT_STORE],
        (_storeName, record) =>
          deletableVersions.get(record?.eventKey) === record?.recordVersion
      );

      return {
        deletedCount,
        keptCount: syncedEvents.length - deletedCount,
        pendingCount: feedEvents.length - syncedEvents.length,
      };
    },
  };
}

function assertStorage(storage) {
  const requiredMethods = [
    'get',
    'put',
    'delete',
    'getAll',
    'atomicUpdate',
    'deleteWhere',
    'migrateLegacyRecords',
  ];

  requiredMethods.forEach((methodName) => {
    if (typeof storage?.[methodName] !== 'function') {
      throw new TypeError(`storage.${methodName} 구현이 필요합니다.`);
    }
  });
}

function buildScopeKey(uid, slotId, slotInstanceId) {
  if (uid == null || uid === '') {
    throw new TypeError('uid가 필요합니다.');
  }

  if (slotId == null || slotId === '') {
    throw new TypeError('slotId가 필요합니다.');
  }

  if (slotInstanceId == null || slotInstanceId === '') {
    throw new TypeError('slotInstanceId가 필요합니다.');
  }

  return `${String(uid)}::${String(slotId)}::${String(slotInstanceId)}`;
}

function buildEventKey(scopeKey, category, eventId) {
  return `${scopeKey}::${category}::${String(eventId)}`;
}

function defaultEventTypeForCategory(category) {
  if (category === EVENT_CATEGORY.FEED) {
    return 'FEED';
  }

  if (category === EVENT_CATEGORY.BATTLE) {
    return 'BATTLE';
  }

  return 'ACTIVITY';
}

function normalizeTimestamp(value, fallback) {
  return Number.isFinite(value) ? Number(value) : Number(fallback);
}

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${fieldName}가 필요합니다.`);
  }
  return value.trim();
}

function normalizeOutboxIdentity(input = {}, { requireDigimonInstanceId = true } = {}) {
  const identity = {
    uid: normalizeRequiredString(String(input.uid ?? ''), 'uid'),
    slotId: normalizeRequiredString(String(input.slotId ?? ''), 'slotId'),
    slotInstanceId: normalizeRequiredString(input.slotInstanceId, 'slotInstanceId'),
  };

  if (requireDigimonInstanceId) {
    identity.digimonInstanceId = normalizeRequiredString(
      input.digimonInstanceId,
      'digimonInstanceId'
    );
  }

  return identity;
}

function createRecordVersion(timestamp, sequence) {
  const browserCrypto = typeof window !== 'undefined' ? window.crypto : null;
  const randomUuid =
    typeof browserCrypto?.randomUUID === 'function'
      ? browserCrypto.randomUUID()
      : null;
  return randomUuid || `record:${timestamp}:${sequence}:${Math.random().toString(36).slice(2)}`;
}

function normalizeFeedQuantity(feedQuantity, payload) {
  if (Number.isFinite(feedQuantity) && feedQuantity > 0) {
    return Number(feedQuantity);
  }

  if (payload && Number.isFinite(payload.quantity) && payload.quantity > 0) {
    return Number(payload.quantity);
  }

  return 1;
}

function isSyncedRecord(record) {
  return record.syncStatus === 'synced' || Number.isFinite(record.syncedAt);
}

function sortByOccurredAtAsc(records) {
  return [...records].sort((left, right) => {
    if (left.occurredAt !== right.occurredAt) {
      return left.occurredAt - right.occurredAt;
    }

    return String(left.eventId).localeCompare(String(right.eventId));
  });
}

function sortByOccurredAtDesc(left, right) {
  if (left.occurredAt !== right.occurredAt) {
    return right.occurredAt - left.occurredAt;
  }

  return String(right.eventId).localeCompare(String(left.eventId));
}

function clonePlainData(value) {
  if (value === undefined) {
    return undefined;
  }

  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new TypeError('structured-clone 가능한 plain data만 저장할 수 있습니다.');
  }
}

function openDatabase(indexedDBApi, dbName, dbVersion) {
  return new Promise((resolve, reject) => {
    let request;

    try {
      request = indexedDBApi.open(dbName, dbVersion);
    } catch (error) {
      reject(new IndexedDbUnavailableError());
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE, { keyPath: 'scopeKey' });
      }

      if (!database.objectStoreNames.contains(EVENT_STORE)) {
        database.createObjectStore(EVENT_STORE, { keyPath: 'eventKey' });
      }

      if (!database.objectStoreNames.contains(QUARANTINE_STORE)) {
        database.createObjectStore(QUARANTINE_STORE, { keyPath: 'quarantineKey' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open 요청이 실패했습니다.'));
    };
  });
}

function runStoreOperation(database, storeName, mode, executor) {
  return new Promise((resolve, reject) => {
    let operationResult;

    let transaction;

    try {
      transaction = database.transaction(storeName, mode);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      resolve(operationResult);
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction이 실패했습니다.'));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction이 중단되었습니다.'));
    };

    try {
      const store = transaction.objectStore(storeName);
      operationResult = executor(store, transaction);
    } catch (error) {
      try {
        transaction.abort();
      } catch (abortError) {
        // noop
      }
      reject(error);
    }
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(clonePlainData(request.result));
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request가 실패했습니다.'));
    };
  });
}

function normalizeAtomicAction(action) {
  if (!action || !['keep', 'put', 'delete'].includes(action.action)) {
    throw new TypeError('atomic updater는 keep/put/delete action을 반환해야 합니다.');
  }
  return action;
}

function runAtomicStoreUpdate(database, storeName, key, updater) {
  return new Promise((resolve, reject) => {
    let transaction;
    let operationResult;
    let settled = false;

    try {
      transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const getRequest = store.get(key);
      getRequest.onsuccess = () => {
        try {
          const action = normalizeAtomicAction(
            updater(clonePlainData(getRequest.result ?? null))
          );
          operationResult = clonePlainData(action.result);
          if (action.action === 'put') {
            store.put(clonePlainData(action.value));
          } else if (action.action === 'delete') {
            store.delete(key);
          }
        } catch (error) {
          settled = true;
          try {
            transaction.abort();
          } catch (_abortError) {
            // noop
          }
          reject(error);
        }
      };
      getRequest.onerror = () => {
        settled = true;
        reject(getRequest.error ?? new Error('IndexedDB compare 조회가 실패했습니다.'));
      };
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      if (!settled) resolve(operationResult);
    };
    transaction.onerror = () => {
      if (!settled) reject(transaction.error ?? new Error('IndexedDB compare transaction이 실패했습니다.'));
    };
    transaction.onabort = () => {
      if (!settled) reject(transaction.error ?? new Error('IndexedDB compare transaction이 중단되었습니다.'));
    };
  });
}

function normalizeStoreNames(storeNames) {
  return Array.isArray(storeNames) ? storeNames : [storeNames];
}

function runAtomicDeleteWhere(database, storeNames, predicate) {
  const names = normalizeStoreNames(storeNames);
  return new Promise((resolve, reject) => {
    let transaction;
    let deletedCount = 0;
    let settled = false;

    try {
      transaction = database.transaction(names, 'readwrite');
      names.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          try {
            (request.result || []).forEach((record) => {
              if (predicate(storeName, clonePlainData(record))) {
                const keyPath = store.keyPath;
                store.delete(record[keyPath]);
                deletedCount += 1;
              }
            });
          } catch (error) {
            settled = true;
            try {
              transaction.abort();
            } catch (_abortError) {
              // noop
            }
            reject(error);
          }
        };
        request.onerror = () => {
          settled = true;
          reject(request.error ?? new Error('IndexedDB 범위 정리 조회가 실패했습니다.'));
        };
      });
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      if (!settled) resolve(deletedCount);
    };
    transaction.onerror = () => {
      if (!settled) reject(transaction.error ?? new Error('IndexedDB 범위 정리가 실패했습니다.'));
    };
    transaction.onabort = () => {
      if (!settled) reject(transaction.error ?? new Error('IndexedDB 범위 정리가 중단되었습니다.'));
    };
  });
}

function migrateLegacyOutboxRecords(database, nowTimestamp) {
  return new Promise((resolve, reject) => {
    const storeNames = [STATE_STORE, EVENT_STORE, QUARANTINE_STORE];
    let transaction;
    let quarantinedCount = 0;
    let settled = false;

    try {
      transaction = database.transaction(storeNames, 'readwrite');
      const quarantineStore = transaction.objectStore(QUARANTINE_STORE);
      [STATE_STORE, EVENT_STORE].forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          try {
            (request.result || []).forEach((record) => {
              if (typeof record?.slotInstanceId === 'string' && record.slotInstanceId.trim()) {
                return;
              }
              const originalKey = record?.[store.keyPath];
              const quarantineKey = `${storeName}:${String(originalKey)}`;
              quarantineStore.put({
                quarantineKey,
                originalStore: storeName,
                originalKey: String(originalKey),
                reason: 'missing-slot-instance-id',
                quarantinedAt: nowTimestamp,
                record: clonePlainData(record),
              });
              store.delete(originalKey);
              quarantinedCount += 1;
            });
          } catch (error) {
            settled = true;
            try {
              transaction.abort();
            } catch (_abortError) {
              // noop
            }
            reject(error);
          }
        };
        request.onerror = () => {
          settled = true;
          reject(request.error ?? new Error('legacy outbox 조회가 실패했습니다.'));
        };
      });
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      if (!settled) resolve({ quarantinedCount });
    };
    transaction.onerror = () => {
      if (!settled) reject(transaction.error ?? new Error('legacy outbox 격리가 실패했습니다.'));
    };
    transaction.onabort = () => {
      if (!settled) reject(transaction.error ?? new Error('legacy outbox 격리가 중단되었습니다.'));
    };
  });
}

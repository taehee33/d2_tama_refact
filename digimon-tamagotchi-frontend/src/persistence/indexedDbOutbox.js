const DEFAULT_DB_NAME = 'd2-tama-outbox';
const DEFAULT_DB_VERSION = 1;
const FEED_RETENTION_DAYS = 30;
const FEED_RETENTION_MAX_COUNT = 5000;
const FEED_BUCKET_MINUTES = 15;

const STATE_STORE = 'state_mutations';
const EVENT_STORE = 'events';

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

  let generatedEventSequence = 0;

  const getScopedEvents = async (category, uid, slotId) => {
    const scopeKey = buildScopeKey(uid, slotId);
    const records = await storage.getAll(EVENT_STORE);

    return sortByOccurredAtAsc(
      records.filter(
        (record) => record.scopeKey === scopeKey && record.category === category
      )
    ).map(clonePlainData);
  };

  const putEvent = async (category, input) => {
    const scopeKey = buildScopeKey(input.uid, input.slotId);
    const occurredAt = normalizeTimestamp(input.occurredAt, now());
    const eventId =
      input.eventId ??
      `${category}-${occurredAt}-${generatedEventSequence++}`;

    const nextRecord = {
      category,
      uid: String(input.uid),
      slotId: String(input.slotId),
      scopeKey,
      eventId: String(eventId),
      eventKey: buildEventKey(scopeKey, category, eventId),
      eventType: input.eventType ?? defaultEventTypeForCategory(category),
      occurredAt,
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

    await storage.put(EVENT_STORE, nextRecord);
    return clonePlainData(nextRecord);
  };

  const deleteEvent = async (category, input) => {
    const scopeKey = buildScopeKey(input.uid, input.slotId);
    const eventKey = buildEventKey(scopeKey, category, input.eventId);
    const existing = await storage.get(EVENT_STORE, eventKey);

    if (!existing) {
      return false;
    }

    await storage.delete(EVENT_STORE, eventKey);
    return true;
  };

  return {
    async putStateMutation(input) {
      const scopeKey = buildScopeKey(input.uid, input.slotId);
      const updatedAt = normalizeTimestamp(input.updatedAt, now());
      const queuedAt = normalizeTimestamp(input.queuedAt, updatedAt);

      const existing = await storage.get(STATE_STORE, scopeKey);
      if (existing && normalizeTimestamp(existing.updatedAt, 0) > updatedAt) {
        return clonePlainData(existing);
      }

      const nextRecord = {
        kind: 'state',
        uid: String(input.uid),
        slotId: String(input.slotId),
        scopeKey,
        mutationId: String(input.mutationId),
        updatedAt,
        queuedAt,
        state: clonePlainData(input.state),
      };

      await storage.put(STATE_STORE, nextRecord);
      return clonePlainData(nextRecord);
    },

    async getStateMutation(input) {
      const scopeKey = buildScopeKey(input.uid, input.slotId);
      const record = await storage.get(STATE_STORE, scopeKey);
      return record ? clonePlainData(record) : null;
    },

    async deleteStateMutation(input) {
      const scopeKey = buildScopeKey(input.uid, input.slotId);
      const record = await storage.get(STATE_STORE, scopeKey);

      if (!record || record.mutationId !== String(input.mutationId)) {
        return false;
      }

      await storage.delete(STATE_STORE, scopeKey);
      return true;
    },

    putActivityEvent(input) {
      return putEvent(EVENT_CATEGORY.ACTIVITY, input);
    },

    listActivityEvents(input) {
      return getScopedEvents(EVENT_CATEGORY.ACTIVITY, input.uid, input.slotId);
    },

    deleteActivityEvent(input) {
      return deleteEvent(EVENT_CATEGORY.ACTIVITY, input);
    },

    putBattleEvent(input) {
      return putEvent(EVENT_CATEGORY.BATTLE, input);
    },

    listBattleEvents(input) {
      return getScopedEvents(EVENT_CATEGORY.BATTLE, input.uid, input.slotId);
    },

    deleteBattleEvent(input) {
      return deleteEvent(EVENT_CATEGORY.BATTLE, input);
    },

    putFeedEvent(input) {
      return putEvent(EVENT_CATEGORY.FEED, input);
    },

    listFeedEvents(input) {
      return getScopedEvents(EVENT_CATEGORY.FEED, input.uid, input.slotId);
    },

    deleteFeedEvent(input) {
      return deleteEvent(EVENT_CATEGORY.FEED, input);
    },

    async summarizeFeedBuckets(input) {
      const bucketMinutes = input.bucketMinutes ?? FEED_BUCKET_MINUTES;
      const bucketSizeMs = bucketMinutes * 60 * 1000;
      const fromOccurredAt =
        input.fromOccurredAt == null ? Number.NEGATIVE_INFINITY : input.fromOccurredAt;
      const toOccurredAt =
        input.toOccurredAt == null ? Number.POSITIVE_INFINITY : input.toOccurredAt;
      const feedEvents = await getScopedEvents(EVENT_CATEGORY.FEED, input.uid, input.slotId);

      const bucketMap = new Map();

      feedEvents.forEach((record) => {
        if (record.occurredAt < fromOccurredAt || record.occurredAt > toOccurredAt) {
          return;
        }

        const bucketStartAt =
          Math.floor(record.occurredAt / bucketSizeMs) * bucketSizeMs;
        const existingBucket = bucketMap.get(bucketStartAt);

        if (existingBucket) {
          existingBucket.eventCount += 1;
          existingBucket.totalFeedQuantity += record.feedQuantity ?? 1;
          existingBucket.syncedCount += isSyncedRecord(record) ? 1 : 0;
          existingBucket.pendingCount += isSyncedRecord(record) ? 0 : 1;
          existingBucket.lastOccurredAt = Math.max(
            existingBucket.lastOccurredAt,
            record.occurredAt
          );
          return;
        }

        bucketMap.set(bucketStartAt, {
          uid: String(input.uid),
          slotId: String(input.slotId),
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
      const feedEvents = await getScopedEvents(EVENT_CATEGORY.FEED, input.uid, input.slotId);
      const syncedEvents = feedEvents
        .filter(isSyncedRecord)
        .sort(sortByOccurredAtDesc);

      const retainKeys = new Set();

      syncedEvents.forEach((record, index) => {
        const withinRecentWindow = record.occurredAt >= cutoff;
        const withinCountWindow = index < maxCount;

        if (withinRecentWindow && withinCountWindow) {
          retainKeys.add(record.eventKey);
        }
      });

      const deletableEvents = syncedEvents.filter(
        (record) => !retainKeys.has(record.eventKey)
      );

      for (const record of deletableEvents) {
        await storage.delete(EVENT_STORE, record.eventKey);
      }

      return {
        deletedCount: deletableEvents.length,
        keptCount: syncedEvents.length - deletableEvents.length,
        pendingCount: feedEvents.length - syncedEvents.length,
      };
    },
  };
}

function assertStorage(storage) {
  const requiredMethods = ['get', 'put', 'delete', 'getAll'];

  requiredMethods.forEach((methodName) => {
    if (typeof storage?.[methodName] !== 'function') {
      throw new TypeError(`storage.${methodName} 구현이 필요합니다.`);
    }
  });
}

function buildScopeKey(uid, slotId) {
  if (uid == null || uid === '') {
    throw new TypeError('uid가 필요합니다.');
  }

  if (slotId == null || slotId === '') {
    throw new TypeError('slotId가 필요합니다.');
  }

  return `${String(uid)}::${String(slotId)}`;
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

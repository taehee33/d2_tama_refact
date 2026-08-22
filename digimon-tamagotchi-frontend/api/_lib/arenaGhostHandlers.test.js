"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_OPPONENT_SORT,
  OPPONENT_PAGE_SIZE,
  buildOpponentGhostDto,
  classifyGhostLinkStatus,
  createArenaGhostCollectionHandler,
  listOpponentGhosts,
} = require("./arenaGhostHandlers");

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
    },
  };
}

function createConfigDb(config) {
  return {
    doc() {
      return {
        async get() {
          return { exists: true, data: () => config };
        },
      };
    },
  };
}

function createOpponentGhost(ghostId, ownerUid, wins, registeredAt) {
  return {
    ghostId,
    ownerUid,
    status: "active",
    registeredAt: new Date(registeredAt),
    snapshot: { digimonId: "Greymon", digimonName: "그레이몬" },
    ownDefenseRecord: { wins, losses: 0 },
  };
}

function createOpponentListDb(ghosts) {
  const calls = { limit: null, orderBy: [], startAfter: null, where: [], count: 0 };
  const query = {
    where(field, operator, value) {
      calls.where.push([field, operator, value]);
      return this;
    },
    orderBy(field, direction) {
      calls.orderBy.push([typeof field === "string" ? field : "__name__", direction]);
      return this;
    },
    startAfter(...values) {
      calls.startAfter = values;
      return this;
    },
    limit(value) {
      calls.limit = value;
      return this;
    },
    async get() {
      return {
        docs: ghosts.slice(0, calls.limit).map((ghost) => ({
          id: ghost.ghostId,
          data: () => ghost,
        })),
      };
    },
    count() {
      calls.count += 1;
      const excludedOwnerUid = [...calls.where]
        .reverse()
        .find(([field, operator]) => field === "ownerUid" && operator === "!=")?.[2];
      return {
        async get() {
          return {
            data: () => ({
              count: ghosts.filter((ghost) =>
                ghost.status === "active" && ghost.ownerUid !== excludedOwnerUid
              ).length,
            }),
          };
        },
      };
    },
  };
  return {
    calls,
    collection() {
      return query;
    },
    doc(path) {
      return { path };
    },
    async getAll(...refs) {
      return refs.map((ref) => ({
        data: () => ref.path.endsWith("/profile/main") ? { tamerName: `테이머-${ref.path.split("/")[1]}` } : {},
      }));
    },
  };
}

test("Ghost API는 minimum client schema보다 낮은 요청을 structured 426으로 거부한다", async () => {
  const handler = createArenaGhostCollectionHandler({
    verifyRequestUser: async () => ({ uid: "owner-a" }),
    db: createConfigDb({ minArenaClientSchemaVersion: 3 }),
  });
  const response = createResponse();
  await handler(
    {
      method: "GET",
      headers: { "x-arena-client-schema-version": "2" },
      query: { scope: "mine" },
    },
    response
  );
  assert.equal(response.statusCode, 426);
  assert.equal(response.payload.error.code, "ARENA_CLIENT_UPGRADE_REQUIRED");
  assert.equal(response.payload.error.retryable, false);
});

test("Ghost API 인증 오류는 ArenaError 계약으로 정규화한다", async () => {
  const authError = new Error("legacy auth error");
  authError.status = 401;
  const handler = createArenaGhostCollectionHandler({
    verifyRequestUser: async () => {
      throw authError;
    },
  });
  const response = createResponse();
  await handler({ method: "GET", headers: {}, query: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.payload.error.code, "ARENA_AUTH_REQUIRED");
});

test("Ghost link status는 exact identity일 때만 linked다", () => {
  const ghost = {
    sourceCombatIdentityId: "identity-a",
    sourceDigimonInstanceId: "life-a",
    sourceCombatRevision: 2,
    snapshot: { digimonId: "Greymon" },
  };
  assert.equal(
    classifyGhostLinkStatus(ghost, {
      exists: true,
      data: () => ({
        digimonInstanceId: "life-a",
        combatRevision: 2,
        selectedDigimon: "Greymon",
        digimonStats: { isDead: false },
      }),
    }),
    "linked"
  );
  assert.equal(
    classifyGhostLinkStatus(ghost, {
      exists: true,
      data: () => ({
        digimonInstanceId: "life-a",
        combatRevision: 3,
        selectedDigimon: "MetalGreymon",
        digimonStats: { isDead: false },
      }),
    }),
    "evolved"
  );
  assert.equal(
    classifyGhostLinkStatus(ghost, {
      exists: true,
      data: () => ({
        digimonInstanceId: "life-b",
        combatRevision: 1,
        selectedDigimon: "Poyomon",
        digimonStats: { isDead: false },
      }),
    }),
    "dead"
  );
});

test("Ghost link status는 legacy와 원본 누락을 구분한다", () => {
  assert.equal(classifyGhostLinkStatus({}, null), "legacy");
  assert.equal(
    classifyGhostLinkStatus({
      sourceCombatIdentityId: "identity-a",
      sourceDigimonInstanceId: "life-a",
      sourceCombatRevision: 2,
      snapshot: { digimonId: "Greymon" },
    }, null),
    "unknown"
  );
  assert.equal(
    classifyGhostLinkStatus({
      sourceCombatIdentityId: "identity-a",
      sourceDigimonInstanceId: "life-a",
      sourceCombatRevision: 2,
      snapshot: { digimonId: "Greymon" },
    }, { exists: false }),
    "source_missing"
  );
});

test("상대 DTO는 source identity와 내부 pending 정보를 노출하지 않는다", () => {
  const dto = buildOpponentGhostDto(
    {
      ghostId: "ghost-a",
      ownerUid: "owner-a",
      status: "active",
      sourceSlotId: "slot1",
      sourceDigimonInstanceId: "life-a",
      sourceCombatRevision: 2,
      pendingMirrorCount: 1,
      snapshot: {
        digimonId: "Greymon",
        digimonName: "그레이몬",
        combatPowerAtCapture: 100,
      },
      ownDefenseRecord: { wins: 1, losses: 2 },
    },
    "테이머"
  );
  assert.equal(dto.sourceSlotId, undefined);
  assert.equal(dto.sourceDigimonInstanceId, undefined);
  assert.equal(dto.pendingMirrorCount, undefined);
  assert.equal(dto.ownerDisplayName, "테이머");
});

test("상대 목록은 본인 Ghost를 제외하고 6명과 반환된 마지막 상대 cursor를 제공한다", async () => {
  const ghosts = [
    createOpponentGhost("mine-1", "owner-a", 9, "2026-08-22T12:00:00Z"),
    createOpponentGhost("ghost-1", "owner-1", 8, "2026-08-22T11:00:00Z"),
    createOpponentGhost("mine-2", "owner-a", 7, "2026-08-22T10:00:00Z"),
    createOpponentGhost("ghost-2", "owner-2", 6, "2026-08-22T09:00:00Z"),
    createOpponentGhost("ghost-3", "owner-3", 5, "2026-08-22T08:00:00Z"),
    createOpponentGhost("mine-3", "owner-a", 4, "2026-08-22T07:00:00Z"),
    createOpponentGhost("ghost-4", "owner-4", 3, "2026-08-22T06:00:00Z"),
    createOpponentGhost("ghost-5", "owner-5", 2, "2026-08-22T05:00:00Z"),
    createOpponentGhost("ghost-6", "owner-6", 1, "2026-08-22T04:00:00Z"),
    createOpponentGhost("ghost-7", "owner-7", 0, "2026-08-22T03:00:00Z"),
  ];
  const db = createOpponentListDb(ghosts);
  const result = await listOpponentGhosts({ uid: "owner-a", deps: { db } });

  assert.equal(OPPONENT_PAGE_SIZE, 6);
  assert.equal(db.calls.limit, 10);
  assert.deepEqual(result.ghosts.map((ghost) => ghost.ghostId), [
    "ghost-1", "ghost-2", "ghost-3", "ghost-4", "ghost-5", "ghost-6",
  ]);
  const decodedCursor = JSON.parse(Buffer.from(result.nextCursor, "base64url").toString("utf8"));
  assert.equal(decodedCursor.sort, DEFAULT_OPPONENT_SORT);
  assert.equal(decodedCursor.ghostId, "ghost-6");
});

test("상대 목록 전체 수는 활성 상태인 다른 사용자의 Ghost만 집계한다", async () => {
  const ghosts = [
    createOpponentGhost("mine-1", "owner-a", 0, "2026-08-22T04:00:00Z"),
    createOpponentGhost("ghost-1", "owner-1", 0, "2026-08-22T03:00:00Z"),
    createOpponentGhost("ghost-2", "owner-2", 0, "2026-08-22T02:00:00Z"),
    { ...createOpponentGhost("inactive", "owner-3", 0, "2026-08-22T01:00:00Z"), status: "disabled" },
  ];
  const db = createOpponentListDb(ghosts);

  const result = await listOpponentGhosts({
    uid: "owner-a",
    includeTotal: true,
    deps: { db },
  });

  assert.equal(result.totalCount, 2);
  assert.equal(db.calls.count, 1);
  assert.ok(db.calls.where.some(([field, operator, value]) =>
    field === "ownerUid" && operator === "!=" && value === "owner-a"
  ));
});

test("상대 전체 수를 요청하지 않으면 집계 쿼리와 응답 필드를 생략한다", async () => {
  const db = createOpponentListDb([
    createOpponentGhost("ghost-1", "owner-1", 0, "2026-08-22T01:00:00Z"),
  ]);
  const result = await listOpponentGhosts({ uid: "viewer", deps: { db } });

  assert.equal(Object.hasOwn(result, "totalCount"), false);
  assert.equal(db.calls.count, 0);
});

test("Ghost API는 잘못된 상대 전체 수 옵션을 거부한다", async () => {
  const handler = createArenaGhostCollectionHandler({
    verifyRequestUser: async () => ({ uid: "owner-a" }),
    db: createConfigDb({ minArenaClientSchemaVersion: 2 }),
  });
  const response = createResponse();

  await handler({
    method: "GET",
    headers: { "x-arena-client-schema-version": "2" },
    query: { scope: "opponents", includeTotal: "1" },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.error.code, "ARENA_INVALID_REQUEST");
});

test("상대 목록은 네 정렬의 쿼리 순서와 cursor 정렬 소속을 검증한다", async () => {
  const expectedOrders = {
    registered_desc: [["registeredAt", "desc"], ["__name__", "desc"]],
    registered_asc: [["registeredAt", "asc"], ["__name__", "asc"]],
    defense_wins_desc: [["ownDefenseRecord.wins", "desc"], ["registeredAt", "desc"], ["__name__", "desc"]],
    defense_wins_asc: [["ownDefenseRecord.wins", "asc"], ["registeredAt", "desc"], ["__name__", "desc"]],
  };

  let latestCursor;
  for (const [sort, expectedOrder] of Object.entries(expectedOrders)) {
    const ghosts = Array.from({ length: 7 }, (_, index) =>
      createOpponentGhost(`ghost-${index}`, `owner-${index}`, 7 - index, `2026-08-22T0${9 - index}:00:00Z`)
    );
    const db = createOpponentListDb(ghosts);
    const result = await listOpponentGhosts({ uid: "viewer", sort, deps: { db } });
    assert.deepEqual(db.calls.orderBy, expectedOrder);
    assert.ok(result.nextCursor);
    if (sort === DEFAULT_OPPONENT_SORT) latestCursor = result.nextCursor;
  }

  await assert.rejects(
    () => listOpponentGhosts({
      uid: "viewer",
      sort: "registered_asc",
      cursor: latestCursor,
      deps: { db: createOpponentListDb([]) },
    }),
    (error) => error?.code === "ARENA_INVALID_REQUEST"
  );
  await assert.rejects(
    () => listOpponentGhosts({ uid: "viewer", sort: "unknown", deps: { db: createOpponentListDb([]) } }),
    (error) => error?.code === "ARENA_INVALID_REQUEST"
  );
});

test("상대 목록 마지막 페이지는 nextCursor를 반환하지 않는다", async () => {
  const db = createOpponentListDb([
    createOpponentGhost("ghost-1", "owner-1", 1, "2026-08-22T01:00:00Z"),
    createOpponentGhost("ghost-2", "owner-2", 0, "2026-08-22T00:00:00Z"),
  ]);
  const result = await listOpponentGhosts({ uid: "viewer", deps: { db } });
  assert.equal(result.ghosts.length, 2);
  assert.equal(result.nextCursor, null);
});

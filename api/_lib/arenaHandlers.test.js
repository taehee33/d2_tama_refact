const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createArenaAdminConfigHandler,
  createArenaArchiveDeleteHandler,
  createArenaArchiveMonitoringHandler,
  createArenaBattleCompleteHandler,
  createArenaSeasonEndHandler,
  createArenaSetOperatorHandler,
  createArenaUserDirectoryHandler,
} = require("./arenaHandlers");
const {
  parseFirestoreFields,
} = require("../../digimon-tamagotchi-frontend/api/_lib/firestoreAdmin");

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      if (payload !== undefined) {
        this.body = typeof payload === "string" ? JSON.parse(payload) : payload;
      }
    },
  };
}

function createOperatorDeps(operatorUids = ["admin-1"]) {
  return {
    isOperatorIdentity: async (decodedToken) => operatorUids.includes(decodedToken?.uid),
  };
}

test("arena admin config handler rejects non-admin users", async () => {
  const handler = createArenaAdminConfigHandler({
    verifyRequestUser: async () => ({ uid: "user-1", email: "user-1@example.com" }),
    ...createOperatorDeps([]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "PUT",
      headers: { authorization: "Bearer test-token" },
      body: {
        currentSeasonId: 2,
        seasonName: "Season 2",
        seasonDuration: "2026.04.01 ~ 04.30",
      },
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "운영자 권한이 없습니다.");
});

test("arena admin config handler returns archive monitoring snapshot on GET", async () => {
  const mockSnapshot = {
    summary: {
      windowHours: 24,
    },
    events: [
      {
        id: "monitor-1",
        source: "arena_archive_post",
        outcome: "success",
      },
    ],
  };

  const handler = createArenaAdminConfigHandler({
    verifyRequestUser: async () => ({ uid: "admin-1", email: "admin@example.com" }),
    getSupabaseAdminClient: () => ({}),
    getArchiveMonitoringSnapshot: async () => mockSnapshot,
    ...createOperatorDeps(["admin-1"]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: {
        view: "archive-monitoring",
        hours: "24",
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, mockSnapshot);
});

test("arena season end handler archives current season snapshot and resets entries", async () => {
  let capturedWrites = null;
  const handler = createArenaSeasonEndHandler({
    verifyRequestUser: async () => ({ uid: "admin-1", email: "admin@example.com" }),
    getDocument: async (path) => {
      if (path === "game_settings/arena_config") {
        return {
          data: {
            currentSeasonId: 2,
          },
        };
      }
      return null;
    },
    listDocuments: async () => [
      {
        id: "entry-1",
        data: {
          userId: "user-1",
          tamerName: "테스터A",
          digimonSnapshot: {
            digimonName: "Agumon",
            stage: "Adult",
          },
          record: {
            wins: 10,
            losses: 4,
            seasonWins: 3,
            seasonLosses: 1,
            seasonId: 2,
          },
        },
      },
      {
        id: "entry-2",
        data: {
          userId: "user-2",
          tamerName: "테스터B",
          digimonSnapshot: {
            digimonName: "Gabumon",
            stage: "Adult",
          },
          record: {
            wins: 8,
            losses: 6,
            seasonWins: 2,
            seasonLosses: 2,
            seasonId: 2,
          },
        },
      },
    ],
    commitWrites: async (writes) => {
      capturedWrites = writes;
      return { writeResults: [] };
    },
    ...createOperatorDeps(["admin-1"]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: {
        currentSeasonId: 2,
        seasonName: "Season 2",
        seasonDuration: "2026.04.01 ~ 04.30",
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.season.archiveId, "season_2");
  assert.equal(res.body.season.archivedEntryCount, 2);
  assert.equal(res.body.season.currentSeasonId, 3);
  assert.equal(capturedWrites.length, 4);

  const archiveDocument = parseFirestoreFields(capturedWrites[0].update.fields);
  assert.equal(archiveDocument.seasonId, 2);
  assert.equal(archiveDocument.entryCount, 2);
  assert.equal(archiveDocument.entries[0].tamerName, "테스터A");
  assert.deepEqual(archiveDocument.entries[0].record, {
    wins: 10,
    losses: 4,
    seasonWins: 3,
    seasonLosses: 1,
    seasonId: 2,
  });
});

test("arena archive delete handler performs soft delete", async () => {
  let capturedWrites = null;
  const handler = createArenaArchiveDeleteHandler({
    verifyRequestUser: async () => ({ uid: "admin-1", email: "admin@example.com" }),
    getDocument: async () => ({ data: { seasonId: 2 } }),
    commitWrites: async (writes) => {
      capturedWrites = writes;
      return { writeResults: [] };
    },
    ...createOperatorDeps(["admin-1"]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "DELETE",
      headers: { authorization: "Bearer test-token" },
      query: { archiveId: "season_2" },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.archive, {
    id: "season_2",
    isDeleted: true,
  });

  const deleteUpdate = parseFirestoreFields(capturedWrites[0].update.fields);
  assert.equal(deleteUpdate.isDeleted, true);
  assert.equal(deleteUpdate.deletedBy, "admin-1");
});

test("arena archive monitoring handler rejects non-admin users", async () => {
  const handler = createArenaArchiveMonitoringHandler({
    verifyRequestUser: async () => ({ uid: "user-1", email: "user-1@example.com" }),
    ...createOperatorDeps([]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: {},
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "운영자 권한이 없습니다.");
});

test("arena archive monitoring handler returns summary and events for admin users", async () => {
  const mockSnapshot = {
    summary: {
      windowHours: 24,
      sources: {
        arena_archive_post: {
          counts: {
            success: 2,
            bad_request: 0,
            forbidden: 0,
            not_found: 0,
            error: 1,
          },
          totalCount: 3,
          failureCount: 1,
          lastSuccessAt: "2026-04-04T00:00:00.000Z",
          lastFailureAt: "2026-04-04T01:00:00.000Z",
        },
      },
    },
    events: [
      {
        id: "event-1",
        source: "arena_archive_post",
        outcome: "error",
        statusCode: 500,
        archiveId: "arena-1",
        createdAt: "2026-04-04T01:00:00.000Z",
      },
    ],
  };

  const handler = createArenaArchiveMonitoringHandler({
    verifyRequestUser: async () => ({ uid: "admin-1", email: "admin@example.com" }),
    getSupabaseAdminClient: () => ({}),
    getArchiveMonitoringSnapshot: async () => mockSnapshot,
    ...createOperatorDeps(["admin-1"]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: { hours: "24", limit: "50" },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, mockSnapshot);
});

test("arena user directory handler rejects non-admin users", async () => {
  const handler = createArenaUserDirectoryHandler({
    verifyRequestUser: async () => ({ uid: "user-1", email: "user-1@example.com" }),
    ...createOperatorDeps([]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: {},
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "운영자 권한이 없습니다.");
});

test("arena user directory handler returns normalized users and role summary", async () => {
  const handler = createArenaUserDirectoryHandler({
    verifyRequestUser: async () => ({ uid: "news-1", email: "news@example.com" }),
    listDocuments: async (path) => {
      if (path === "users") {
        return [
          {
            id: "admin-1",
            data: {
              email: "admin@example.com",
              displayName: "Arena Admin",
              createdAt: "2026-04-10T00:00:00.000Z",
              updatedAt: "2026-04-12T01:00:00.000Z",
              achievements: ["첫 로그인"],
              maxSlots: 12,
            },
          },
          {
            id: "news-1",
            data: {
              email: "news@example.com",
              displayName: "News Editor",
              createdAt: "2026-04-09T00:00:00.000Z",
              updatedAt: "2026-04-11T00:00:00.000Z",
            },
          },
          {
            id: "user-1",
            data: {
              email: "user@example.com",
              displayName: "Normal User",
              createdAt: "2026-04-08T00:00:00.000Z",
            },
          },
        ];
      }

      if (path === "operator_roles") {
        return [
          {
            id: "admin-1",
            data: {
              uid: "admin-1",
              isOperator: true,
              updatedAt: "2026-04-12T06:00:00.000Z",
            },
          },
          {
            id: "news-1",
            data: {
              uid: "news-1",
              isOperator: true,
              updatedAt: "2026-04-11T06:00:00.000Z",
            },
          },
        ];
      }

      if (path === "operator_role_events") {
        return [
          {
            id: "event-older",
            data: {
              targetUid: "news-1",
              targetEmail: "news@example.com",
              beforeIsOperator: false,
              afterIsOperator: true,
              actedBy: "admin-1",
              actedByEmail: "admin@example.com",
              actedAt: "2026-04-11T06:00:00.000Z",
              source: "user-directory",
            },
          },
          {
            id: "event-latest",
            data: {
              targetUid: "user-1",
              targetEmail: "user@example.com",
              beforeIsOperator: true,
              afterIsOperator: false,
              actedBy: "admin-1",
              actedByEmail: "admin@example.com",
              actedAt: "2026-04-12T07:00:00.000Z",
              source: "user-directory",
            },
          },
        ];
      }

      return [];
    },
    getDocument: async (path) => {
      if (path === "users/admin-1/profile/main") {
        return {
          data: {
            tamerName: "관리자 테이머",
            achievements: ["첫 로그인", "업적 둘"],
            maxSlots: 15,
            updatedAt: "2026-04-12T05:00:00.000Z",
          },
        };
      }

      if (path === "users/news-1/profile/main") {
        return {
          data: {
            tamerName: "소식 운영자",
            updatedAt: "2026-04-11T05:00:00.000Z",
          },
        };
      }

      if (path === "users/user-1/profile/main") {
        return {
          data: {
            tamerName: "일반 유저",
          },
        };
      }

      return null;
    },
    ...createOperatorDeps(["admin-1", "news-1"]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: {},
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary.totalUsers, 3);
  assert.equal(res.body.summary.operatorCount, 2);
  assert.equal(res.body.summary.generalUserCount, 1);
  assert.deepEqual(
    res.body.users.map((user) => user.uid),
    ["admin-1", "news-1", "user-1"]
  );
  assert.equal(res.body.users[0].tamerName, "관리자 테이머");
  assert.equal(res.body.users[0].maxSlots, 15);
  assert.equal(res.body.users[0].achievementCount, 2);
  assert.equal(res.body.users[0].roleLabel, "운영자");
  assert.equal(res.body.users[0].roleUpdatedAt, "2026-04-12T06:00:00.000Z");
  assert.equal(res.body.users[1].roleLabel, "운영자");
  assert.equal(res.body.users[2].roleLabel, "일반");
  assert.equal(res.body.recentEvents.length, 2);
  assert.equal(res.body.recentEvents[0].id, "event-latest");
  assert.equal(res.body.recentEvents[0].actionLabel, "운영자 해제");
  assert.equal(res.body.recentEvents[0].targetName, "일반 유저");
  assert.equal(res.body.recentEvents[0].actedByName, "관리자 테이머");
  assert.equal(res.body.recentEvents[1].id, "event-older");
  assert.equal(res.body.recentEvents[1].actionLabel, "운영자 지정");
});

test("arena set operator handler grants operator role and writes audit log", async () => {
  let capturedWrites = null;
  const handler = createArenaSetOperatorHandler({
    verifyRequestUser: async () => ({ uid: "admin-1", email: "admin@example.com" }),
    getDocument: async (path) => {
      if (path === "users/user-1") {
        return {
          data: {
            email: "user@example.com",
            displayName: "Normal User",
          },
        };
      }

      if (path === "users/user-1/profile/main") {
        return {
          data: {
            tamerName: "일반 유저",
          },
        };
      }

      if (path === "operator_roles/user-1") {
        return null;
      }

      return null;
    },
    listDocuments: async (path) => {
      if (path === "operator_roles") {
        return [
          {
            id: "admin-1",
            data: {
              uid: "admin-1",
              isOperator: true,
            },
          },
        ];
      }

      return [];
    },
    commitWrites: async (writes) => {
      capturedWrites = writes;
      return { writeResults: [] };
    },
    ...createOperatorDeps(["admin-1"]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      query: { action: "set-operator" },
      body: {
        targetUid: "user-1",
        isOperator: true,
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.role.uid, "user-1");
  assert.equal(res.body.role.isOperator, true);
  assert.equal(capturedWrites.length, 2);

  const roleDocument = parseFirestoreFields(capturedWrites[0].update.fields);
  const eventDocument = parseFirestoreFields(capturedWrites[1].update.fields);
  assert.equal(roleDocument.uid, "user-1");
  assert.equal(roleDocument.isOperator, true);
  assert.equal(roleDocument.displayName, "일반 유저");
  assert.equal(eventDocument.targetUid, "user-1");
  assert.equal(eventDocument.beforeIsOperator, false);
  assert.equal(eventDocument.afterIsOperator, true);
});

test("arena set operator handler blocks removing the last operator", async () => {
  const handler = createArenaSetOperatorHandler({
    verifyRequestUser: async () => ({ uid: "admin-1", email: "admin@example.com" }),
    getDocument: async (path) => {
      if (path === "users/admin-1") {
        return {
          data: {
            email: "admin@example.com",
            displayName: "Arena Admin",
          },
        };
      }

      if (path === "users/admin-1/profile/main") {
        return {
          data: {
            tamerName: "관리자 테이머",
          },
        };
      }

      if (path === "operator_roles/admin-1") {
        return {
          data: {
            uid: "admin-1",
            isOperator: true,
            grantedBy: "seed",
            grantedAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-12T00:00:00.000Z",
          },
        };
      }

      return null;
    },
    listDocuments: async (path) => {
      if (path === "operator_roles") {
        return [
          {
            id: "admin-1",
            data: {
              uid: "admin-1",
              isOperator: true,
            },
          },
        ];
      }

      return [];
    },
    ...createOperatorDeps(["admin-1"]),
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      query: { action: "set-operator" },
      body: {
        targetUid: "admin-1",
        isOperator: false,
      },
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "마지막 운영자 권한은 해제할 수 없습니다.");
});

test("arena battle complete handler rejects foreign myEntryId", async () => {
  const handler = createArenaBattleCompleteHandler({
    verifyRequestUser: async () => ({ uid: "user-1", email: "user-1@example.com" }),
    getDocument: async (path) => {
      if (path.endsWith("/my-entry")) {
        return {
          data: {
            userId: "someone-else",
            record: {
              wins: 1,
              losses: 0,
              seasonWins: 1,
              seasonLosses: 0,
              seasonId: 2,
            },
            digimonSnapshot: { digimonName: "Agumon" },
          },
        };
      }

      return {
        data: {
          userId: "enemy-1",
          record: {
            wins: 0,
            losses: 1,
            seasonWins: 0,
            seasonLosses: 1,
            seasonId: 2,
          },
          digimonSnapshot: { digimonName: "Gabumon" },
        },
      };
    },
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: {
        myEntryId: "my-entry",
        defenderEntryId: "enemy-entry",
        currentSeasonId: 2,
        battleResult: {
          win: true,
          logs: [{ message: "첫 타격" }],
        },
      },
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "자신의 아레나 엔트리만 배틀에 사용할 수 있습니다.");
});

test("arena battle complete handler stores ready archive status and summary log", async () => {
  let capturedArchiveRecord = null;
  let capturedWrites = null;

  const handler = createArenaBattleCompleteHandler({
    verifyRequestUser: async () => ({ uid: "user-1", email: "user-1@example.com", name: "테스터" }),
    getDocument: async (path) => {
      if (path.endsWith("/my-entry")) {
        return {
          data: {
            userId: "user-1",
            tamerName: "테스터",
            record: {
              wins: 1,
              losses: 0,
              seasonWins: 1,
              seasonLosses: 0,
              seasonId: 2,
            },
            digimonSnapshot: { digimonName: "Agumon" },
          },
        };
      }

      return {
        data: {
          userId: "enemy-1",
          tamerName: "상대",
          record: {
            wins: 0,
            losses: 1,
            seasonWins: 0,
            seasonLosses: 1,
            seasonId: 2,
          },
          digimonSnapshot: { digimonName: "Gabumon" },
        },
      };
    },
    getSupabaseAdminClient: () => ({}),
    upsertArchiveRow: async ({ record }) => {
      capturedArchiveRecord = record;
      return record;
    },
    commitWrites: async (writes) => {
      capturedWrites = writes;
      return { writeResults: [] };
    },
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: {
        myEntryId: "my-entry",
        defenderEntryId: "enemy-entry",
        currentSeasonId: 2,
        archiveId: "arena_manual_1",
        battleResult: {
          win: true,
          logs: [{ message: "첫 타격" }],
        },
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.battle, {
    archiveId: "arena_manual_1",
    archiveStatus: "ready",
    defenderEntryId: "enemy-entry",
    myEntryId: "my-entry",
    winnerUid: "user-1",
  });
  assert.equal(capturedArchiveRecord.id, "arena_manual_1");
  assert.equal(capturedArchiveRecord.attacker_name, "테스터");
  assert.equal(capturedArchiveRecord.defender_name, "상대");
  assert.equal(capturedWrites.length, 3);

  const summaryDocument = parseFirestoreFields(capturedWrites[2].update.fields);
  assert.equal(summaryDocument.archiveId, "arena_manual_1");
  assert.equal(summaryDocument.archiveStatus, "ready");
  assert.equal(summaryDocument.attackerId, "user-1");
  assert.equal(summaryDocument.defenderId, "enemy-1");
});

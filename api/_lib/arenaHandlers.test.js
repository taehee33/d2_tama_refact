const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createArenaAdminConfigHandler,
  createArenaArchiveDeleteHandler,
  createArenaArchiveMonitoringHandler,
  createArenaBattleCompleteHandler,
  createArenaSeasonEndHandler,
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

function withArenaAdminEnv(callback) {
  const previousUids = process.env.ARENA_ADMIN_UIDS;
  const previousEmails = process.env.ARENA_ADMIN_EMAILS;
  process.env.ARENA_ADMIN_UIDS = "admin-1";
  process.env.ARENA_ADMIN_EMAILS = "admin@example.com";

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      process.env.ARENA_ADMIN_UIDS = previousUids;
      process.env.ARENA_ADMIN_EMAILS = previousEmails;
    });
}

test("arena admin config handler rejects non-admin users", async () => {
  const previousUids = process.env.ARENA_ADMIN_UIDS;
  const previousEmails = process.env.ARENA_ADMIN_EMAILS;
  process.env.ARENA_ADMIN_UIDS = "";
  process.env.ARENA_ADMIN_EMAILS = "";

  const handler = createArenaAdminConfigHandler({
    verifyRequestUser: async () => ({ uid: "user-1", email: "user-1@example.com" }),
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
  assert.equal(res.body.error, "아레나 관리자 권한이 없습니다.");

  process.env.ARENA_ADMIN_UIDS = previousUids;
  process.env.ARENA_ADMIN_EMAILS = previousEmails;
});

test("arena admin config handler returns archive monitoring snapshot on GET", async () => {
  await withArenaAdminEnv(async () => {
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
});

test("arena season end handler archives current season snapshot and resets entries", async () => {
  await withArenaAdminEnv(async () => {
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
});

test("arena archive delete handler performs soft delete", async () => {
  await withArenaAdminEnv(async () => {
    let capturedWrites = null;
    const handler = createArenaArchiveDeleteHandler({
      verifyRequestUser: async () => ({ uid: "admin-1", email: "admin@example.com" }),
      getDocument: async () => ({ data: { seasonId: 2 } }),
      commitWrites: async (writes) => {
        capturedWrites = writes;
        return { writeResults: [] };
      },
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
});

test("arena archive monitoring handler rejects non-admin users", async () => {
  const previousUids = process.env.ARENA_ADMIN_UIDS;
  const previousEmails = process.env.ARENA_ADMIN_EMAILS;
  process.env.ARENA_ADMIN_UIDS = "";
  process.env.ARENA_ADMIN_EMAILS = "";

  const handler = createArenaArchiveMonitoringHandler({
    verifyRequestUser: async () => ({ uid: "user-1", email: "user-1@example.com" }),
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
  assert.equal(res.body.error, "아레나 관리자 권한이 없습니다.");

  process.env.ARENA_ADMIN_UIDS = previousUids;
  process.env.ARENA_ADMIN_EMAILS = previousEmails;
});

test("arena archive monitoring handler returns summary and events for admin users", async () => {
  await withArenaAdminEnv(async () => {
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

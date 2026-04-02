const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createArenaBattleArchivePostHandler,
  createArenaBattleReplayGetHandler,
  createJogressArchivePostHandler,
} = require("./logArchiveHandlers");
const {
  buildArenaBattleArchiveRecord,
  buildJogressArchiveRecord,
  mapArenaBattleArchiveRow,
  mapJogressArchiveRow,
} = require("./logArchives");

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
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
      this.ended = true;
    },
  };
}

function createSupabaseMock({ upsertRow = null, selectRow = null } = {}) {
  const state = {
    fromTables: [],
    upsertCalls: [],
    selectCalls: [],
  };

  const supabase = {
    from(table) {
      state.fromTables.push(table);
      return {
        upsert(record, options) {
          state.upsertCalls.push({ table, record, options });
          return {
            select() {
              return {
                single: async () => ({
                  data: upsertRow || record,
                  error: null,
                }),
              };
            },
          };
        },
        select() {
          return {
            eq(field, value) {
              state.selectCalls.push({ table, field, value });
              return {
                maybeSingle: async () => ({
                  data: selectRow,
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };

  return { supabase, state };
}

test("arena archive post stores required fields and returns minimal payload", async () => {
  const { supabase, state } = createSupabaseMock();
  const handler = createArenaBattleArchivePostHandler({
    verifyRequestUser: async () => ({ uid: "user-1" }),
    getSupabaseAdminClient: () => supabase,
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: {
        id: "arena-archive-1",
        userUid: "user-1",
        attackerUid: "user-1",
        attackerName: "테이머1",
        attackerDigimonName: "아구몬",
        defenderUid: "user-2",
        defenderName: "테이머2",
        defenderDigimonName: "파피몬",
        myEntryId: "entry-1",
        defenderEntryId: "entry-2",
        winnerUid: "user-1",
        summary: "승리 요약",
        replayLogs: [
          { side: "attacker", message: "첫 타격" },
          { side: "defender", message: "회피" },
        ],
        payload: {
          logSummary: "승리 요약",
          roundCount: 2,
        },
      },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(state.fromTables[0], "arena_battle_log_archives");
  assert.equal(state.upsertCalls[0].record.id, "arena-archive-1");
  assert.equal(state.upsertCalls[0].record.user_uid, "user-1");
  assert.equal(state.upsertCalls[0].record.attacker_name, "테이머1");
  assert.equal(state.upsertCalls[0].record.replay_logs.length, 2);
  assert.deepEqual(res.body, {
    archive: {
      id: "arena-archive-1",
      replayLogs: [
        { side: "attacker", message: "첫 타격" },
        { side: "defender", message: "회피" },
      ],
      payload: {
        logSummary: "승리 요약",
        roundCount: 2,
      },
    },
  });
});

test("arena replay get allows owner attacker and defender", async () => {
  const archiveRow = {
    id: "arena-archive-1",
    user_uid: "user-1",
    attacker_uid: "user-1",
    attacker_name: "테이머1",
    defender_uid: "user-2",
    defender_name: "테이머2",
    replay_logs: [{ message: "다시보기" }],
    payload: { logSummary: "승리" },
    created_at: "2026-04-01T00:00:00.000Z",
  };
  const { supabase, state } = createSupabaseMock({ selectRow: archiveRow });
  const handler = createArenaBattleReplayGetHandler({
    verifyRequestUser: async () => ({ uid: "user-2" }),
    getSupabaseAdminClient: () => supabase,
  });

  const res = createMockRes();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: { archiveId: "arena-archive-1" },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(state.selectCalls[0].field, "id");
  assert.equal(state.selectCalls[0].value, "arena-archive-1");
  assert.deepEqual(res.body, {
    archive: {
      id: "arena-archive-1",
      replayLogs: [{ message: "다시보기" }],
      payload: { logSummary: "승리" },
    },
  });
});

test("arena replay get rejects unrelated user", async () => {
  const { supabase } = createSupabaseMock({
    selectRow: {
      id: "arena-archive-1",
      user_uid: "user-1",
      attacker_uid: "user-1",
      defender_uid: "user-2",
      replay_logs: [],
      payload: {},
    },
  });
  const handler = createArenaBattleReplayGetHandler({
    verifyRequestUser: async () => ({ uid: "user-9" }),
    getSupabaseAdminClient: () => supabase,
  });

  const res = createMockRes();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: { archiveId: "arena-archive-1" },
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "배틀 다시보기를 조회할 권한이 없습니다.");
});

test("jogress archive post stores payload and returns archive id", async () => {
  const { supabase, state } = createSupabaseMock();
  const handler = createJogressArchivePostHandler({
    verifyRequestUser: async () => ({ uid: "host-1" }),
    getSupabaseAdminClient: () => supabase,
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: {
        id: "jogress-archive-1",
        hostUid: "host-1",
        hostTamerName: "호스트",
        hostSlotId: 3,
        hostDigimonName: "아구몬",
        hostSlotVersion: "Ver.1",
        guestUid: "guest-2",
        guestTamerName: "게스트",
        guestSlotId: 7,
        guestDigimonName: "피요몬",
        guestSlotVersion: "Ver.1",
        targetId: "MetalGreymon",
        targetName: "메탈그레이몬",
        isOnline: true,
        payload: {
          resultName: "메탈그레이몬",
          merged: true,
        },
      },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(state.fromTables[0], "jogress_log_archives");
  assert.equal(state.upsertCalls[0].record.id, "jogress-archive-1");
  assert.equal(state.upsertCalls[0].record.host_uid, "host-1");
  assert.equal(state.upsertCalls[0].record.host_slot_id, "3");
  assert.equal(state.upsertCalls[0].record.guest_slot_id, "7");
  assert.equal(state.upsertCalls[0].record.host_slot_version, "Ver.1");
  assert.equal(state.upsertCalls[0].record.is_online, true);
  assert.deepEqual(res.body, { archive: { id: "jogress-archive-1" } });
});

test("record builders map rows back to response payloads", () => {
  const arena = mapArenaBattleArchiveRow({
    id: "arena-archive-1",
    replay_logs: [{ message: "첫 타격" }],
    payload: { logSummary: "승리" },
  });
  const jogress = mapJogressArchiveRow({
    id: "jogress-archive-1",
  });

  assert.deepEqual(arena, {
    id: "arena-archive-1",
    replayLogs: [{ message: "첫 타격" }],
    payload: { logSummary: "승리" },
  });
  assert.deepEqual(jogress, { id: "jogress-archive-1" });
});

test("record builders validate payload shapes", () => {
  assert.throws(
    () =>
      buildArenaBattleArchiveRecord(
        {
          id: "arena-archive-1",
          userUid: "user-1",
          replayLogs: {},
          payload: {},
        },
        "user-1"
      ),
    /replayLogs/
  );

  assert.throws(
    () =>
      buildJogressArchiveRecord(
        {
          id: "jogress-archive-1",
          hostUid: "host-1",
          payload: [],
        },
        "host-1"
      ),
    /payload/
  );
});

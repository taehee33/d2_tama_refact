"use strict";

const { ArenaError } = require("./arenaErrors");
const { getArenaFirestore } = require("./arenaTransactions");
const {
  resolveRealtimeArenaRound,
  selectRealtimeArenaCpuAction,
  selectRealtimeArenaFallbackAction,
} = require("../_generated/gameProjection.cjs");
const {
  assertParticipant,
  createRequestHash,
  normalizeRequestId,
} = require("./realtimeArenaDomain");

function toMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  return new Date(value).getTime();
}

function getRunner(db, deps) {
  return deps.runTransaction || ((callback) => db.runTransaction(callback));
}

function emptyRoundSecret() {
  return { hostSubmission: null, guestSubmission: null, resolved: false, resolvedAt: null, resolutionType: null, resultHash: null };
}

function isCpuBattle(battle) {
  return battle?.mode === "cpu";
}

function usesLatestSelection(battle) {
  return battle?.rulesSnapshot?.selectionMode === "latest_until_deadline";
}

function withCpuSubmission({ battle, secret, roundSecret, now }) {
  if (!isCpuBattle(battle) || roundSecret.guestSubmission) return roundSecret;
  if (typeof secret.cpuSeed !== "string" || !secret.cpuSeed) {
    throw new ArenaError("ARENA_REALTIME_INVARIANT_VIOLATION", "CPU 배틀 비밀 정보가 손상되었습니다.");
  }
  const action = selectRealtimeArenaCpuAction({
    seed: secret.cpuSeed,
    battleId: battle.battleId,
    round: battle.round,
    currentHp: battle.currentHp,
    participants: battle.participants,
  });
  return {
    ...roundSecret,
    guestSubmission: { action, source: "cpu", submittedAt: new Date(now.getTime()) },
  };
}

function withFallbackSubmissions({ battle, secret, roundSecret, now }) {
  if (!usesLatestSelection(battle)) return roundSecret;
  if (typeof secret.battleSeed !== "string" || !secret.battleSeed) {
    throw new ArenaError("ARENA_REALTIME_INVARIANT_VIOLATION", "자동 선택 비밀 정보가 손상되었습니다.");
  }
  let next = roundSecret;
  for (const role of ["host", "guest"]) {
    const submissionKey = `${role}Submission`;
    if (next[submissionKey] || (role === "guest" && isCpuBattle(battle))) continue;
    next = {
      ...next,
      [submissionKey]: {
        action: selectRealtimeArenaFallbackAction({
          seed: secret.battleSeed,
          battleId: battle.battleId,
          round: battle.round,
          role,
        }),
        source: "auto",
        selectionRevision: 0,
        submittedAt: new Date(now.getTime()),
      },
    };
  }
  return next;
}

function viewerFor(secret, role, round) {
  const roundSecret = secret.roundSecrets?.[String(round)];
  const submission = roundSecret?.[`${role}Submission`];
  return {
    role,
    hasSubmitted: Boolean(submission),
    selectedAction: submission && (submission.source === "manual" || !submission.source) ? submission.action : null,
    selectionRevision: Number(submission?.selectionRevision || 0),
  };
}

function assertRulesInvariant(battle, secret) {
  if (!battle.rulesSnapshot || !battle.rulesSnapshotHash || battle.rulesSnapshotHash !== secret.rulesSnapshotHash || battle.rulesVersion !== secret.rulesVersion) {
    throw new ArenaError("ARENA_REALTIME_INVARIANT_VIOLATION", "실시간 배틀 규칙 정합성이 손상되었습니다.");
  }
}

function assertExpectedState(battle, input) {
  if (input.expectedStateVersion !== undefined && Number(input.expectedStateVersion) !== Number(battle.stateVersion)) {
    throw new ArenaError("ARENA_REALTIME_STATE_CONFLICT", "배틀 상태가 변경되었습니다. 최신 상태를 복구해 주세요.");
  }
}

function resolveStoredRound({ battle, secret, resolutionType, now }) {
  assertRulesInvariant(battle, secret);
  const key = String(battle.round);
  const roundSecret = secret.roundSecrets?.[key] || emptyRoundSecret();
  if (roundSecret.resolved) {
    return { battle, secret, resolvedRound: (battle.resolvedRounds || []).find((item) => item.round === battle.round) || null, alreadyResolved: true };
  }
  const hostAction = roundSecret.hostSubmission?.action || "no_action";
  const guestAction = roundSecret.guestSubmission?.action || "no_action";
  const transition = resolveRealtimeArenaRound({ battleState: battle, hostAction, guestAction, rules: battle.rulesSnapshot });
  const nowTimestamp = new Date(now.getTime());
  const resultHash = createRequestHash({
    battleId: battle.battleId,
    round: battle.round,
    hostAction,
    guestAction,
    ...transition,
  });
  const resolvedRound = {
    round: battle.round,
    hostAction,
    guestAction,
    hostDamageTaken: transition.hostDamageTaken,
    guestDamageTaken: transition.guestDamageTaken,
    hostHpRecovered: transition.hostHpRecovered,
    guestHpRecovered: transition.guestHpRecovered,
    hostActionResult: transition.hostActionResult,
    guestActionResult: transition.guestActionResult,
    hostHpAfter: transition.currentHp.host,
    guestHpAfter: transition.currentHp.guest,
    timeoutSides: usesLatestSelection(battle)
      ? ["host", "guest"].filter((role) => roundSecret[`${role}Submission`]?.source === "auto")
      : transition.timeoutSides,
    selectionSources: {
      host: roundSecret.hostSubmission?.source || (hostAction === "no_action" ? "auto" : "manual"),
      guest: roundSecret.guestSubmission?.source || (guestAction === "no_action" ? "auto" : "manual"),
    },
    resolutionType,
    resolvedAt: nowTimestamp,
    resultHash,
  };
  const finished = Boolean(transition.result);
  const nextRound = finished ? battle.round : battle.round + 1;
  const presentationWindowMs = Number(battle.rulesSnapshot.presentationWindowMs || 0);
  const presentationEndsAt = new Date(now.getTime() + presentationWindowMs);
  const nextBattle = {
    ...battle,
    status: finished ? "finished" : "selecting",
    round: nextRound,
    stateVersion: Number(battle.stateVersion) + 1,
    selectionOpensAt: finished ? null : presentationEndsAt,
    presentationEndsAt,
    deadlineAt: finished ? null : new Date(presentationEndsAt.getTime() + Number(battle.rulesSnapshot.selectionWindowMs)),
    currentHp: transition.currentHp,
    timeoutStreaks: transition.timeoutStreaks,
    resolvedRounds: [...(battle.resolvedRounds || []), resolvedRound],
    result: transition.result,
    updatedAt: nowTimestamp,
    finishedAt: finished ? nowTimestamp : null,
  };
  const nextRoundSecrets = {
    ...(secret.roundSecrets || {}),
    [key]: { ...roundSecret, resolved: true, resolvedAt: nowTimestamp, resolutionType, resultHash },
  };
  if (!finished) nextRoundSecrets[String(nextRound)] = emptyRoundSecret();
  const nextSecret = { ...secret, secretVersion: Number(secret.secretVersion) + 1, roundSecrets: nextRoundSecrets, updatedAt: nowTimestamp };
  return { battle: nextBattle, secret: nextSecret, resolvedRound, alreadyResolved: false };
}

async function commandRealtimeRound({ uid, battleId, command, input = {}, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const now = deps.now || new Date();
  return getRunner(db, deps)(async (transaction) => {
    const publicRef = db.doc(`realtimeArenaBattles/${battleId}`);
    const secretRef = db.doc(`realtimeArenaBattleSecrets/${battleId}`);
    const [publicSnapshot, secretSnapshot] = await transaction.getAll(publicRef, secretRef);
    if (!publicSnapshot.exists || !secretSnapshot.exists) throw new ArenaError("ARENA_REALTIME_BATTLE_NOT_FOUND", "실시간 배틀 방을 찾을 수 없습니다.");
    let battle = publicSnapshot.data();
    let secret = secretSnapshot.data();
    const role = assertParticipant(battle, uid);

    if (["finished", "cancelled", "expired"].includes(battle.status)) {
      const requestedRound = Number(input.round);
      const resolvedRound = (battle.resolvedRounds || []).find((item) => item.round === requestedRound) ||
        (command === "resolve-timeout" ? (battle.resolvedRounds || []).at(-1) || null : null);
      return { battle, secret, role, status: "replayed", resolvedRound, wrotePublic: false, wroteSecret: false };
    }
    if (toMillis(battle.expiresAt) <= now.getTime()) {
      battle = { ...battle, status: "expired", deadlineAt: null, stateVersion: Number(battle.stateVersion) + 1, updatedAt: new Date(now.getTime()), finishedAt: new Date(now.getTime()) };
      transaction.set(publicRef, battle);
      return { battle, secret, role, status: "resolved", resolvedRound: null, wrotePublic: true, wroteSecret: false };
    }
    if (battle.status === "waiting" && command === "restore") {
      return { battle, secret, role, status: "accepted", resolvedRound: null, wrotePublic: false, wroteSecret: false };
    }
    if (battle.status !== "selecting") throw new ArenaError("ARENA_REALTIME_STATE_CONFLICT", "진행 중인 실시간 배틀에서만 사용할 수 있는 명령입니다.");
    assertRulesInvariant(battle, secret);

    if (command === "resolve-timeout" && input.round !== undefined) {
      const requestedRound = Number(input.round);
      if (!Number.isInteger(requestedRound) || requestedRound < 1) {
        throw new ArenaError("ARENA_INVALID_REQUEST", "round 값이 올바르지 않습니다.");
      }
      if (requestedRound < battle.round) {
        const stored = (battle.resolvedRounds || []).find((item) => item.round === requestedRound);
        if (stored) return { battle, secret, role, status: "replayed", resolvedRound: stored, wrotePublic: false, wroteSecret: false };
      }
      if (requestedRound !== battle.round) {
        throw new ArenaError("ARENA_REALTIME_STATE_CONFLICT", "현재 라운드와 요청 라운드가 다릅니다.");
      }
    }

    const deadlinePassed = toMillis(battle.deadlineAt) <= now.getTime();
    if (deadlinePassed) {
      const key = String(battle.round);
      let roundSecret = secret.roundSecrets?.[key] || emptyRoundSecret();
      roundSecret = withCpuSubmission({ battle, secret, roundSecret, now });
      roundSecret = withFallbackSubmissions({ battle, secret, roundSecret, now });
      secret = {
        ...secret,
        roundSecrets: { ...(secret.roundSecrets || {}), [key]: roundSecret },
      };
      const timeoutResolution = resolveStoredRound({ battle, secret, resolutionType: usesLatestSelection(battle) ? "deadline" : "timeout", now });
      battle = timeoutResolution.battle;
      secret = timeoutResolution.secret;
      transaction.set(publicRef, battle);
      transaction.set(secretRef, secret);
      return { battle, secret, role, status: "resolved", resolvedRound: timeoutResolution.resolvedRound, wrotePublic: true, wroteSecret: true };
    }

    if (command === "restore") return { battle, secret, role, status: "accepted", resolvedRound: null, wrotePublic: false, wroteSecret: false };
    if (command === "resolve-timeout") throw new ArenaError("ARENA_REALTIME_TIMEOUT_NOT_REACHED", "아직 행동 선택 시간이 남아 있습니다.");
    if (command === "forfeit") {
      const nowTimestamp = new Date(now.getTime());
      battle = {
        ...battle,
        status: "finished",
        stateVersion: Number(battle.stateVersion) + 1,
        deadlineAt: null,
        result: { outcome: role === "host" ? "guest_win" : "host_win", reason: "forfeit" },
        updatedAt: nowTimestamp,
        finishedAt: nowTimestamp,
      };
      transaction.set(publicRef, battle);
      return { battle, secret, role, status: "resolved", resolvedRound: null, wrotePublic: true, wroteSecret: false };
    }
    if (command !== "submit-action") throw new ArenaError("ARENA_INVALID_REQUEST", "지원하지 않는 전투 명령입니다.");
    if (battle.selectionOpensAt && toMillis(battle.selectionOpensAt) > now.getTime()) {
      throw new ArenaError("ARENA_REALTIME_STATE_CONFLICT", "라운드 판정 연출이 끝난 뒤 행동을 선택해 주세요.");
    }

    const requestedRound = Number(input.round);
    if (!Number.isInteger(requestedRound) || requestedRound !== battle.round) {
      const stored = (battle.resolvedRounds || []).find((item) => item.round === requestedRound);
      if (stored) return { battle, secret, role, status: "replayed", resolvedRound: stored, wrotePublic: false, wroteSecret: false };
      throw new ArenaError("ARENA_REALTIME_STATE_CONFLICT", "현재 라운드와 요청 라운드가 다릅니다.");
    }
    if (!Number.isInteger(Number(input.expectedStateVersion))) throw new ArenaError("ARENA_INVALID_REQUEST", "expectedStateVersion 값이 올바르지 않습니다.");
    assertExpectedState(battle, input);
    if (!["attack", "guard", "special_attack"].includes(input.action)) throw new ArenaError("ARENA_INVALID_REQUEST", "행동 값이 올바르지 않습니다.");
    const requestId = normalizeRequestId(input.requestId);
    const latestSelection = usesLatestSelection(battle);
    const selectionRevision = latestSelection ? Number(input.selectionRevision) : 1;
    if (latestSelection && (!Number.isInteger(selectionRevision) || selectionRevision < 1)) {
      throw new ArenaError("ARENA_INVALID_REQUEST", "selectionRevision 값이 올바르지 않습니다.");
    }
    const requestHash = createRequestHash({
      command,
      battleId,
      round: requestedRound,
      expectedStateVersion: Number(input.expectedStateVersion),
      action: input.action,
      ...(latestSelection ? { selectionRevision } : {}),
    });
    const key = String(battle.round);
    const roundSecret = secret.roundSecrets?.[key] || emptyRoundSecret();
    const submissionKey = `${role}Submission`;
    const previous = roundSecret[submissionKey];
    if (previous) {
      if (!latestSelection) {
        if (previous.action !== input.action || (previous.requestId === requestId && previous.requestHash !== requestHash)) {
          throw new ArenaError("ARENA_REALTIME_ACTION_MISMATCH", "이미 제출한 라운드 행동은 변경할 수 없습니다.");
        }
        return { battle, secret, role, status: "replayed", resolvedRound: null, wrotePublic: false, wroteSecret: false };
      }
      const previousRevision = Number(previous.selectionRevision || 0);
      if (selectionRevision < previousRevision) {
        return { battle, secret, role, status: "stale", resolvedRound: null, wrotePublic: false, wroteSecret: false };
      }
      if (selectionRevision === previousRevision) {
        if (previous.requestHash !== requestHash || previous.action !== input.action) {
          throw new ArenaError("ARENA_REALTIME_ACTION_MISMATCH", "같은 선택 revision을 다른 행동에 사용할 수 없습니다.");
        }
        return { battle, secret, role, status: "replayed", resolvedRound: null, wrotePublic: false, wroteSecret: false };
      }
    }
    let nextRoundSecret = {
      ...roundSecret,
      [submissionKey]: {
        action: input.action,
        source: "manual",
        selectionRevision,
        requestId,
        requestHash,
        submittedAt: new Date(now.getTime()),
      },
    };
    secret = {
      ...secret,
      secretVersion: Number(secret.secretVersion) + 1,
      roundSecrets: { ...(secret.roundSecrets || {}), [key]: nextRoundSecret },
      updatedAt: new Date(now.getTime()),
    };
    if (latestSelection) {
      transaction.set(secretRef, secret);
      return { battle, secret, role, status: "accepted", resolvedRound: null, wrotePublic: false, wroteSecret: true };
    }
    nextRoundSecret = withCpuSubmission({ battle, secret, roundSecret: nextRoundSecret, now });
    secret = {
      ...secret,
      roundSecrets: { ...(secret.roundSecrets || {}), [key]: nextRoundSecret },
    };
    const opponentKey = `${role === "host" ? "guest" : "host"}Submission`;
    if (!nextRoundSecret[opponentKey]) {
      transaction.set(secretRef, secret);
      return { battle, secret, role, status: "accepted", resolvedRound: null, wrotePublic: false, wroteSecret: true };
    }
    const resolution = resolveStoredRound({ battle, secret, resolutionType: isCpuBattle(battle) ? "cpu_submitted" : "both_submitted", now });
    transaction.set(publicRef, resolution.battle);
    transaction.set(secretRef, resolution.secret);
    return { battle: resolution.battle, secret: resolution.secret, role, status: "resolved", resolvedRound: resolution.resolvedRound, wrotePublic: true, wroteSecret: true };
  });
}

module.exports = { commandRealtimeRound, resolveStoredRound, viewerFor };

export const STATS_POPUP_COMMAND_SCHEMA_VERSION = 1;

export const STATS_POPUP_COMMAND_TYPE = {
  SET_STAT: "setStat",
  SET_POOP_COUNT: "setPoopCount",
  SET_INJURY_STATE: "setInjuryState",
  SET_NOCTURNAL: "setNocturnal",
};

const POOP_FIELDS = ["poopCount", "poopReachedMaxAt", "lastPoopPenaltyAt"];
const INJURY_FIELDS = ["isInjured", "injuredAt", "healedDosesCurrent"];

export function buildStatsPopupCommandIntent({ field, value, occurredAt = Date.now() }) {
  let type = STATS_POPUP_COMMAND_TYPE.SET_STAT;
  if (field === "poopCount") type = STATS_POPUP_COMMAND_TYPE.SET_POOP_COUNT;
  if (field === "isInjured") type = STATS_POPUP_COMMAND_TYPE.SET_INJURY_STATE;
  if (field === "isNocturnal") type = STATS_POPUP_COMMAND_TYPE.SET_NOCTURNAL;
  return {
    schemaVersion: STATS_POPUP_COMMAND_SCHEMA_VERSION,
    type,
    field,
    value,
    occurredAt,
  };
}

export function getStatsPopupCommandPrimaryField(command = {}) {
  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_POOP_COUNT) return "poopCount";
  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_INJURY_STATE) return "isInjured";
  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_NOCTURNAL) return "isNocturnal";
  return command.field || null;
}

export function getStatsPopupCommandAffectedFields(command = {}) {
  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_POOP_COUNT) return POOP_FIELDS;
  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_INJURY_STATE) return INJURY_FIELDS;
  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_NOCTURNAL) return ["isNocturnal"];
  const field = getStatsPopupCommandPrimaryField(command);
  return field ? [field] : [];
}

export function applyStatsPopupCommand(stats = {}, command = {}) {
  const occurredAt = Number(command.occurredAt);
  const eventTime = Number.isFinite(occurredAt) ? occurredAt : Date.now();
  const field = getStatsPopupCommandPrimaryField(command);
  if (!field) return { ...stats };

  const nextStats = { ...stats, [field]: command.value };
  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_POOP_COUNT) {
    const previousPoopCount = Number(stats.poopCount) || 0;
    const nextPoopCount = Number(command.value) || 0;
    nextStats.poopCount = nextPoopCount;
    if (previousPoopCount < 8 && nextPoopCount >= 8 && !stats.poopReachedMaxAt) {
      nextStats.poopReachedMaxAt = eventTime;
      nextStats.lastPoopPenaltyAt = eventTime;
    } else if (nextPoopCount < 8) {
      nextStats.poopReachedMaxAt = null;
      nextStats.lastPoopPenaltyAt = null;
    }
  }

  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_INJURY_STATE) {
    const isInjured = Boolean(command.value);
    nextStats.isInjured = isInjured;
    if (isInjured && !stats.injuredAt) nextStats.injuredAt = eventTime;
    if (!isInjured) {
      nextStats.injuredAt = null;
      nextStats.healedDosesCurrent = 0;
    }
  }

  if (command.type === STATS_POPUP_COMMAND_TYPE.SET_NOCTURNAL) {
    nextStats.isNocturnal = Boolean(command.value);
  }
  return nextStats;
}

export function buildStatsPopupCommandPatch(beforeStats, afterStats, command) {
  return getStatsPopupCommandAffectedFields(command).reduce((patch, field) => {
    if (!Object.is(beforeStats?.[field], afterStats?.[field])) {
      patch[field] = afterStats?.[field];
    }
    return patch;
  }, {});
}

export function reconcileLegacySaveWithCommands({
  latestStats = {},
  requestedStats = {},
  invocationStats = {},
  legacySequence = 0,
  commandEntries = [],
} = {}) {
  const priorCommands = commandEntries
    .filter((entry) => Number(entry.sequence) < Number(legacySequence))
    .sort((left, right) => left.sequence - right.sequence);
  if (priorCommands.length === 0) {
    return { stats: requestedStats, supersededFields: [] };
  }

  const requestedPatch = Object.keys(requestedStats).reduce((patch, field) => {
    if (!Object.is(requestedStats[field], invocationStats?.[field])) {
      patch[field] = requestedStats[field];
    }
    return patch;
  }, {});
  const stats = { ...latestStats, ...requestedPatch };
  const supersededFields = [];

  priorCommands.forEach((entry) => {
    const primaryField = getStatsPopupCommandPrimaryField(entry.command);
    if (!primaryField) return;
    const legacyChangedField = !Object.is(
      requestedStats?.[primaryField],
      invocationStats?.[primaryField]
    );
    if (legacyChangedField) {
      supersededFields.push(primaryField);
      return;
    }
    Object.assign(stats, entry.patch || {});
  });

  return { stats, supersededFields };
}

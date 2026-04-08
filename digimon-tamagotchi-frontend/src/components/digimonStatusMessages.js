import { willRefuseMeat } from "../logic/food/meat";
import { willRefuseProtein } from "../logic/food/protein";
import { getTimeUntilSleep } from "../utils/sleepUtils";
import { normalizeSleepStatusForDisplay } from "../utils/callStatusUtils";

export const DIGIMON_STATUS_CATEGORY_ORDER = [
  "critical",
  "warning",
  "action",
  "info",
  "good",
];

export const DIGIMON_STATUS_CATEGORY_META = {
  critical: {
    title: "지금 바로 확인",
    description: "바로 대응하지 않으면 손해가 커질 수 있는 상태예요.",
    containerClass: "border-red-200 bg-red-50",
    titleClass: "text-red-700",
  },
  warning: {
    title: "곧 대응 필요",
    description: "잠시 뒤 더 큰 문제로 이어질 수 있는 경고예요.",
    containerClass: "border-orange-200 bg-orange-50",
    titleClass: "text-orange-700",
  },
  action: {
    title: "지금 하고 있는 행동",
    description: "현재 진행 중인 행동이나 즉시 반응 중인 상태예요.",
    containerClass: "border-blue-200 bg-blue-50",
    titleClass: "text-blue-700",
  },
  info: {
    title: "상태 정보",
    description: "생활 리듬이나 현재 상황을 이해하는 데 도움이 되는 정보예요.",
    containerClass: "border-slate-200 bg-slate-50",
    titleClass: "text-slate-700",
  },
  good: {
    title: "안정적인 상태",
    description: "지금은 큰 문제 없이 잘 지내고 있는 상태예요.",
    containerClass: "border-emerald-200 bg-emerald-50",
    titleClass: "text-emerald-700",
  },
};

const SUMMARY_BLOCKING_CATEGORIES = new Set(["critical", "warning"]);

const DEATH_REASON_LABELS = {
  "STARVATION (굶주림)": "굶주림",
  "EXHAUSTION (힘 소진)": "힘 소진",
  "INJURY OVERLOAD (부상 과다: 15회)": "부상 과다",
  "INJURY NEGLECT (부상 방치: 6시간)": "부상 방치",
  "OLD AGE (수명 다함)": "수명 종료",
};

function toTimestamp(value) {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function formatShortDuration(diffMs) {
  const safeMs = Math.max(0, diffMs);
  const hours = Math.floor(safeMs / (60 * 60 * 1000));
  const minutes = Math.floor((safeMs % (60 * 60 * 1000)) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  }

  return `${seconds}초`;
}

function createStatusMessage(overrides) {
  return {
    summaryEligible: true,
    detailHint: "",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
    category: "info",
    priority: 999,
    ...overrides,
  };
}

function getProteinOverdoseTone(proteinOverdose) {
  if (proteinOverdose >= 6) {
    return {
      color: "text-red-600",
      bgColor: "bg-red-100",
    };
  }

  if (proteinOverdose >= 4) {
    return {
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    };
  }

  return {
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  };
}

export function buildDigimonStatusMessages({
  digimonStats = {},
  sleepStatus = "AWAKE",
  isDead = false,
  currentAnimation = "idle",
  feedType = null,
  canEvolve = false,
  sleepSchedule = null,
  wakeUntil = null,
  sleepLightOnStart = null,
  deathReason = null,
  currentTime = Date.now(),
} = {}) {
  const {
    fullness = 0,
    strength = 0,
    poopCount = 0,
    injuries = 0,
    proteinOverdose = 0,
    callStatus = {},
    napUntil = null,
    isNocturnal = false,
    isFrozen = false,
    isInjured = false,
    injuryReason = null,
  } = digimonStats;

  const messages = [];
  const now = toTimestamp(currentTime) ?? Date.now();
  const wakeUntilTs = toTimestamp(wakeUntil);
  const sleepLightOnStartTs = toTimestamp(sleepLightOnStart);
  const napUntilTs = toTimestamp(napUntil);
  const sleepState = normalizeSleepStatusForDisplay(sleepStatus);
  const hasWakeWindow = !isFrozen && wakeUntilTs != null && now < wakeUntilTs;
  const meatRefused = willRefuseMeat(digimonStats);
  const proteinRefused = willRefuseProtein(digimonStats);
  const hasHungerCall = Boolean(callStatus.hunger?.isActive);
  const hasStrengthCall = Boolean(callStatus.strength?.isActive);
  const hasSleepCall = Boolean(callStatus.sleep?.isActive);

  if (isDead) {
    const deathLabel = DEATH_REASON_LABELS[deathReason] || deathReason;
    messages.push(
      createStatusMessage({
        id: "death",
        text: deathLabel ? `사망: ${deathLabel} 💀` : "사망 💀",
        color: "text-red-700",
        bgColor: "bg-red-200",
        category: "critical",
        priority: 10,
        detailHint: "사망 원인을 확인한 뒤 새 디지타마로 다시 시작할 수 있어요.",
      })
    );
  }

  if (isInjured) {
    const injuryLabel =
      injuryReason === "poop"
        ? "똥 과다 부상"
        : injuryReason === "battle"
          ? "배틀 부상"
          : "부상";

    messages.push(
      createStatusMessage({
        id: "injury",
        text: `치료 필요: ${injuryLabel} 🏥`,
        color: "text-red-600",
        bgColor: "bg-red-100",
        category: "critical",
        priority: 20,
        detailHint: "치료 메뉴로 회복시켜 주면 현재 부상 상태를 해제할 수 있어요.",
      })
    );
  } else if (injuries > 0) {
    messages.push(
      createStatusMessage({
        id: "injury-history",
        text: `부상 누적 ${injuries}회`,
        color: "text-amber-700",
        bgColor: "bg-amber-100",
        category: "info",
        priority: 81,
        summaryEligible: false,
        detailHint: "현재는 다친 상태가 아니지만, 이번 진화 구간의 누적 부상 기록은 계속 남아 있어요.",
      })
    );
  }

  if (poopCount >= 8) {
    messages.push(
      createStatusMessage({
        id: "poop-danger-max",
        text: "똥 8개 위험 💩",
        color: "text-red-600",
        bgColor: "bg-red-100",
        category: "critical",
        priority: 25,
        detailHint: "지금 바로 청소하지 않으면 부상 판정으로 이어질 수 있어요.",
      })
    );
  } else if (poopCount >= 6) {
    messages.push(
      createStatusMessage({
        id: "poop-danger-high",
        text: "똥 많음 💩",
        color: "text-orange-600",
        bgColor: "bg-orange-100",
        category: "warning",
        priority: 26,
        detailHint: "똥이 많이 쌓였어요. 여유 있을 때 바로 치워 주세요.",
      })
    );
  }

  if (hasHungerCall) {
    messages.push(
      createStatusMessage({
        id: "call-hunger",
        text: "배고픔 호출 🍖",
        color: "text-red-600",
        bgColor: "bg-red-100",
        category: "critical",
        priority: 30,
        detailHint: "고기를 줘서 배고픔 호출을 해제해 주세요.",
      })
    );
  }

  if (hasStrengthCall) {
    messages.push(
      createStatusMessage({
        id: "call-strength",
        text: "힘 호출 💪",
        color: "text-red-600",
        bgColor: "bg-red-100",
        category: "critical",
        priority: 31,
        detailHint: "기력을 회복시켜 힘 호출을 해제해 주세요.",
      })
    );
  }

  if (hasWakeWindow) {
    messages.push(
      createStatusMessage({
        id: "sleep-disturbance",
        text: `수면 방해: ${formatShortDuration(wakeUntilTs - now)} 더 깨어 있음 😵`,
        color: "text-orange-600",
        bgColor: "bg-orange-100",
        category: "warning",
        priority: 32,
        detailHint: "강제로 깨어 있는 동안은 다시 재우기 전까지 수면 리듬이 밀릴 수 있어요.",
      })
    );
  }

  if (!isFrozen && sleepState === "FALLING_ASLEEP") {
    messages.push(
      createStatusMessage({
        id: "sleep-falling-asleep",
        text: "잠들기 준비 중... 🌙",
        color: "text-slate-600",
        bgColor: "bg-slate-100",
        category: "info",
        priority: 33,
        detailHint: "불을 끈 뒤 15초가 지나면 실제 수면 상태로 전환돼요.",
      })
    );
  } else if (!isFrozen && sleepState === "NAPPING") {
    const napCountdownText =
      napUntilTs != null && now < napUntilTs
        ? `${formatShortDuration(napUntilTs - now)} 뒤에 다시 깨어나요.`
        : "낮잠 종료가 가까워요.";

    messages.push(
      createStatusMessage({
        id: "sleep-napping",
        text: "낮잠 중 😴",
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        category: "info",
        priority: 33,
        detailHint: napCountdownText,
      })
    );
  } else if (!isFrozen && sleepState === "SLEEPING_LIGHT_ON") {
    const elapsedMs = sleepLightOnStartTs == null ? 0 : now - sleepLightOnStartTs;
    const remainingMs = 30 * 60 * 1000 - elapsedMs;
    const countdownText =
      sleepLightOnStartTs == null
        ? "불을 끄면 경고가 시작돼요."
        : remainingMs > 0
          ? `케어 미스까지 ${formatShortDuration(remainingMs)}`
          : "케어 미스 발생 구간";

    messages.push(
      createStatusMessage({
        id: "sleep-light-on",
        text: "수면 중(불 켜짐 경고!) 😴",
        color: remainingMs > 0 ? "text-orange-600" : "text-red-600",
        bgColor: remainingMs > 0 ? "bg-orange-100" : "bg-red-100",
        category: "warning",
        priority: 33,
        detailHint: countdownText,
      })
    );
  } else if (!isFrozen && sleepState === "AWAKE_INTERRUPTED") {
    const remainingText =
      wakeUntilTs != null && now < wakeUntilTs
        ? `강제 기상 종료까지 ${formatShortDuration(wakeUntilTs - now)}`
        : "강제 기상 상태예요.";

    messages.push(
      createStatusMessage({
        id: "sleep-awake-interrupted",
        text: "강제 기상 중 ⏰",
        color: "text-orange-600",
        bgColor: "bg-orange-100",
        category: "warning",
        priority: 33,
        detailHint: remainingText,
      })
    );
  } else if (!isFrozen && sleepState === "SLEEPING") {
    if (napUntilTs != null && now < napUntilTs) {
      messages.push(
        createStatusMessage({
          id: "sleeping-nap",
          text: "낮잠 중 😴",
          color: "text-blue-600",
          bgColor: "bg-blue-100",
          category: "info",
          priority: 34,
          detailHint: `${formatShortDuration(napUntilTs - now)} 뒤에 다시 깨어나요.`,
        })
      );
    } else {
      messages.push(
        createStatusMessage({
          id: "sleeping",
          text: "수면 중 😴",
          color: "text-blue-600",
          bgColor: "bg-blue-100",
          category: "info",
          priority: 34,
          detailHint: "지금은 쉬는 시간이라 깨우면 수면 방해로 집계될 수 있어요.",
        })
      );
    }
  } else if (!isFrozen && hasSleepCall) {
    messages.push(
      createStatusMessage({
        id: "call-sleep",
        text: "수면 조명 경고 😴",
        color: "text-orange-600",
        bgColor: "bg-orange-100",
        category: "warning",
        priority: 34,
        detailHint: "잠들었는데 불이 켜져 있어요. 조명을 정리해 주세요.",
      })
    );
  }

  if (currentAnimation === "eat") {
    const feedEmoji = feedType === "protein" ? "💪" : "🍖";
    const feedLabel = feedType === "protein" ? "단백질 먹는 중" : "고기 먹는 중";

    messages.push(
      createStatusMessage({
        id: "action-eat",
        text: `${feedLabel} ${feedEmoji}`,
        color: feedType === "protein" ? "text-sky-700" : "text-orange-600",
        bgColor: feedType === "protein" ? "bg-sky-100" : "bg-orange-100",
        category: "action",
        priority: 40,
        detailHint: "지금은 먹는 애니메이션이 진행 중이라 곧 상태가 갱신돼요.",
      })
    );
  }

  if (meatRefused) {
    messages.push(
      createStatusMessage({
        id: "refuse-meat",
        text: "고기를 더 못 먹어요 🍖",
        color: "text-red-600",
        bgColor: "bg-red-100",
        category: "warning",
        priority: 50,
        detailHint: "과식 한계에 도달했어요. 시간을 두고 다시 먹여 주세요.",
      })
    );
  }

  if (proteinRefused) {
    messages.push(
      createStatusMessage({
        id: "refuse-protein",
        text: "단백질을 더 못 먹어요 💉",
        color: "text-red-600",
        bgColor: "bg-red-100",
        category: "warning",
        priority: 51,
        detailHint: "단백질 과다 복용 상태예요. 당분간 단백질은 쉬어 주세요.",
      })
    );
  }

  if (fullness > 5 && !meatRefused) {
    messages.push(
      createStatusMessage({
        id: "overfeed",
        text: "과식 상태 🍖",
        color: "text-orange-600",
        bgColor: "bg-orange-100",
        category: "warning",
        priority: 52,
        detailHint: "배는 가득 찼어요. 더 먹이면 오버피드 위험이 커져요.",
      })
    );
  }

  if (proteinOverdose > 0 && !proteinRefused) {
    const proteinTone = getProteinOverdoseTone(proteinOverdose);
    messages.push(
      createStatusMessage({
        id: "protein-overdose",
        text: `단백질 과다 ${proteinOverdose}단계 💉`,
        ...proteinTone,
        category: "warning",
        priority: 53,
        detailHint: "과다 복용 수치가 높을수록 거부 상태에 가까워져요.",
      })
    );
  }

  if (!hasHungerCall) {
    if (fullness === 0) {
      messages.push(
        createStatusMessage({
          id: "hunger-zero",
          text: "배고픔 0 🍖",
          color: "text-orange-600",
          bgColor: "bg-orange-100",
          category: "warning",
          priority: 60,
          detailHint: "조금 더 방치하면 배고픔 호출이 켜질 수 있어요.",
        })
      );
    } else if (fullness <= 1) {
      messages.push(
        createStatusMessage({
          id: "hunger-low",
          text: "배고픔 낮음 🍖",
          color: "text-yellow-700",
          bgColor: "bg-yellow-100",
          category: "warning",
          priority: 62,
          detailHint: "곧 배고픔 호출로 이어질 수 있으니 여유 있을 때 챙겨 주세요.",
        })
      );
    }
  }

  if (!hasStrengthCall) {
    if (strength === 0) {
      messages.push(
        createStatusMessage({
          id: "strength-zero",
          text: "힘 0 💪",
          color: "text-orange-600",
          bgColor: "bg-orange-100",
          category: "warning",
          priority: 61,
          detailHint: "기력이 바닥났어요. 회복시켜 두면 이후 호출을 줄일 수 있어요.",
        })
      );
    } else if (strength <= 1) {
      messages.push(
        createStatusMessage({
          id: "strength-low",
          text: "힘 낮음 💪",
          color: "text-yellow-700",
          bgColor: "bg-yellow-100",
          category: "warning",
          priority: 63,
          detailHint: "조금 더 지나면 힘 호출로 바뀔 수 있어요.",
        })
      );
    }
  }

  if (isFrozen && !isDead) {
    messages.push(
      createStatusMessage({
        id: "frozen",
        text: "냉장고 보관 중 🧊",
        color: "text-sky-700",
        bgColor: "bg-sky-100",
        category: "info",
        priority: 70,
        detailHint: "냉장고 보관 중에는 수면과 일부 시간 경과가 멈춰요.",
      })
    );
  }

  if (canEvolve && !isDead) {
    messages.push(
      createStatusMessage({
        id: "can-evolve",
        text: "진화 가능 ✨",
        color: "text-violet-700",
        bgColor: "bg-violet-100",
        category: "good",
        priority: 73,
        detailHint: "조건이 맞으면 진화 버튼으로 다음 단계로 갈 수 있어요.",
      })
    );
  }

  if (!isFrozen && sleepStatus === "AWAKE" && !hasWakeWindow && sleepSchedule) {
    messages.push(
      createStatusMessage({
        id: "time-until-sleep",
        text: `수면까지 ${getTimeUntilSleep(sleepSchedule, new Date(now))} 😴`,
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        category: "info",
        priority: 74,
        detailHint: "지금은 생활 리듬 안내예요. 급한 경고가 있으면 상단 요약에서는 뒤로 밀려요.",
      })
    );
  }

  if (isNocturnal) {
    messages.push(
      createStatusMessage({
        id: "nocturnal",
        text: "야행성 모드 🌙",
        color: "text-indigo-700",
        bgColor: "bg-indigo-100",
        category: "info",
        priority: 80,
        summaryEligible: false,
        detailHint: "수면과 기상 시간이 일반 개체보다 늦게 적용되고 있어요.",
      })
    );
  }

  if (!isDead) {
    if (fullness >= 5 && strength >= 5) {
      messages.push(
        createStatusMessage({
          id: "all-good",
          text: "컨디션 좋음 😊",
          color: "text-emerald-700",
          bgColor: "bg-emerald-100",
          category: "good",
          priority: 90,
          detailHint: "지금은 큰 문제 없이 안정적으로 잘 지내고 있어요.",
        })
      );
    } else if (fullness >= 5) {
      messages.push(
        createStatusMessage({
          id: "fullness-good",
          text: "배부름 😊",
          color: "text-emerald-700",
          bgColor: "bg-emerald-100",
          category: "good",
          priority: 91,
          detailHint: "배 상태는 아주 안정적이에요.",
        })
      );
    } else if (strength >= 5) {
      messages.push(
        createStatusMessage({
          id: "strength-good",
          text: "기력 충분 ⚡",
          color: "text-emerald-700",
          bgColor: "bg-emerald-100",
          category: "good",
          priority: 92,
          detailHint: "기력이 넉넉해서 당장 회복 걱정은 없어요.",
        })
      );
    }
  }

  return messages.sort((a, b) => a.priority - b.priority);
}

export function getSummaryDigimonStatusMessages(messages = [], maxVisible = 3) {
  const hasBlockingWarning = messages.some(
    (message) =>
      message.id !== "time-until-sleep" &&
      message.summaryEligible !== false &&
      SUMMARY_BLOCKING_CATEGORIES.has(message.category)
  );

  const summaryMessages = messages.filter((message) => {
    if (message.summaryEligible === false) {
      return false;
    }

    if (message.id === "time-until-sleep" && hasBlockingWarning) {
      return false;
    }

    return true;
  });

  if (summaryMessages.length === 0) {
    return messages.slice(0, maxVisible);
  }

  return summaryMessages.slice(0, maxVisible);
}

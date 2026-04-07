export const MENU_SURFACES = {
  PRIMARY: "primary",
  EXTRA: "extra",
};

export const MENU_SURFACE_GROUPS = {
  [MENU_SURFACES.PRIMARY]: [
    { id: "basic", label: "기본 조작", order: 1 },
    { id: "care", label: "케어·도구", order: 2 },
  ],
  [MENU_SURFACES.EXTRA]: [
    { id: "records", label: "기록", order: 1 },
    { id: "reference", label: "자료", order: 2 },
    { id: "storage", label: "보관/꾸미기", order: 3 },
    { id: "system", label: "시스템", order: 4 },
  ],
};

export const GAME_MENU_DEFINITIONS = [
  {
    id: "status",
    label: "상태",
    icon: "/images/190.png",
    group: "basic",
    order: 1,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "eat",
    label: "먹이",
    icon: "/images/192.png",
    group: "basic",
    order: 2,
    requiresLights: true,
    disabledWhenFrozen: true,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "train",
    label: "훈련",
    icon: "/images/194.png",
    group: "basic",
    order: 3,
    requiresLights: true,
    disabledWhenFrozen: true,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "battle",
    label: "배틀",
    icon: "/images/196.png",
    group: "basic",
    order: 4,
    requiresLights: true,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "communication",
    label: "교감",
    icon: "/images/502.png",
    group: "basic",
    order: 5,
    requiresLights: true,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "bathroom",
    label: "화장실",
    icon: "/images/198.png",
    group: "care",
    order: 6,
    requiresLights: true,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "electric",
    label: "조명",
    icon: "/images/200.png",
    group: "care",
    order: 7,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "heal",
    label: "치료",
    icon: "/images/202.png",
    group: "care",
    order: 8,
    requiresLights: true,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "callSign",
    label: "호출",
    icon: "/images/204.png",
    group: "care",
    order: 9,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "extra",
    label: "더보기",
    icon: "/images/556.png",
    group: "care",
    order: 10,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.PRIMARY,
  },
  {
    id: "activityLog",
    label: "활동 로그",
    icon: "📋",
    group: "records",
    order: 1,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.EXTRA,
  },
  {
    id: "battleLog",
    label: "배틀 기록",
    icon: "⚔️",
    group: "records",
    order: 2,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.EXTRA,
  },
  {
    id: "encyclopedia",
    label: "도감",
    icon: "📚",
    group: "reference",
    order: 1,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.EXTRA,
  },
  {
    id: "fridge",
    label: "냉장고",
    icon: "🧊",
    group: "storage",
    order: 1,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.EXTRA,
  },
  {
    id: "collection",
    label: "컬렉션",
    icon: "⭐",
    group: "storage",
    order: 2,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.EXTRA,
  },
  {
    id: "settings",
    label: "설정",
    icon: "⚙️",
    group: "system",
    order: 1,
    requiresLights: false,
    disabledWhenFrozen: false,
    surface: MENU_SURFACES.EXTRA,
  },
];

const DISABLED_COPY = {
  lights: "조명이 꺼져 있어 사용할 수 없어요. 먼저 조명을 켜주세요.",
  frozen: "냉장고 보관 중에는 사용할 수 없어요.",
};

const GROUP_MAP = Object.fromEntries(
  Object.entries(MENU_SURFACE_GROUPS).flatMap(([surface, groups]) =>
    groups.map((group) => [`${surface}:${group.id}`, group])
  )
);

const MENU_MAP = Object.fromEntries(GAME_MENU_DEFINITIONS.map((menu) => [menu.id, menu]));

function sortMenus(left, right) {
  return left.order - right.order;
}

function collectLabels(menus) {
  return menus.map((menu) => menu.label).join(", ");
}

export function getGameMenuById(menuId) {
  return MENU_MAP[menuId] || null;
}

export function getGameMenusBySurface(surface) {
  return GAME_MENU_DEFINITIONS.filter((menu) => menu.surface === surface).sort(sortMenus);
}

export function getGroupedGameMenus(surface) {
  const groups = MENU_SURFACE_GROUPS[surface] || [];

  return groups.map((group) => ({
    ...group,
    menus: GAME_MENU_DEFINITIONS.filter(
      (menu) => menu.surface === surface && menu.group === group.id
    ).sort(sortMenus),
  }));
}

export function getMenuDisabledState(menuId, context = {}) {
  const menu = getGameMenuById(menuId);

  if (!menu) {
    return { disabled: false, reasonKey: null, message: "" };
  }

  if (menu.disabledWhenFrozen && context.isFrozen) {
    return {
      disabled: true,
      reasonKey: "frozen",
      message: DISABLED_COPY.frozen,
    };
  }

  if (menu.requiresLights && context.isLightsOn === false) {
    return {
      disabled: true,
      reasonKey: "lights",
      message: DISABLED_COPY.lights,
    };
  }

  return { disabled: false, reasonKey: null, message: "" };
}

export function getMenuLockNotices(context = {}) {
  const notices = [];
  const primaryMenus = getGameMenusBySurface(MENU_SURFACES.PRIMARY);

  if (context.isLightsOn === false) {
    const lockedByLights = primaryMenus.filter((menu) => menu.requiresLights);
    notices.push({
      key: "lights",
      icon: "💡",
      title: "조명 잠금",
      message: `조명이 꺼져 있어 ${collectLabels(lockedByLights)} 메뉴가 잠겨 있어요. 조명을 켜면 다시 사용할 수 있어요.`,
    });
  }

  if (context.isFrozen) {
    const lockedByFrozen = primaryMenus.filter((menu) => menu.disabledWhenFrozen);
    notices.push({
      key: "frozen",
      icon: "🧊",
      title: "냉장고 잠금",
      message: `냉장고 보관 중이라 ${collectLabels(lockedByFrozen)} 메뉴를 사용할 수 없어요.`,
    });
  }

  return notices;
}

export function getMenuGroupLabel(surface, groupId) {
  return GROUP_MAP[`${surface}:${groupId}`]?.label || "";
}

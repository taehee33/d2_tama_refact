export const HEADER_APP_ICON_SRC = "/logo192_agumon.png";

const HOME_NAV_ITEM = { key: "home", to: "/", label: "홈", end: true };
const PLAY_NAV_ITEM = { key: "play", to: "/play", label: "플레이" };
const GUIDE_NAV_ITEM = { key: "guide", to: "/guide", label: "가이드" };
const COMMUNITY_NAV_ITEM = {
  key: "community",
  id: "community",
  to: "/community",
  label: "커뮤니티",
};
const NEWS_NAV_ITEM = { key: "news", to: "/news", label: "소식" };
const TAMER_NAV_ITEM = { key: "me", to: "/me", label: "테이머(설정)" };
const NOTEBOOK_NAV_ITEM = { key: "notebook", to: "/notebook", label: "노트북" };
const INTRO_NAV_ITEM = { key: "landing", to: "/landing", label: "소개", end: true };

export function getPrimaryHeaderNavItems({ includeTamer = false } = {}) {
  return [
    HOME_NAV_ITEM,
    PLAY_NAV_ITEM,
    GUIDE_NAV_ITEM,
    COMMUNITY_NAV_ITEM,
    NEWS_NAV_ITEM,
    ...(includeTamer ? [TAMER_NAV_ITEM] : []),
    NOTEBOOK_NAV_ITEM,
    INTRO_NAV_ITEM,
  ].map((item) => ({ ...item }));
}

export function getNotebookHeaderNavItems() {
  return [INTRO_NAV_ITEM, GUIDE_NAV_ITEM, COMMUNITY_NAV_ITEM, NEWS_NAV_ITEM].map(
    (item) => ({ ...item })
  );
}

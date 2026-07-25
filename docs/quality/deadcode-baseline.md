# Dead-code 기준선 (C2)

## 실행 환경과 범위

- 기준 SHA: `c495287a5966cb55ed1c1d99e0b76581981f987f`
- 측정 시각: 2026-07-25 12:36:35 KST
- Node.js: `v24.14.0`
- npm: `10.9.2`
- Knip: `6.29.0` (npm 조회 결과 Knip 6 최신, Node 요구사항 `^20.19.0 || >=22.12.0`)
- 구성된 project 패턴 대상: 루트 `scripts/**/*.js` + `tests/**/*.js` 45개, 프론트엔드 `src/**/*.{js,jsx}` + `api/**/*.{js,cjs}` + `scripts/**/*.js` 537개, 합계 582개
- strict 명령: `npm run deadcode`
- 보고서 명령: `npm run deadcode:report`

## 판정

strict 실행은 설정·파서·런타임 오류 없이 정상적인 후보 목록을 출력하고 종료 코드 1을 반환했다. 후보가 남아 있으므로 `deadcode`는 아직 `npm run check`에 포함하지 않고, `deadcode:report`만 비차단 기준선으로 제공한다. 이 문서의 후보는 삭제 승인이 아니라 후속 검토 대기열이다.

| 유형 | 건수 |
| --- | ---: |
| 미사용 파일 | 26 |
| 미사용 의존성 | 3 |
| 미선언 의존성 | 4 |
| 미사용 export | 244 |
| 중복 export | 19 |
| 설정 힌트 | 1 |
| 합계 | 297 |

분류 의미:

- **확정 부채:** 현재 선언 또는 중복 상태 자체가 정리 대상임이 명확하다. 이번 단계에서는 수정·삭제하지 않는다.
- **의도적 entry:** 배포·스크립트·테스트가 외부에서 직접 진입할 가능성이 확인된 항목이다.
- **동적 참조:** CommonJS export, 런타임 dispatch 또는 테스트 주입처럼 정적 그래프가 놓칠 가능성이 높은 항목이다.
- **generated:** 생성 파이프라인의 source/entry로 직접 import되지 않아도 보존해야 하는 항목이다.
- **설정 오탐:** workspace 경계나 CSS 추적 제한 때문에 현재 설정에서 발생한 항목이다.
- **판단 보류:** 실제 호출·테스트·배포 계약을 파일별로 확인하기 전에는 제거할 수 없다.

## 전체 후보

| # | 유형 | 위치 | 심볼/패키지 | 분류 |
| ---: | --- | --- | --- | --- |
| 1 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/digimonStages.js | - | 판단 보류 |
| 2 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/train_digitalmonstercolor25th_ver1.js | - | 판단 보류 |
| 3 | 미사용 파일 | digimon-tamagotchi-frontend/src/repositories/SlotRepository.js | - | 판단 보류 |
| 4 | 미사용 파일 | digimon-tamagotchi-frontend/src/server/gameProjectionEntry.js | - | generated |
| 5 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/AblyWrapper.jsx | - | 판단 보류 |
| 6 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/BackgroundSettings.jsx | - | 판단 보류 |
| 7 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/BasicSettings.jsx | - | 판단 보류 |
| 8 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/DigimonSelector.jsx | - | 판단 보류 |
| 9 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/DigimonStatusText.jsx | - | 판단 보류 |
| 10 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/EvolutionSelector.jsx | - | 판단 보류 |
| 11 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/ImageLoader.js | - | 판단 보류 |
| 12 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/SizeAdjuster.jsx | - | 판단 보류 |
| 13 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/TimeSettings.jsx | - | 판단 보류 |
| 14 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/nonuse/digimonData.js | - | 확정 부채 |
| 15 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/nonuse/digimondata_digitalmonstercolor25th_ver1.js | - | 확정 부채 |
| 16 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/nonuse/digimondata_digitalmonstercolor25th_ver2.js | - | 확정 부채 |
| 17 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/nonuse/evolutionConditions.js | - | 확정 부채 |
| 18 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/nonuse/evolution_digitalmonstercolor25th_ver1.js | - | 확정 부채 |
| 19 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/v1/evolution.js | - | 판단 보류 |
| 20 | 미사용 파일 | digimon-tamagotchi-frontend/src/data/v1/index.js | - | 판단 보류 |
| 21 | 미사용 파일 | digimon-tamagotchi-frontend/src/logic/battle/index.js | - | 판단 보류 |
| 22 | 미사용 파일 | digimon-tamagotchi-frontend/src/logic/evolution/index.js | - | 판단 보류 |
| 23 | 미사용 파일 | digimon-tamagotchi-frontend/src/logic/food/index.js | - | 판단 보류 |
| 24 | 미사용 파일 | digimon-tamagotchi-frontend/src/logic/stats/index.js | - | 판단 보류 |
| 25 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/home/LandingWindow.jsx | - | 판단 보류 |
| 26 | 미사용 파일 | digimon-tamagotchi-frontend/src/components/landing/EggScroll.jsx | - | 판단 보류 |
| 27 | 미사용 의존성 | package.json:42 | @supabase/supabase-js | 설정 오탐 |
| 28 | 미사용 의존성 | package.json:43 | @vercel/analytics | 설정 오탐 |
| 29 | 미사용 의존성 | digimon-tamagotchi-frontend/package.json:10 | @testing-library/user-event | 판단 보류 |
| 30 | 미선언 의존성 | scripts/backfillUserEncyclopedia.js:7 | @babel/core | 확정 부채 |
| 31 | 미선언 의존성 | scripts/backfillUserEncyclopedia.js:8 | babel-preset-react-app | 확정 부채 |
| 32 | 미선언 의존성 | digimon-tamagotchi-frontend/scripts/buildServerGameProjection.js:5 | webpack | 확정 부채 |
| 33 | 미선언 의존성 | digimon-tamagotchi-frontend/scripts/generate-icons.js:4 | sharp | 확정 부채 |
| 34 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:354 | areEntriesEquivalent | 판단 보류 |
| 35 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:355 | buildCanonicalEncyclopedia | 판단 보류 |
| 36 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:356 | countEncyclopediaEntries | 판단 보류 |
| 37 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:357 | countEntriesByVersion | 판단 보류 |
| 38 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:358 | createEmptyEncyclopedia | 판단 보류 |
| 39 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:359 | hasAnyEncyclopediaEntries | 판단 보류 |
| 40 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:360 | hasVersionEntries | 판단 보류 |
| 41 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:361 | inferEntryDiscovered | 판단 보류 |
| 42 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:362 | mergeEncyclopediaEntry | 판단 보류 |
| 43 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:363 | normalizeEncyclopedia | 판단 보류 |
| 44 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:364 | normalizeVersionEntries | 판단 보류 |
| 45 | 미사용 export | digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore.js:365 | toEpochMs | 판단 보류 |
| 46 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/operatorConfig.js:127 | getOperatorRoleDocumentPath | 동적 참조 |
| 47 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/operatorConfig.js:130 | normalizeOperatorRoleDocument | 동적 참조 |
| 48 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/firestoreAdmin.js:427 | getDocumentName | 동적 참조 |
| 49 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/notificationSubscribers.js:65 | USER_SETTINGS_PATH_PATTERN | 동적 참조 |
| 50 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaDomain.js:243 | RECORD_KEYS | 동적 참조 |
| 51 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaDomain.js:255 | normalizeRecordDelta | 동적 참조 |
| 52 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaDomain.js:258 | sha256Base64Url | 동적 참조 |
| 53 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/notificationReports.js:463 | buildDailyDigimonReportPayload | 동적 참조 |
| 54 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1765 | BOARD_ID | 동적 참조 |
| 55 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1769 | BOARD_ID_SHOWCASE | 동적 참조 |
| 56 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1770 | COMMENTS_TABLE | 동적 참조 |
| 57 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1771 | FREE_BOARD_CATEGORY_GENERAL | 동적 참조 |
| 58 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1772 | FREE_BOARD_CATEGORY_GUIDE | 동적 참조 |
| 59 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1773 | FREE_BOARD_CATEGORY_IDS | 동적 참조 |
| 60 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1774 | FREE_BOARD_CATEGORY_QUESTION | 동적 참조 |
| 61 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1775 | NEWS_BOARD_CATEGORY_EVENT | 동적 참조 |
| 62 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1776 | NEWS_BOARD_CATEGORY_IDS | 동적 참조 |
| 63 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1777 | NEWS_BOARD_CATEGORY_MAINTENANCE | 동적 참조 |
| 64 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1778 | NEWS_BOARD_CATEGORY_NOTICE | 동적 참조 |
| 65 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1780 | POSTS_TABLE | 동적 참조 |
| 66 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1782 | SUPPORT_BOARD_CATEGORY_IDS | 동적 참조 |
| 67 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1783 | SUPPORT_BOARD_CATEGORY_QUESTION | 동적 참조 |
| 68 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1784 | SUPPORT_BOARD_CATEGORY_SOLVED | 동적 참조 |
| 69 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1790 | createShowcaseComment | 동적 참조 |
| 70 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1791 | createShowcasePost | 동적 참조 |
| 71 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1794 | deleteShowcaseComment | 동적 참조 |
| 72 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1795 | deleteShowcasePost | 동적 참조 |
| 73 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1798 | getShowcasePostDetail | 동적 참조 |
| 74 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1799 | isNewsEditor | 동적 참조 |
| 75 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1801 | listShowcasePosts | 동적 참조 |
| 76 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1802 | mapCommentRow | 동적 참조 |
| 77 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1803 | mapPostRow | 동적 참조 |
| 78 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1805 | normalizeFreeBoardCategory | 동적 참조 |
| 79 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1806 | normalizeNewsBoardCategory | 동적 참조 |
| 80 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1807 | normalizeSupportBoardCategory | 동적 참조 |
| 81 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1809 | resolveAuthorNameFromDocuments | 동적 참조 |
| 82 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1815 | updateShowcaseComment | 동적 참조 |
| 83 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/community.js:1816 | updateShowcasePost | 동적 참조 |
| 84 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaBattleService.js:492 | MAX_BATTLE_BYTES | 동적 참조 |
| 85 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaBattleService.js:493 | MAX_REPLAY_BYTES | 동적 참조 |
| 86 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaGhostHandlers.js:602 | GHOST_LIMIT | 동적 참조 |
| 87 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaGhostHandlers.js:604 | buildOwnerGhostDto | 동적 참조 |
| 88 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaGhostHandlers.js:609 | listOpponentGhosts | 동적 참조 |
| 89 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaGhostHandlers.js:610 | listOwnerGhosts | 동적 참조 |
| 90 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:309 | ARCHIVE_LEASE_MS | 동적 참조 |
| 91 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:310 | ARCHIVE_MAX_ATTEMPTS | 동적 참조 |
| 92 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:311 | MIRROR_MAX_ATTEMPTS | 동적 참조 |
| 93 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:312 | MIRROR_PROJECTOR_REGISTRY | 동적 참조 |
| 94 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:313 | READY_CLEANUP_LIMIT | 동적 참조 |
| 95 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:314 | claimArchiveJob | 동적 참조 |
| 96 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:316 | finalizeArchiveJob | 동적 참조 |
| 97 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:317 | finalizeMirrorJob | 동적 참조 |
| 98 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobs.js:321 | writeArchiveInsertOnce | 동적 참조 |
| 99 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaTransactions.js:44 | getArenaAdminApp | 동적 참조 |
| 100 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/urgentCareNotifications.js:931 | buildDeliveryId | 동적 참조 |
| 101 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/urgentCareNotifications.js:939 | hasProjectionRuntime | 동적 참조 |
| 102 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/urgentCareNotifications.js:940 | listExpiredPendingUrgentDeliveries | 동적 참조 |
| 103 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/urgentCareNotifications.js:946 | saveUrgentCheckError | 동적 참조 |
| 104 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js:1019 | buildArchivedArenaEntry | 동적 참조 |
| 105 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js:1020 | buildArenaBattleArchiveInput | 동적 참조 |
| 106 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js:1028 | ensureSeasonConfigInput | 동적 참조 |
| 107 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js:1029 | normalizeArenaRecord | 동적 참조 |
| 108 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js:1030 | sortArenaEntries | 동적 참조 |
| 109 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:704 | ARCHIVE_MONITOR_OUTCOMES | 동적 참조 |
| 110 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:705 | ARCHIVE_MONITOR_SOURCES | 동적 참조 |
| 111 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:707 | buildArchiveMonitorEventRecord | 동적 참조 |
| 112 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:708 | classifyArchiveMonitorOutcome | 동적 참조 |
| 113 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:711 | createArchiveMonitorRequestId | 동적 참조 |
| 114 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:713 | fetchArchiveRowById | 동적 참조 |
| 115 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:715 | mapArchiveMonitorRow | 동적 참조 |
| 116 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:716 | normalizeMonitorHours | 동적 참조 |
| 117 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:717 | normalizeMonitorLimit | 동적 참조 |
| 118 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:718 | normalizeMonitorOutcome | 동적 참조 |
| 119 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:719 | normalizeMonitorSource | 동적 참조 |
| 120 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:720 | recordArchiveMonitorEventBestEffort | 동적 참조 |
| 121 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:721 | requireArchiveId | 동적 참조 |
| 122 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:722 | resolveArchiveErrorStatus | 동적 참조 |
| 123 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:723 | resolveSupabaseClient | 동적 참조 |
| 124 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js:724 | tryResolveSupabaseClient | 동적 참조 |
| 125 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchives.js:186 | normalizeOptionalBoolean | 동적 참조 |
| 126 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/logArchives.js:189 | normalizeString | 동적 참조 |
| 127 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/userNotifications.js:770 | buildNotificationId | 동적 참조 |
| 128 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/userNotifications.js:771 | buildProjectionSummary | 동적 참조 |
| 129 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/userNotifications.js:772 | buildUserNotification | 동적 참조 |
| 130 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/urgentCareProjection.js:435 | RECENTLY_EXPIRED_CALL_GRACE_MS | 동적 참조 |
| 131 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/urgentCareProjection.js:438 | isActiveScheduledSleepLightWarning | 동적 참조 |
| 132 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/urgentCareProjection.js:442 | resolveSleepLightIssueTiming | 동적 참조 |
| 133 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/ablyAuth.js:117 | ABLY_CHANNEL_NAME | 동적 참조 |
| 134 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/ablyAuth.js:120 | getFallbackClientId | 동적 참조 |
| 135 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/ablyAuth.js:121 | loadAblyClientId | 동적 참조 |
| 136 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaBattleHandlers.js:54 | normalizeBattleHandlerError | 동적 참조 |
| 137 | 미사용 export | digimon-tamagotchi-frontend/src/data/stats.js:345 | updateAge | 판단 보류 |
| 138 | 미사용 export | digimon-tamagotchi-frontend/src/data/stats.js:371 | updateAgeWithLazyUpdate | 판단 보류 |
| 139 | 미사용 export | digimon-tamagotchi-frontend/src/utils/activityLogEventId.js:24 | ensureActivityLogTimestampMs | 판단 보류 |
| 140 | 미사용 export | digimon-tamagotchi-frontend/src/utils/activityLogEventId.js:28 | isCareMistakeActivityType | 판단 보류 |
| 141 | 미사용 export | digimon-tamagotchi-frontend/src/utils/arenaApi.js:2 | ARENA_CLIENT_SCHEMA_VERSION | 판단 보류 |
| 142 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useArenaGhosts.js:10 | getArenaGhostErrorNotice | 판단 보류 |
| 143 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useArenaLogic.js:49 | createArenaBattleRequestId | 판단 보류 |
| 144 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js:543 | checkAndGrantEncyclopediaMasters | 판단 보류 |
| 145 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useGameData.js:150 | normalizeGameTimingFields | 판단 보류 |
| 146 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-persistence/useDurableGamePersistence.js:34 | GAME_SYNC_STATUS | 판단 보류 |
| 147 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-persistence/useDurableGamePersistence.js:42 | GAME_RECORD_SYNC_STATUS | 판단 보류 |
| 148 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-persistence/useDurableGamePersistence.js:57 | LOCAL_PERSISTENCE_STATUS | 판단 보류 |
| 149 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js:53 | buildToggledLightsStats | 판단 보류 |
| 150 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useGameLogic.js:74 | isSleepStatusInterrupted | 판단 보류 |
| 151 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useGameLogic.js:786 | default | 판단 보류 |
| 152 | 중복 export | digimon-tamagotchi-frontend/src/hooks/useGameLogic.js | getSleepStatus@402, default@786 | 확정 부채 |
| 153 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/usePwaInstallPrompt.js:3 | isPwaInstallActionable | 판단 보류 |
| 154 | 미사용 export | digimon-tamagotchi-frontend/src/persistence/gameRevision.js:24 | UNSAFE_REPLAY_TYPES | 판단 보류 |
| 155 | 미사용 export | digimon-tamagotchi-frontend/src/logic/arena/calculator.js:17 | createSeededRandom | 판단 보류 |
| 156 | 미사용 export | digimon-tamagotchi-frontend/src/utils/communityApi.js:90 | listShowcasePosts | 판단 보류 |
| 157 | 미사용 export | digimon-tamagotchi-frontend/src/utils/communityApi.js:95 | getShowcasePostDetail | 판단 보류 |
| 158 | 미사용 export | digimon-tamagotchi-frontend/src/utils/communityApi.js:103 | updateShowcasePost | 판단 보류 |
| 159 | 미사용 export | digimon-tamagotchi-frontend/src/utils/communityApi.js:107 | deleteShowcasePost | 판단 보류 |
| 160 | 미사용 export | digimon-tamagotchi-frontend/src/utils/communityApi.js:111 | createShowcaseComment | 판단 보류 |
| 161 | 미사용 export | digimon-tamagotchi-frontend/src/utils/communityApi.js:115 | updateShowcaseComment | 판단 보류 |
| 162 | 미사용 export | digimon-tamagotchi-frontend/src/utils/communityApi.js:119 | deleteShowcaseComment | 판단 보류 |
| 163 | 미사용 export | digimon-tamagotchi-frontend/src/utils/immersiveSettings.js:10 | isValidImmersiveLayoutMode | 판단 보류 |
| 164 | 미사용 export | digimon-tamagotchi-frontend/src/utils/immersiveSettings.js:14 | isValidImmersiveSkinId | 판단 보류 |
| 165 | 미사용 export | digimon-tamagotchi-frontend/src/utils/immersiveSettings.js:18 | isValidImmersiveLandscapeSide | 판단 보류 |
| 166 | 미사용 export | digimon-tamagotchi-frontend/src/utils/routeLayout.js:1 | isAuthRoute | 판단 보류 |
| 167 | 미사용 export | digimon-tamagotchi-frontend/src/utils/routeLayout.js:5 | isGameRoute | 판단 보류 |
| 168 | 미사용 export | digimon-tamagotchi-frontend/src/utils/routeLayout.js:9 | isImmersiveGameRoute | 판단 보류 |
| 169 | 미사용 export | digimon-tamagotchi-frontend/src/utils/slotStatusChips.js:36 | getProjectedSlotStats | 판단 보류 |
| 170 | 미사용 export | digimon-tamagotchi-frontend/src/utils/userProfileUtils.js:8 | USER_PROFILE_COLLECTION | 판단 보류 |
| 171 | 미사용 export | digimon-tamagotchi-frontend/src/utils/userProfileUtils.js:9 | USER_PROFILE_DOC_ID | 판단 보류 |
| 172 | 미사용 export | digimon-tamagotchi-frontend/src/utils/userProfileUtils.js:105 | getMaxSlots | 판단 보류 |
| 173 | 미사용 export | digimon-tamagotchi-frontend/src/utils/webPushClient.js:20 | isIOSDevice | 판단 보류 |
| 174 | 미사용 export | digimon-tamagotchi-frontend/src/utils/webPushClient.js:74 | getWebPushPublicKey | 판단 보류 |
| 175 | 미사용 export | digimon-tamagotchi-frontend/src/utils/webPushClient.js:78 | getExistingWebPushSubscription | 판단 보류 |
| 176 | 미사용 export | digimon-tamagotchi-frontend/src/utils/digimonVersionUtils.js:58 | STARTER_DIGIMON_IDS | 판단 보류 |
| 177 | 미사용 export | digimon-tamagotchi-frontend/src/utils/digimonVersionUtils.js:66 | getDigimonVersionConfig | 판단 보류 |
| 178 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-runtime/gamePageActionHelpers.js:12 | normalizeDigimonLookupId | 판단 보류 |
| 179 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-runtime/gameSyncSchedule.js:3 | GAME_STATE_SYNC_INTERVAL_MS | 판단 보류 |
| 180 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-runtime/gameSyncSchedule.js:4 | FEED_SUMMARY_BUCKET_MS | 판단 보류 |
| 181 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameOutboxSync.js:3 | GAME_OUTBOX_RETRY_DELAYS_MS | 판단 보류 |
| 182 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-runtime/useJogressSubscriptions.js:6 | extractJogressStatusFromSlotData | 판단 보류 |
| 183 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-runtime/useJogressSubscriptions.js:12 | resolveNextSlotJogressStatus | 판단 보류 |
| 184 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/game-runtime/useTakeOutCleanup.js:3 | getTakeOutRemainingMs | 판단 보류 |
| 185 | 미사용 export | digimon-tamagotchi-frontend/src/logic/arena/combatIdentity.js:1 | ARENA_IDENTITY_SCHEMA_VERSION | 판단 보류 |
| 186 | 미사용 export | digimon-tamagotchi-frontend/src/logic/arena/combatIdentity.js:2 | INITIAL_COMBAT_REVISION | 판단 보류 |
| 187 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/careMistakeLedger.js:3 | CARE_MISTAKE_SYNC_TEXT | 판단 보류 |
| 188 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/careMistakeLedger.js:17 | isCareMistakeLog | 판단 보류 |
| 189 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/careMistakeLedger.js:48 | getCareMistakeEventIdFromLog | 판단 보류 |
| 190 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/careMistakeLedger.js:83 | countActiveCareMistakeEntries | 판단 보류 |
| 191 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/careMistakeLedger.js:164 | buildCareMistakeLedgerFromActivityLogs | 판단 보류 |
| 192 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/death.js:10 | DEATH_THRESHOLDS | 판단 보류 |
| 193 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/energyRecovery.js:12 | isSleepLikeStatus | 판단 보류 |
| 194 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/energyRecovery.js:20 | getEnergyRecoverySleepStatus | 판단 보류 |
| 195 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/stats.js:54 | initializeStats | 판단 보류 |
| 196 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/stats.js:136 | updateLifespan | 판단 보류 |
| 197 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/stats.js:192 | updateAge | 판단 보류 |
| 198 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/stats.js:223 | updateAgeWithLazyUpdate | 판단 보류 |
| 199 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/stats.js:266 | applyLazyUpdate | 판단 보류 |
| 200 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/hunger.js:56 | feedMeat | 판단 보류 |
| 201 | 미사용 export | digimon-tamagotchi-frontend/src/logic/stats/hunger.js:97 | willRefuseMeat | 판단 보류 |
| 202 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/train.js:4 | VER1_DEFENSE_PATTERNS | 판단 보류 |
| 203 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/train.js:67 | doVer2Training | 판단 보류 |
| 204 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/train.js:79 | doVer3Training | 판단 보류 |
| 205 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/train.js:91 | doVer4Training | 판단 보류 |
| 206 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/train.js:103 | doVer5Training | 판단 보류 |
| 207 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/hooks/useEggScrollProgress.js:25 | useEggScrollProgress | 판단 보류 |
| 208 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/hooks/useEggScrollProgress.js:60 | default | 판단 보류 |
| 209 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/hooks/useEggScrollProgress.js | useEggScrollProgress@25, default@60 | 확정 부채 |
| 210 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaJobHandlers.js:28 | assertCronSecret | 동적 참조 |
| 211 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/http.js:129 | methodNotAllowed | 동적 참조 |
| 212 | 미사용 export | digimon-tamagotchi-frontend/src/contexts/ThemeContext.jsx:17 | SITE_THEME_DEFAULT | 판단 보류 |
| 213 | 미사용 export | digimon-tamagotchi-frontend/src/contexts/ThemeContext.jsx:18 | SITE_THEME_NOTEBOOK | 판단 보류 |
| 214 | 미사용 export | digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx:134 | sortArenaLeaderboardEntries | 판단 보류 |
| 215 | 미사용 export | digimon-tamagotchi-frontend/src/contexts/NotificationCenterContext.jsx:19 | CLOSE_NOTIFICATION_EVENT | 판단 보류 |
| 216 | 미사용 export | digimon-tamagotchi-frontend/src/contexts/NotificationCenterContext.jsx:225 | default | 판단 보류 |
| 217 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/auth.js:36 | isArenaAdmin | 동적 참조 |
| 218 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/arenaErrors.js:57 | ARENA_ERROR_STATUS | 동적 참조 |
| 219 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/firebaseAdmin.js:152 | getFirebaseConfig | 동적 참조 |
| 220 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/webPushNotifications.js:185 | buildSubscriptionId | 동적 참조 |
| 221 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/webPushNotifications.js:187 | listActivePushSubscriptions | 동적 참조 |
| 222 | 미사용 export | digimon-tamagotchi-frontend/api/_lib/webPushNotifications.js:188 | normalizeSubscription | 동적 참조 |
| 223 | 미사용 export | digimon-tamagotchi-frontend/src/contexts/AblyContext.jsx:14 | useAblyContext | 판단 보류 |
| 224 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useTamerProfile.js:10 | TAMER_PROFILE_REFRESH_EVENT | 판단 보류 |
| 225 | 중복 export | digimon-tamagotchi-frontend/src/hooks/useTamerProfile.js | useTamerProfile@28, default@108 | 확정 부채 |
| 226 | 미사용 export | digimon-tamagotchi-frontend/src/firebase.js:43 | default | 판단 보류 |
| 227 | 미사용 export | digimon-tamagotchi-frontend/src/logic/battle/questEngine.js:116 | playQuestArea | 판단 보류 |
| 228 | 미사용 export | digimon-tamagotchi-frontend/src/logic/food/meat.js:59 | checkOverfeed | 판단 보류 |
| 229 | 미사용 export | digimon-tamagotchi-frontend/src/utils/fridgeTime.js:7 | toDurationMs | 판단 보류 |
| 230 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/index.js:6 | doVer2Training | 판단 보류 |
| 231 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/index.js:7 | doVer3Training | 판단 보류 |
| 232 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/index.js:8 | doVer4Training | 판단 보류 |
| 233 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/index.js:9 | doVer5Training | 판단 보류 |
| 234 | 미사용 export | digimon-tamagotchi-frontend/src/logic/training/index.js:11 | VER1_DEFENSE_PATTERNS | 판단 보류 |
| 235 | 미사용 export | digimon-tamagotchi-frontend/src/utils/notificationEligibility.js:1 | isSlotInNotificationExcludedStorage | 판단 보류 |
| 236 | 미사용 export | digimon-tamagotchi-frontend/src/constants/gameMenus.js:6 | MENU_SURFACE_GROUPS | 판단 보류 |
| 237 | 미사용 export | digimon-tamagotchi-frontend/src/constants/gameMenus.js:19 | GAME_MENU_DEFINITIONS | 판단 보류 |
| 238 | 미사용 export | digimon-tamagotchi-frontend/src/constants/gameMenus.js:207 | getGameMenusBySurface | 판단 보류 |
| 239 | 미사용 export | digimon-tamagotchi-frontend/src/constants/gameMenus.js:248 | getMenuLockNotices | 판단 보류 |
| 240 | 미사용 export | digimon-tamagotchi-frontend/src/constants/gameMenus.js:275 | getMenuGroupLabel | 판단 보류 |
| 241 | 미사용 export | digimon-tamagotchi-frontend/src/data/homeLandingVariants.js:1 | notebookFileIslandVariant | 판단 보류 |
| 242 | 중복 export | digimon-tamagotchi-frontend/src/data/homeLandingVariants.js | notebookFileIslandVariant@1, default@63 | 확정 부채 |
| 243 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useUserSlots.js:45 | useUserSlots | 판단 보류 |
| 244 | 중복 export | digimon-tamagotchi-frontend/src/hooks/useUserSlots.js | useUserSlots@45, default@275 | 확정 부채 |
| 245 | 미사용 export | digimon-tamagotchi-frontend/src/utils/dateUtils.js:10 | formatElapsedTime | 판단 보류 |
| 246 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:18 | MASTER_DATA_VERSION_KEY_MAP | 판단 보류 |
| 247 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:34 | MASTER_DATA_EDITABLE_FIELDS | 판단 보류 |
| 248 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:57 | MASTER_IMPORT_HEADERS | 판단 보류 |
| 249 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:192 | getMasterDataVersionLabel | 판단 보류 |
| 250 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:196 | getCurrentMasterDataMap | 판단 보류 |
| 251 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:200 | getOriginalMasterDataMap | 판단 보류 |
| 252 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:215 | readCachedMasterDataOverrides | 판단 보류 |
| 253 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:233 | writeCachedMasterDataOverrides | 판단 보류 |
| 254 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:294 | normalizeTimeString | 판단 보류 |
| 255 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:312 | splitTimeString | 판단 보류 |
| 256 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:326 | buildTimeString | 판단 보류 |
| 257 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:348 | createSleepScheduleFromTimes | 판단 보류 |
| 258 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:621 | getDigimonSpriteSrc | 판단 보류 |
| 259 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:627 | getDigimonAttackSpriteSrc | 판단 보류 |
| 260 | 미사용 export | digimon-tamagotchi-frontend/src/utils/masterDataUtils.js:721 | getChangedFieldSummaryForDigimon | 판단 보류 |
| 261 | 미사용 export | digimon-tamagotchi-frontend/src/data/serviceContent.js:110 | defaultCommunityBoardId | 판단 보류 |
| 262 | 미사용 export | digimon-tamagotchi-frontend/src/data/serviceContent.js:111 | communityBoardIds | 판단 보류 |
| 263 | 미사용 export | digimon-tamagotchi-frontend/src/data/serviceContent.js:418 | communityDiscordChecklist | 판단 보류 |
| 264 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/Hero.jsx:57 | default | 판단 보류 |
| 265 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/Hero.jsx | Hero@7, default@57 | 확정 부채 |
| 266 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/Intro.jsx:41 | default | 판단 보류 |
| 267 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/Intro.jsx | Intro@5, default@41 | 확정 부채 |
| 268 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/Growth.jsx:64 | default | 판단 보류 |
| 269 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/Growth.jsx | Growth@8, default@64 | 확정 부채 |
| 270 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/Gallery.jsx:155 | default | 판단 보류 |
| 271 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/Gallery.jsx | Gallery@6, default@155 | 확정 부채 |
| 272 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/CTA.jsx:64 | default | 판단 보류 |
| 273 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/CTA.jsx | CTA@7, default@64 | 확정 부채 |
| 274 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useEncyclopediaSummary.js:8 | useEncyclopediaSummary | 판단 보류 |
| 275 | 중복 export | digimon-tamagotchi-frontend/src/hooks/useEncyclopediaSummary.js | useEncyclopediaSummary@8, default@56 | 확정 부채 |
| 276 | 미사용 export | digimon-tamagotchi-frontend/src/components/DigimonMasterDataPanel.jsx:65 | formatMasterDataActor | 판단 보류 |
| 277 | 미사용 export | digimon-tamagotchi-frontend/src/utils/stageTranslator.js:9 | stageTranslations | 판단 보류 |
| 278 | 미사용 export | digimon-tamagotchi-frontend/src/components/arena/ArenaGhostPowerBreakdown.jsx:3 | buildGhostDefensePower | 판단 보류 |
| 279 | 미사용 export | digimon-tamagotchi-frontend/src/components/arena/ArenaPowerBreakdown.jsx:4 | buildArenaPowerBreakdown | 판단 보류 |
| 280 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/LandingTopBar.jsx:9 | LandingTopBar | 판단 보류 |
| 281 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/LandingTopBar.jsx | LandingTopBar@9, default@125 | 확정 부채 |
| 282 | 미사용 export | digimon-tamagotchi-frontend/src/data/headerNavigation.js:70 | getMobileLandingOverflowItems | 판단 보류 |
| 283 | 미사용 export | digimon-tamagotchi-frontend/src/hooks/useHeaderAccountMenu.js:95 | default | 판단 보류 |
| 284 | 중복 export | digimon-tamagotchi-frontend/src/hooks/useHeaderAccountMenu.js | useHeaderAccountMenu@6, default@95 | 확정 부채 |
| 285 | 미사용 export | digimon-tamagotchi-frontend/src/repositories/UserSlotRepository.js:234 | default | 판단 보류 |
| 286 | 중복 export | digimon-tamagotchi-frontend/src/repositories/UserSlotRepository.js | userSlotRepository@233, default@234 | 확정 부채 |
| 287 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/ui/SectionEyebrow.jsx:11 | default | 판단 보류 |
| 288 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/ui/SectionEyebrow.jsx | SectionEyebrow@7, default@11 | 확정 부채 |
| 289 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/ui/ScrollCue.jsx:15 | default | 판단 보류 |
| 290 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/ui/ScrollCue.jsx | ScrollCue@3, default@15 | 확정 부채 |
| 291 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/figma/ImageWithFallback.jsx:45 | default | 판단 보류 |
| 292 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/figma/ImageWithFallback.jsx | ImageWithFallback@7, default@45 | 확정 부채 |
| 293 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/ui/StatusBar.jsx:20 | default | 판단 보류 |
| 294 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/ui/StatusBar.jsx | StatusBar@3, default@20 | 확정 부채 |
| 295 | 미사용 export | digimon-tamagotchi-frontend/src/components/landing/ui/ActionChip.jsx:7 | default | 판단 보류 |
| 296 | 중복 export | digimon-tamagotchi-frontend/src/components/landing/ui/ActionChip.jsx | ActionChip@3, default@7 | 확정 부채 |
| 297 | 설정 힌트 | digimon-tamagotchi-frontend | .css | 설정 오탐 |

## 동적·생성 경계와 후속 작업

- `src/server/gameProjectionEntry.js`는 `build:server-projection`이 읽는 생성 진입점이므로 `generated`로 보존한다.
- `api/_lib/**`의 export는 CommonJS 모듈, 테스트 의존성 주입, Vercel 함수 진입점과의 간접 연결 가능성이 높아 `동적 참조`로 분류했다. 실제 require/import 추적 없이는 제거하지 않는다.
- 루트의 `@supabase/supabase-js`, `@vercel/analytics`는 프론트엔드 workspace가 루트 설치 의존성을 사용하는 구조에서 검출된 경계 오탐으로 본다.
- 미선언 의존성 4건은 transitive dependency에 기대는 계약 부채다. 별도 PR에서 직접 의존성 선언 또는 스크립트 위치 조정을 검토한다.
- `nonuse` 아래 5개 파일과 중복 export 19건은 우선 정리 후보지만, 삭제 전 import 검색과 전체 `npm run check` 검증이 필요하다.
- CSS 힌트는 현재 Knip project가 컴파일된 CSS 확장을 추적하지 않는 설정 한계다. 광범위 ignore는 추가하지 않는다.

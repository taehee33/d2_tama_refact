"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const DEPLOYED_API_ROOT = path.join(
  REPOSITORY_ROOT,
  "digimon-tamagotchi-frontend",
  "api"
);

const DEPLOYED_ENTRYPOINTS = Object.freeze([
  "arena-v2.js",
  "arena/admin/archives/[archiveId].js",
  "arena/admin/config.js",
  "community/[boardId]/comments/[commentId].js",
  "community/[boardId]/posts/[postId].js",
  "community/[boardId]/posts/[postId]/comments/index.js",
  "community/[boardId]/posts/index.js",
  "logs/arena-battles/[archiveId]/replay.js",
  "logs/jogress/archive.js",
  "notifications/[operation].js",
  "operator/status.js",
]);

const COMMUNITY_ENTRYPOINTS = Object.freeze(
  DEPLOYED_ENTRYPOINTS.filter((entrypoint) => entrypoint.startsWith("community/"))
);

function listDeployedEntrypoints(directory = DEPLOYED_API_ROOT, prefix = "") {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.posix.join(prefix, entry.name);
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "_generated" || entry.name === "_lib") {
          return [];
        }
        return listDeployedEntrypoints(absolutePath, relativePath);
      }

      return entry.isFile() && entry.name.endsWith(".js") ? [relativePath] : [];
    })
    .sort();
}

function assertCaseSensitivePath(relativePath) {
  let currentPath = DEPLOYED_API_ROOT;

  for (const segment of relativePath.split("/")) {
    const entries = fs.readdirSync(currentPath);
    assert.ok(
      entries.includes(segment),
      `Linux 대소문자 경로 계약과 다른 파일입니다: ${relativePath}`
    );
    currentPath = path.join(currentPath, segment);
  }
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader() {},
    end(payload) {
      this.body = payload ? JSON.parse(payload) : null;
    },
  };
}

function requireWithStub(targetPath, dependencyPath, stubExports) {
  const resolvedTarget = require.resolve(targetPath);
  const resolvedDependency = require.resolve(dependencyPath);
  const previousDependency = require.cache[resolvedDependency];

  delete require.cache[resolvedTarget];
  require.cache[resolvedDependency] = {
    id: resolvedDependency,
    filename: resolvedDependency,
    loaded: true,
    exports: stubExports,
    children: [],
    paths: [],
  };

  try {
    return require(resolvedTarget);
  } finally {
    delete require.cache[resolvedTarget];
    if (previousDependency) {
      require.cache[resolvedDependency] = previousDependency;
    } else {
      delete require.cache[resolvedDependency];
    }
  }
}

test("배포 API 진입점은 현재 11개 계약과 일치하고 Hobby 상한 12개를 넘지 않는다", () => {
  const actualEntrypoints = listDeployedEntrypoints();

  assert.deepEqual(actualEntrypoints, [...DEPLOYED_ENTRYPOINTS].sort());
  assert.ok(actualEntrypoints.length <= 12);

  for (const entrypoint of actualEntrypoints) {
    assertCaseSensitivePath(entrypoint);
    assert.equal(typeof require(path.join(DEPLOYED_API_ROOT, entrypoint)), "function");
  }
});

test("커뮤니티 API 네 진입점은 실제 배포 디렉터리에서 로드된다", () => {
  assert.equal(COMMUNITY_ENTRYPOINTS.length, 4);
  for (const entrypoint of COMMUNITY_ENTRYPOINTS) {
    assert.equal(typeof require(path.join(DEPLOYED_API_ROOT, entrypoint)), "function");
  }
});

test("알림 단일 라우터는 아홉 operation을 각각의 handler로 전달한다", async () => {
  const { createNotificationRouter } = require(path.join(
    DEPLOYED_API_ROOT,
    "notifications/[operation].js"
  ));
  const calls = [];
  const operationDeps = {
    daily: "dailyHandler",
    prepare: "prepareHandler",
    "evaluate-slot": "evaluateSlotHandler",
    ack: "ackHandler",
    status: "statusHandler",
    test: "testHandler",
    read: "readHandler",
    "push-subscribe": "pushSubscribeHandler",
    "push-unsubscribe": "pushUnsubscribeHandler",
  };
  const deps = Object.fromEntries(
    Object.entries(operationDeps).map(([operation, dependencyName]) => [
      dependencyName,
      async () => calls.push(operation),
    ])
  );
  const router = createNotificationRouter(deps);

  for (const operation of Object.keys(operationDeps)) {
    await router({ query: { operation } }, createMockRes());
  }

  assert.deepEqual(calls, Object.keys(operationDeps));
});

test("아레나 관리자 통합 진입점은 사용자·시즌 종료·운영자 설정 분기를 유지한다", async () => {
  const calls = [];
  const createHandler = (name) => () => async () => calls.push(name);
  const targetPath = path.join(DEPLOYED_API_ROOT, "arena/admin/config.js");
  const dependencyPath = path.join(DEPLOYED_API_ROOT, "_lib/arenaHandlers.js");
  const handler = requireWithStub(targetPath, dependencyPath, {
    createArenaAdminConfigHandler: createHandler("config"),
    createArenaSeasonEndHandler: createHandler("end-season"),
    createArenaSetOperatorHandler: createHandler("set-operator"),
    createArenaUserDirectoryHandler: createHandler("user-directory"),
  });

  await handler({ method: "GET", query: { view: "user-directory" } }, {});
  await handler({ method: "POST", query: { action: "end-season" } }, {});
  await handler({ method: "POST", query: { action: "set-operator" } }, {});
  await handler({ method: "GET", query: {} }, {});

  assert.deepEqual(calls, ["user-directory", "end-season", "set-operator", "config"]);
});

test("운영자 상태 진입점은 일반 상태와 Ably 토큰 분기를 유지한다", async () => {
  const calls = [];
  const targetPath = path.join(DEPLOYED_API_ROOT, "operator/status.js");
  const ablyDependencyPath = path.join(DEPLOYED_API_ROOT, "_lib/ablyAuth.js");
  const operatorDependencyPath = path.join(DEPLOYED_API_ROOT, "_lib/operatorHandlers.js");
  const resolvedOperatorDependency = require.resolve(operatorDependencyPath);
  const previousOperatorDependency = require.cache[resolvedOperatorDependency];

  require.cache[resolvedOperatorDependency] = {
    id: resolvedOperatorDependency,
    filename: resolvedOperatorDependency,
    loaded: true,
    exports: {
      createOperatorStatusHandler: () => async () => calls.push("status"),
    },
    children: [],
    paths: [],
  };

  try {
    const handler = requireWithStub(targetPath, ablyDependencyPath, {
      createAblyTokenHandler: () => async () => calls.push("ably-token"),
    });

    await handler({ method: "GET", query: {} }, {});
    await handler({ method: "POST", query: { action: "ably-token" } }, {});
  } finally {
    delete require.cache[require.resolve(targetPath)];
    if (previousOperatorDependency) {
      require.cache[resolvedOperatorDependency] = previousOperatorDependency;
    } else {
      delete require.cache[resolvedOperatorDependency];
    }
  }

  assert.deepEqual(calls, ["status", "ably-token"]);
});

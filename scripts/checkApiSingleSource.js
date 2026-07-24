"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const ROOT_API_DIRECTORY = path.join(REPOSITORY_ROOT, "api");
const DEPLOYED_API_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "digimon-tamagotchi-frontend",
  "api"
);
const MAX_VERCEL_FUNCTIONS = 12;

const EXPECTED_DEPLOYED_ENTRYPOINTS = Object.freeze([
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

// 현재 호출자가 남아 있지 않아 루트 호환 shim도 허용하지 않는다.
// 향후 불가피한 호환 shim을 추가할 때는 검토 후 정확한 상대 경로만 등록한다.
const ALLOWED_ROOT_API_SHIMS = new Set();

function listFiles(directory, prefix = "") {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.posix.join(prefix, entry.name);
      const absolutePath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? listFiles(absolutePath, relativePath)
        : entry.isFile()
          ? [relativePath]
          : [];
    })
    .sort();
}

function listDeployedEntrypoints() {
  return listFiles(DEPLOYED_API_DIRECTORY).filter(
    (relativePath) =>
      relativePath.endsWith(".js") &&
      !relativePath.startsWith("_generated/") &&
      !relativePath.startsWith("_lib/")
  );
}

function validateRootShim(relativePath) {
  const errors = [];
  const absolutePath = path.join(ROOT_API_DIRECTORY, relativePath);

  if (!ALLOWED_ROOT_API_SHIMS.has(relativePath)) {
    errors.push(
      `루트 api에는 허용되지 않은 파일이 있습니다: api/${relativePath}`
    );
    return errors;
  }

  const source = fs.readFileSync(absolutePath, "utf8").trim();
  const match = source.match(
    /^(?:["']use strict["'];\s*)?module\.exports\s*=\s*require\((["'])([^"']+)\1\);$/
  );

  if (!match) {
    errors.push(`루트 호환 파일은 한 줄 require shim이어야 합니다: api/${relativePath}`);
    return errors;
  }

  const targetPath = path.resolve(path.dirname(absolutePath), match[2]);
  const deployedPrefix = `${DEPLOYED_API_DIRECTORY}${path.sep}`;

  if (!targetPath.startsWith(deployedPrefix)) {
    errors.push(`루트 shim이 실제 배포 API 밖을 가리킵니다: api/${relativePath}`);
  } else if (!fs.existsSync(targetPath) && !fs.existsSync(`${targetPath}.js`)) {
    errors.push(`루트 shim 대상 파일이 없습니다: api/${relativePath} -> ${match[2]}`);
  }

  return errors;
}

function validateApiSingleSource() {
  const errors = [];
  const rootApiFiles = listFiles(ROOT_API_DIRECTORY);
  const deployedEntrypoints = listDeployedEntrypoints();

  for (const relativePath of rootApiFiles) {
    errors.push(...validateRootShim(relativePath));
  }

  const expectedEntrypoints = [...EXPECTED_DEPLOYED_ENTRYPOINTS].sort();
  if (JSON.stringify(deployedEntrypoints) !== JSON.stringify(expectedEntrypoints)) {
    errors.push(
      [
        "실제 배포 API 진입점 목록이 계약과 다릅니다.",
        `기대: ${expectedEntrypoints.join(", ")}`,
        `실제: ${deployedEntrypoints.join(", ")}`,
      ].join("\n")
    );
  }

  if (deployedEntrypoints.length > MAX_VERCEL_FUNCTIONS) {
    errors.push(
      `Vercel 함수 수가 Hobby 상한을 넘었습니다: ${deployedEntrypoints.length}/${MAX_VERCEL_FUNCTIONS}`
    );
  }

  return {
    deployedEntrypoints,
    errors,
    rootApiFiles,
  };
}

if (require.main === module) {
  const result = validateApiSingleSource();

  if (result.errors.length > 0) {
    console.error("API 단일 원본 계약 검사 실패");
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(
      `API 단일 원본 계약 확인 완료: 배포 진입점 ${result.deployedEntrypoints.length}개, 루트 shim ${result.rootApiFiles.length}개`
    );
  }
}

module.exports = {
  ALLOWED_ROOT_API_SHIMS,
  EXPECTED_DEPLOYED_ENTRYPOINTS,
  MAX_VERCEL_FUNCTIONS,
  listDeployedEntrypoints,
  validateApiSingleSource,
  validateRootShim,
};

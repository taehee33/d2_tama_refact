"use strict";

const { createCommunityError } = require("./community");
const { isOperatorIdentity } = require("./operatorConfig");

async function getOperatorAccess(decodedToken, deps = {}) {
  const isOperator = await isOperatorIdentity(decodedToken, deps);

  return {
    isOperator,
    canAccessUserDirectory: isOperator,
  };
}

async function assertUserDirectoryAccess(decodedToken, deps = {}) {
  const access = await getOperatorAccess(decodedToken, deps);

  if (!access.canAccessUserDirectory) {
    throw createCommunityError(403, "운영자 권한이 없습니다.");
  }

  return access;
}

module.exports = {
  assertUserDirectoryAccess,
  getOperatorAccess,
};

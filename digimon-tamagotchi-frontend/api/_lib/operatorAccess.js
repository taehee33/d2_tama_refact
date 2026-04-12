"use strict";

const { createCommunityError } = require("./community");
const { isOperatorIdentity } = require("./operatorConfig");

function getOperatorAccess(decodedToken) {
  const isOperator = isOperatorIdentity(decodedToken);

  return {
    isOperator,
    canAccessUserDirectory: isOperator,
  };
}

function assertUserDirectoryAccess(decodedToken) {
  const access = getOperatorAccess(decodedToken);

  if (!access.canAccessUserDirectory) {
    throw createCommunityError(403, "운영자 권한이 없습니다.");
  }

  return access;
}

module.exports = {
  assertUserDirectoryAccess,
  getOperatorAccess,
};

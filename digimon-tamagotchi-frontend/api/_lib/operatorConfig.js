"use strict";

function normalizeCommaSeparatedList(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function collectOperatorIdentifiers(keys = []) {
  const values = keys.flatMap((key) => normalizeCommaSeparatedList(process.env[key]));
  return [...new Set(values)];
}

function isOperatorIdentity(decodedToken) {
  if (!decodedToken) {
    return false;
  }

  const operatorUids = collectOperatorIdentifiers([
    "OPERATOR_UIDS",
    "ARENA_ADMIN_UIDS",
    "NEWS_EDITOR_UIDS",
  ]);
  const operatorEmails = collectOperatorIdentifiers([
    "OPERATOR_EMAILS",
    "ARENA_ADMIN_EMAILS",
    "NEWS_EDITOR_EMAILS",
  ]);
  const uid = typeof decodedToken.uid === "string" ? decodedToken.uid.trim().toLowerCase() : "";
  const email = typeof decodedToken.email === "string" ? decodedToken.email.trim().toLowerCase() : "";

  return operatorUids.includes(uid) || (email ? operatorEmails.includes(email) : false);
}

module.exports = {
  isOperatorIdentity,
  normalizeCommaSeparatedList,
};

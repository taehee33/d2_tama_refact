"use strict";

const { getDocument, listDocuments } = require("./firestoreAdmin");

const OPERATOR_ROLES_COLLECTION = "operator_roles";
const OPERATOR_ROLE_EVENTS_COLLECTION = "operator_role_events";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOperatorRoleDocument(uid, data = {}) {
  return {
    uid: normalizeString(uid),
    isOperator: Boolean(data.isOperator),
    email: normalizeString(data.email),
    displayName: normalizeString(data.displayName),
    grantedBy: normalizeString(data.grantedBy),
    grantedAt: normalizeString(data.grantedAt) || null,
    updatedAt: normalizeString(data.updatedAt) || null,
  };
}

function getOperatorRoleDocumentPath(uid = "") {
  return `${OPERATOR_ROLES_COLLECTION}/${normalizeString(uid)}`;
}

async function getOperatorRole(uid, deps = {}) {
  const normalizedUid = normalizeString(uid);

  if (!normalizedUid) {
    return null;
  }

  if (typeof deps.getOperatorRole === "function") {
    return deps.getOperatorRole(normalizedUid, deps);
  }

  const getDocumentByPath = deps.getDocument || getDocument;
  const document = await getDocumentByPath(getOperatorRoleDocumentPath(normalizedUid));

  if (!document?.data) {
    return null;
  }

  return normalizeOperatorRoleDocument(normalizedUid, document.data);
}

async function listOperatorRoles(deps = {}) {
  if (typeof deps.listOperatorRoles === "function") {
    return deps.listOperatorRoles(deps);
  }

  const listCollectionDocuments = deps.listDocuments || listDocuments;
  const documents = await listCollectionDocuments(OPERATOR_ROLES_COLLECTION, {
    pageSize: 200,
  });

  return documents
    .map((document) => normalizeOperatorRoleDocument(document?.id, document?.data || {}))
    .filter((role) => role.uid);
}

async function isOperatorIdentity(decodedToken, deps = {}) {
  const uid = normalizeString(decodedToken?.uid);

  if (!uid) {
    return false;
  }

  if (typeof deps.isOperatorIdentity === "function" && deps.isOperatorIdentity !== isOperatorIdentity) {
    return Boolean(await deps.isOperatorIdentity(decodedToken, deps));
  }

  const role = await getOperatorRole(uid, deps);
  return Boolean(role?.isOperator);
}

function createOperatorRolePayload({
  uid,
  isOperator,
  email = "",
  displayName = "",
  grantedBy = "",
  grantedAt = null,
  updatedAt = null,
} = {}) {
  return {
    uid: normalizeString(uid),
    isOperator: Boolean(isOperator),
    email: normalizeString(email),
    displayName: normalizeString(displayName),
    grantedBy: normalizeString(grantedBy),
    ...(grantedAt ? { grantedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function createOperatorRoleEventPayload({
  targetUid,
  targetEmail = "",
  beforeIsOperator = false,
  afterIsOperator = false,
  actedBy = "",
  actedByEmail = "",
  actedAt = null,
  source = "user-directory",
} = {}) {
  return {
    targetUid: normalizeString(targetUid),
    targetEmail: normalizeString(targetEmail),
    beforeIsOperator: Boolean(beforeIsOperator),
    afterIsOperator: Boolean(afterIsOperator),
    actedBy: normalizeString(actedBy),
    actedByEmail: normalizeString(actedByEmail),
    ...(actedAt ? { actedAt } : {}),
    source: normalizeString(source) || "user-directory",
  };
}

module.exports = {
  OPERATOR_ROLE_EVENTS_COLLECTION,
  OPERATOR_ROLES_COLLECTION,
  createOperatorRoleEventPayload,
  createOperatorRolePayload,
  getOperatorRole,
  getOperatorRoleDocumentPath,
  isOperatorIdentity,
  listOperatorRoles,
  normalizeOperatorRoleDocument,
};

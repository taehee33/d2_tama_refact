"use strict";

const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function resolveAdminCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  return applicationDefault();
}

function resolveAdminProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.REACT_APP_FIREBASE_PROJECT_ID ||
    undefined
  );
}

function getArenaAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: resolveAdminCredential(),
    projectId: resolveAdminProjectId(),
  });
}

function getArenaFirestore() {
  return getFirestore(getArenaAdminApp());
}

async function runArenaTransaction(callback, options = undefined) {
  if (typeof callback !== "function") {
    throw new TypeError("Arena transaction callback이 필요합니다.");
  }
  return getArenaFirestore().runTransaction(callback, options);
}

module.exports = {
  getArenaAdminApp,
  getArenaFirestore,
  runArenaTransaction,
};

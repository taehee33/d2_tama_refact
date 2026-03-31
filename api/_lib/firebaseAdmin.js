"use strict";

const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function getPrivateKey() {
  if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    return null;
  }

  return process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n");
}

function getFirebaseAdminApp() {
  const existingApps = getApps();

  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID || null;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || null;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: projectId || undefined,
    });
  }

  throw new Error(
    "Firebase Admin 환경변수가 설정되지 않았습니다. FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY를 확인해 주세요."
  );
}

function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

module.exports = {
  getFirebaseAdminApp,
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
};

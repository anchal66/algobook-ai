import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import path from "path";

let _app: App | null = null;
let _db: Firestore | null = null;

function getAdminApp(): App {
  if (_app) return _app;

  if (getApps().length) {
    _app = getApps()[0];
    return _app;
  }

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      const serviceAccount = JSON.parse(raw);
      credential = cert(serviceAccount);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON. Paste the full service account JSON as one line in Vercel."
      );
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const resolvedPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    credential = cert(resolvedPath);
  } else {
    throw new Error(
      "Either FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH must be set."
    );
  }

  _app = initializeApp({ credential });
  return _app;
}

function getAdminDbInternal(): Firestore {
  if (!_db) {
    _db = getFirestore(getAdminApp());
  }
  return _db;
}

/**
 * Lazy Firestore client so missing/invalid env fails on first use (not at import).
 * On Vercel, use FIREBASE_SERVICE_ACCOUNT_KEY (JSON string); file paths usually do not exist.
 */
export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const db = getAdminDbInternal();
    const value = (db as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(db);
    }
    return value;
  },
}) as Firestore;

export const adminApp = new Proxy({} as App, {
  get(_target, prop) {
    const app = getAdminApp();
    const value = (app as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(app);
    }
    return value;
  },
}) as App;

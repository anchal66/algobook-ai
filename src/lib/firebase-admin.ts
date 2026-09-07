import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import path from "path";

let _app: App | null = null;
let _db: Firestore | null = null;

export function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0];
    return _app;
  }

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim()));
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON. Paste the full service account JSON as one line.");
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    credential = cert(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  } else {
    throw new Error("Either FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH must be set.");
  }

  _app = initializeApp({ credential });
  return _app;
}

/** Survives dev-server hot reloads: `getFirestore()` returns the same instance, and `settings()` may only run once. */
const globalCache = globalThis as unknown as { __algobookAdminDb?: Firestore };

export function getAdminDb(): Firestore {
  if (_db) return _db;
  if (globalCache.__algobookAdminDb) {
    _db = globalCache.__algobookAdminDb;
    return _db;
  }
  const db = getFirestore(getAdminApp());
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already configured by a previous evaluation of this module (HMR); keep using the instance.
  }
  _db = db;
  globalCache.__algobookAdminDb = db;
  return db;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

/** Lazy Firestore client so a missing/invalid credential fails on first use, not at import. */
export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const db = getAdminDb();
    const value = (db as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(db) : value;
  },
}) as Firestore;

export const adminApp = new Proxy({} as App, {
  get(_target, prop) {
    const app = getAdminApp();
    const value = (app as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(app) : value;
  },
}) as App;

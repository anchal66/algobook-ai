import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";

let adminApp: App;

if (!getApps().length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Vercel / production: credentials passed as a JSON string
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    credential = cert(serviceAccount);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // Local dev: credentials read from a file
    const resolvedPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    credential = cert(resolvedPath);
  } else {
    throw new Error(
      "Either FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH must be set."
    );
  }

  adminApp = initializeApp({ credential });
} else {
  adminApp = getApps()[0];
}

const adminDb = getFirestore(adminApp);

export { adminApp, adminDb };

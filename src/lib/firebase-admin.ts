import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";

let adminApp: App;

if (!getApps().length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH environment variable is not set. " +
        "Point it to your service account JSON file."
    );
  }

  const resolvedPath = path.resolve(serviceAccountPath);

  adminApp = initializeApp({
    credential: cert(resolvedPath),
  });
} else {
  adminApp = getApps()[0];
}

const adminDb = getFirestore(adminApp);

export { adminApp, adminDb };

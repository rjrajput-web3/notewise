/**
 * Firebase bootstrap for Notewise.
 *
 * Initializes the Firebase app with the real project config, wires App Check
 * (debug token in dev; reCAPTCHA Enterprise when a site key is configured),
 * and best-effort enables Anonymous Auth + Firestore. Every optional service
 * degrades gracefully: if Auth or Firestore is not enabled in the console yet,
 * the app keeps working on local storage and says so in the UI.
 */
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { firebaseConfig } from "./firebase-config.js";

let app = null;
let db = null;
let auth = null;
let appCheckReady = false;
let authState = "not-attempted"; // not-attempted | signed-in | unavailable
let firestoreState = "unknown"; // unknown | ready | unavailable

export function initFirebase() {
  if (app) return { app, db, auth };

  app = initializeApp(firebaseConfig);

  // App Check: debug token in dev so AI Logic calls are accepted without a
  // reCAPTCHA site key. A site key can be supplied via env for production.
  try {
    const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
    if (siteKey) {
      // Dynamic import keeps the bundle lean when App Check is not used.
      import("firebase/app-check").then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
        if (import.meta.env.DEV) {
          self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true
        });
        appCheckReady = true;
      });
    } else if (import.meta.env.DEV) {
      // No site key configured: register the debug token so a debug App Check
      // token can be minted from the console if needed. The app works without
      // App Check until AI Logic is enabled; see README.
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
  } catch (err) {
    console.warn("[notewise] App Check setup skipped:", err.message);
  }

  try {
    db = getFirestore(app);
    firestoreState = "ready";
  } catch (err) {
    console.warn("[notewise] Firestore unavailable:", err.message);
    firestoreState = "unavailable";
  }

  try {
    auth = getAuth(app);
    signInAnonymously(auth)
      .then(() => {
        authState = "signed-in";
      })
      .catch((err) => {
        // Anonymous Auth may not be enabled in the console yet — not fatal.
        authState = "unavailable";
        console.warn("[notewise] Anonymous sign-in unavailable:", err.code || err.message);
      });
  } catch (err) {
    authState = "unavailable";
    console.warn("[notewise] Auth unavailable:", err.message);
  }

  return { app, db, auth };
}

export function getFirebaseApp() {
  return app;
}

export function getDb() {
  return db;
}

export function getAuthState() {
  return authState;
}

export function getFirestoreState() {
  return firestoreState;
}

export function isAppCheckReady() {
  return appCheckReady;
}

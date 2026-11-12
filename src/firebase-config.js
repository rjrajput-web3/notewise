/**
 * Firebase configuration for Notewise.
 *
 * This is the REAL config of the "HybridAI" Firebase project
 * (project ID: hybridai-smart-notes, Spark plan, free tier).
 * The apiKey below is the public web client key: it identifies the
 * Firebase project in client-side code and is meant to be embedded in a
 * web app. It is NOT a secret credential — access to data and AI is
 * enforced server-side by Firebase App Check and Firestore security rules.
 *
 * Values can be overridden with Vite env vars (see .env.example), but the
 * defaults below are the live project, so the app works out of the box.
 */
export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyDZVwuKXSWwsroz6ZMRnnlgoDSz45UwGxM",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "hybridai-smart-notes.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "hybridai-smart-notes",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "hybridai-smart-notes.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "46826933820",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:46826933820:web:3efdde31863905cc02bd39"
};

export const FIREBASE_PROJECT_ID = "hybridai-smart-notes";
export const FIREBASE_CONSOLE_URL =
  "https://console.firebase.google.com/project/hybridai-smart-notes/overview";

import { getDatabase } from "firebase/database";
import { app } from "./lib/firebase";

/**
 * Re-export a Database instance backed by the same app that
 * src/lib/firebase.ts already initialises from VITE_FIREBASE_* env vars.
 * No credentials are duplicated here.
 */
export const db = app ? getDatabase(app) : null;

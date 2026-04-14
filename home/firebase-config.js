// firebase-config.js
// Replace these values with your own Firebase project config.
// Find them in: Firebase Console → Project Settings → Your Apps → SDK Setup
// These are PUBLIC keys (safe to expose) — Firebase security comes from your
// Firestore Security Rules, NOT from hiding these values.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmWOryytUc7lz3moV-6Ke9MzUvPdPWayI",
  authDomain: "scholar-sprint-13dcc.firebaseapp.com",
  projectId: "scholar-sprint-13dcc",
  storageBucket: "scholar-sprint-13dcc.firebasestorage.app",
  messagingSenderId: "427960359444",
  appId: "1:427960359444:web:9ebb5c9d25b34361916501",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Fetches the current authenticated user's profile from Firestore.
 * Expected Firestore structure:
 *   users/{uid}/profile (document) with fields like:
 *     gpa, weightedGpa, sat, act, apCourses, activities[],
 *     intendedMajor, alternativeMajors, careerGoals,
 *     preferredLocations, graduationYear, name
 *
 * Returns a profile object, or a default demo profile if not signed in.
 */
export async function getUserProfile() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profileRef = doc(db, "users", user.uid, "profile", "data");
          const snap = await getDoc(profileRef);
          if (snap.exists()) {
            resolve({ uid: user.uid, email: user.email, ...snap.data() });
          } else {
            // Profile doc doesn't exist yet — return minimal profile
            resolve({
              uid: user.uid,
              email: user.email,
              name: user.displayName || "Student",
            });
          }
        } catch (err) {
          console.warn("Firestore read failed, using demo profile:", err);
          resolve(getDemoProfile());
        }
      } else {
        // Not signed in — use demo data so the app still works during development
        console.info("No user signed in. Using demo profile.");
        resolve(getDemoProfile());
      }
    });
  });
}

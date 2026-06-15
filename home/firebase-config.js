// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
 * Fetches the current user's profile from Firestore.
 * Data is saved by the profile form at: users/{uid}  (top-level doc)
 * with nested fields: academics.unweightedGPA, goals.intendedMajor, etc.
 */
export async function getUserProfile() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Read from users/{uid} — this is where your profile form saves to
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);

          if (snap.exists()) {
            const data = snap.data();

            // Map Firestore structure → flat profile object for main.js
            const profile = {
              uid: user.uid,
              email: user.email,
              name:
                `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
                user.displayName ||
                "Student",
              gpa: data.academics?.unweightedGPA ?? null,
              weightedGpa: data.academics?.weightedGPA ?? null,
              sat: data.academics?.satScore ?? null,
              act: data.academics?.actScore ?? null,
              apCourses: data.academics?.apCourses ?? null,
              // activities is an array of {name, role} objects — flatten to strings
              activities: (data.activities || []).map((a) =>
                a.role ? `${a.name} (${a.role})` : a.name,
              ),
              activityDetails: data.activities || [],
              leadershipRoles: data.extracurriculars?.leadershipRoles ?? null,
              awards: data.extracurriculars?.awards ?? null,
              volunteering: data.extracurriculars?.volunteering ?? null,
              intendedMajor: data.goals?.intendedMajor ?? null,
              alternativeMajors: data.goals?.alternativeMajors ?? null,
              careerGoals: data.goals?.careerGoals ?? null,
              preferredLocations: data.goals?.preferredLocations ?? null,
              homeState: data.homeState ?? null,
              graduationYear: data.graduationYear ?? null,
              highSchool: data.highSchool ?? null,
            };

            resolve(profile);
          } else {
            // User is logged in but hasn't filled out profile form yet
            console.warn(
              "No profile found for user. Have they completed the profile form?",
            );
            resolve({
              uid: user.uid,
              email: user.email,
              name: user.displayName || "Student",
            });
          }
        } catch (err) {
          console.error("Firestore read error:", err);
          resolve(getDemoProfile());
        }
      } else {
        // Not logged in — redirect to login or use demo
        console.info("No user signed in. Using demo profile.");
        resolve(getDemoProfile());
      }
    });
  });
}

function getDemoProfile() {
  return {
    name: "Alex Johnson",
    gpa: 3.7,
    weightedGpa: 4.1,
    sat: 1380,
    act: 30,
    apCourses: 6,
    intendedMajor: "Computer Science",
    preferredLocations: "Midwest, Northeast",
    homeState: "IL",
    graduationYear: "2026",
    highSchool: "Springfield High School",
    activities: [
      "Robotics Club (President)",
      "Varsity Soccer",
      "National Honor Society",
    ],
    leadershipRoles: "Robotics Club President, Soccer Team Captain",
    awards: "National Honor Society, Regional Science Fair finalist",
    volunteering: "Weekly tutoring at community center, 120+ hours",
  };
}

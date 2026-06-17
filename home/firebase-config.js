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
  setDoc,
  serverTimestamp,
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

function waitForUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

function mapFirestoreToProfile(user, data) {
  return {
    uid: user.uid,
    email: user.email,
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    phone: data.phone ?? "",
    name:
      `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
      user.displayName ||
      "Student",
    gpa: data.academics?.unweightedGPA ?? null,
    weightedGpa: data.academics?.weightedGPA ?? null,
    sat: data.academics?.satScore ?? null,
    act: data.academics?.actScore ?? null,
    apCourses: data.academics?.apCourses ?? null,
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
    collegeType: data.goals?.collegeType ?? [],
    financialNeed: data.goals?.financialNeed ?? null,
    testScoreGoal: data.goals?.testScoreGoal ?? null,
    homeState: data.homeState ?? null,
    graduationYear: data.graduationYear ?? null,
    highSchool: data.highSchool ?? null,
  };
}

/**
 * Fetches the current user's profile from Firestore.
 */
export async function getUserProfile() {
  const user = await waitForUser();

  if (user) {
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        return mapFirestoreToProfile(user, snap.data());
      }

      console.warn(
        "No profile found for user. Have they completed the profile form?",
      );
      return {
        uid: user.uid,
        email: user.email,
        name: user.displayName || "Student",
      };
    } catch (err) {
      console.error("Firestore read error:", err);
      return getDemoProfile();
    }
  }

  console.info("No user signed in. Using demo profile.");
  return getDemoProfile();
}

export async function fetchProfileDocument() {
  const user = await waitForUser();
  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    return { uid: user.uid, email: user.email };
  }

  return { uid: user.uid, email: user.email, ...snap.data() };
}

export async function saveUserProfile(profileData) {
  const user = auth.currentUser || (await waitForUser());
  if (!user) {
    throw new Error("You must be signed in to save your profile.");
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      ...profileData,
      email: user.email,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getUserObjectives() {
  const user = await waitForUser();
  if (!user) return [];

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return [];
    return normalizeObjectives(snap.data().objectives);
  } catch (err) {
    console.error("Failed to load objectives:", err);
    return [];
  }
}

export async function saveUserObjectives(objectives) {
  const user = auth.currentUser || (await waitForUser());
  if (!user) {
    throw new Error("Sign in to save your objectives.");
  }

  await setDoc(
    doc(db, "users", user.uid),
    { objectives: normalizeObjectives(objectives) },
    { merge: true },
  );
}

export async function getSavedRoadmap() {
  const user = await waitForUser();
  if (!user) return null;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return null;
    const roadmap = snap.data().roadmap;
    return roadmap?.phases?.length ? roadmap : null;
  } catch (err) {
    console.error("Failed to load roadmap:", err);
    return null;
  }
}

export async function saveRoadmap(roadmap) {
  const user = auth.currentUser || (await waitForUser());
  if (!user) {
    throw new Error("Sign in to save your roadmap.");
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      roadmap: {
        ...roadmap,
        generatedAt: new Date().toISOString(),
      },
    },
    { merge: true },
  );
}

export function isSignedInUser() {
  return Boolean(auth.currentUser);
}

function normalizeObjectives(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => ({
      id: String(item.id || `obj-${index}-${Date.now()}`),
      text: String(item.text || "").trim(),
      completed: Boolean(item.completed),
      roadmapItemId: item.roadmapItemId ? String(item.roadmapItemId) : null,
      addedAt: item.addedAt || new Date().toISOString(),
    }))
    .filter((item) => item.text);
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
    financialNeed: "some",
    leadershipRoles: "Robotics Club President, Soccer Team Captain",
    awards: "National Honor Society, Regional Science Fair finalist",
    volunteering: "Weekly tutoring at community center, 120+ hours",
  };
}

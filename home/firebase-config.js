import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmWOryytUc7lz3moV-6Ke9MzUvPdPWayI",
  authDomain: "scholar-sprint-13dcc.firebaseapp.com",
  projectId: "scholar-sprint-13dcc",
  storageBucket: "scholar-sprint-13dcc.firebasestorage.app",
  messagingSenderId: "427960359444",
  appId: "1:427960359444:web:9ebb5c9d25b34361916501",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadUserProfile(user.uid);
  } else {
    // Redirect to login if not signed in
    window.location.href = "../index.html";
  }
});

async function loadUserProfile(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      renderProfile(data);
    } else {
      console.log("No profile found");
    }
  } catch (error) {
    console.error("Error loading profile:", error);
  }
}

function renderProfile(data) {
  // 1. ACADEMICS
  document.getElementById("displayUnweightedGPAHome").textContent =
    (data.academics?.unweightedGPA || "N/A") + " / 4.0";

  document.getElementById("displayUnweightedGPA").textContent =
    (data.academics?.unweightedGPA || "N/A") + " / 4.0";

  document.getElementById("displayWeightedGPA").textContent = data.academics
    ?.weightedGPA
    ? data.academics.weightedGPA + " / 5.0"
    : "N/A";

  document.getElementById("displayAP").textContent = data.academics?.apCourses
    ? data.academics.apCourses + " Courses"
    : "0 Courses";

  document.getElementById("displaySAT").textContent =
    data.academics?.satScore || "N/A";

  document.getElementById("displaySATHome").textContent =
    data.academics?.satScore || "N/A";

  document.getElementById("displayACT").textContent =
    data.academics?.actScore || "N/A";

  document.getElementById("applicationSeason").textContent =
    "Fall " + data?.graduationYear || "N/A";

  document.getElementById("intendedMajor").textContent =
    data.goals?.intendedMajor || "N/A";

  document.getElementById("alternativeMajor").textContent =
    data.goals?.alternativeMajors || "N/A";

  document.getElementById("careerGoals").textContent =
    data.goals?.careerGoals || "N/A";

  document.getElementById("preferredLocations").textContent =
    data.goals?.preferredLocations || "N/A";

  // 3. ACTIVITIES (Loop through the array)
  const activitiesList = document.getElementById("activitiesList");

  if (data.activities && data.activities.length > 0) {
    // Create HTML for each activity
    activitiesList.innerHTML = data.activities
      .map(
        (act) => `
            <div class="activity-item">
                <strong>${act.name}</strong>
                ${act.role ? `<span>   -   ${act.role}</span>` : ""}
            </div>
        `,
      )
      .join("");
  } else {
    activitiesList.innerHTML = "<div> No activities listed.</div>";
  }
}

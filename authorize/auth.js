import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
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

document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.log("usernotfound");
    } else {
      currentUser = user;
      const emailInput = document.getElementById("email");
      if (emailInput && !emailInput.value) {
        emailInput.value = user.email || "";
      }
      console.log("Authenticated as:", user.uid);
    }
  });

  const form = document.getElementById("profileForm");
  const sections = document.querySelectorAll(".form-section");
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const submitBtn = document.getElementById("submitBtn");
  const progressFill = document.getElementById("progressFill");
  const currentStepSpan = document.getElementById("currentStep");
  const totalStepsSpan = document.getElementById("totalSteps");
  const successModal = document.getElementById("successModal");
  const goToDashboardBtn = document.getElementById("goToDashboardBtn");
  const addActivityBtn = document.getElementById("addActivityBtn");
  const activityNameInput = document.getElementById("activityName");
  const activityRoleInput = document.getElementById("activityRole");
  const activitiesList = document.getElementById("activitiesList");
  const formError = document.getElementById("formError");

  let currentStep = 0;
  let activities = [];
  const totalSteps = sections.length;

  if (totalStepsSpan) totalStepsSpan.textContent = totalSteps;

  function updateProgress() {
    const progress = ((currentStep + 1) / totalSteps) * 100;
    progressFill.style.width = progress + "%";
    currentStepSpan.textContent = currentStep + 1;
  }

  function showSection(index) {
    sections.forEach((section) => section.classList.remove("active"));
    if (sections[index]) {
      sections[index].classList.add("active");
    }

    if (prevBtn) prevBtn.style.display = index > 0 ? "block" : "none";
    if (nextBtn)
      nextBtn.style.display = index < totalSteps - 1 ? "block" : "none";
    if (submitBtn)
      submitBtn.style.display = index === totalSteps - 1 ? "block" : "none";

    updateProgress();
    clearFormError();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markInvalid(field) {
    if (field) field.classList.add("field-error");
  }

  function clearFieldErrors(section) {
    section.querySelectorAll(".field-error").forEach((el) => {
      el.classList.remove("field-error");
    });
    activitiesList?.classList.remove("field-error-block");
  }

  function showFormError(message) {
    if (!formError) return;
    formError.textContent = message;
    formError.classList.toggle("visible", Boolean(message));
  }

  function clearFormError() {
    showFormError("");
  }

  function validateSection(step) {
    const section = sections[step];
    if (!section) return false;

    clearFieldErrors(section);
    let valid = true;
    const messages = [];

    section.querySelectorAll("input[required], select[required], textarea[required]").forEach((field) => {
      if (!field.value.trim()) {
        markInvalid(field);
        valid = false;
      } else if (!field.checkValidity()) {
        markInvalid(field);
        valid = false;
      }
    });

    if (step === 1) {
      const gpa = Number(form.unweightedGPA.value);
      const ap = Number(form.apCourses.value);
      if (gpa < 0 || gpa > 4) {
        markInvalid(form.unweightedGPA);
        messages.push("Unweighted GPA must be between 0 and 4.");
        valid = false;
      }
      if (ap < 0) {
        markInvalid(form.apCourses);
        messages.push("AP/Honors course count cannot be negative.");
        valid = false;
      }
      if (form.satScore.value) {
        const sat = Number(form.satScore.value);
        if (sat < 400 || sat > 1600) {
          markInvalid(form.satScore);
          messages.push("SAT score must be between 400 and 1600.");
          valid = false;
        }
      }
      if (form.actScore.value) {
        const act = Number(form.actScore.value);
        if (act < 1 || act > 36) {
          markInvalid(form.actScore);
          messages.push("ACT score must be between 1 and 36.");
          valid = false;
        }
      }
    }

    if (step === 2) {
      if (activities.length === 0) {
        activitiesList?.classList.add("field-error-block");
        messages.push("Add at least one extracurricular activity before continuing.");
        valid = false;
      }
    }

    if (!valid) {
      showFormError(
        messages[0] || "Please complete all required fields correctly before continuing.",
      );
      const firstInvalid = section.querySelector(".field-error");
      firstInvalid?.focus();
    } else {
      clearFormError();
    }

    return valid;
  }

  function addActivity() {
    const name = activityNameInput.value.trim();
    const role = activityRoleInput.value.trim();

    if (!name) {
      showFormError("Please enter an activity name before adding.");
      activityNameInput.focus();
      return;
    }

    activities.push({ name, role });
    activityNameInput.value = "";
    activityRoleInput.value = "";
    renderActivities();
    clearFormError();
  }

  function removeActivity(index) {
    activities.splice(index, 1);
    renderActivities();
  }

  function renderActivities() {
    if (activities.length === 0) {
      activitiesList.innerHTML =
        '<p class="empty-state">No activities added yet. Add your first one above.</p>';
      return;
    }

    activitiesList.innerHTML = activities
      .map(
        (activity, index) => `
      <div class="activity-item">
        <div class="activity-info">
          <div class="activity-name">${activity.name}</div>
          ${
            activity.role
              ? `<div class="activity-role">${activity.role}</div>`
              : ""
          }
        </div>
        <button type="button" class="activity-remove" onclick="removeActivityHandler(${index})">Remove</button>
      </div>
    `,
      )
      .join("");
  }

  window.removeActivityHandler = (index) => {
    removeActivity(index);
  };

  nextBtn.addEventListener("click", () => {
    if (!validateSection(currentStep)) return;
    if (currentStep < totalSteps - 1) {
      currentStep++;
      showSection(currentStep);
    }
  });

  prevBtn.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      showSection(currentStep);
    }
  });

  addActivityBtn.addEventListener("click", (e) => {
    e.preventDefault();
    addActivity();
  });

  activityNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addActivity();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateSection(currentStep)) return;

    if (!currentUser) {
      showFormError("You must be logged in to save your profile.");
      return;
    }

    const fd = new FormData(form);

    const profileData = {
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: currentUser.email,
      phone: fd.get("phone"),
      highSchool: fd.get("highSchool"),
      homeState: fd.get("homeState"),
      graduationYear: fd.get("graduationYear"),

      academics: {
        unweightedGPA: Number(fd.get("unweightedGPA")),
        weightedGPA: Number(fd.get("weightedGPA")) || null,
        satScore: Number(fd.get("satScore")) || null,
        actScore: Number(fd.get("actScore")) || null,
        apCourses: Number(fd.get("apCourses")),
      },

      activities,

      extracurriculars: {
        leadershipRoles: fd.get("leadershipRoles"),
        awards: fd.get("awards"),
        volunteering: fd.get("volunteering"),
      },

      goals: {
        intendedMajor: fd.get("intendedMajor"),
        alternativeMajors: fd.get("alternativeMajors"),
        careerGoals: fd.get("careerGoals"),
        preferredLocations: fd.get("preferredLocations"),
        collegeType: fd.getAll("collegeType"),
        financialNeed: fd.get("financialNeed"),
        testScoreGoal: fd.get("testScoreGoal"),
      },
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    try {
      await setDoc(doc(db, "users", currentUser.uid), profileData, {
        merge: true,
      });
      successModal.classList.add("active");
    } catch (err) {
      console.error("Profile save error:", err);
      showFormError("Could not save your profile. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Complete Profile";
    }
  });

  goToDashboardBtn.addEventListener("click", () => {
    window.location.href = "../home/home.html";
  });

  showSection(0);
});

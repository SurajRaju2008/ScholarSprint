import { fetchProfileDocument, saveUserProfile } from "./firebase-config.js";

let settingsActivities = [];

export function initSettings(onProfileSaved) {
  const form = document.getElementById("settingsForm");
  if (!form) return;

  const statusEl = document.getElementById("settingsStatus");
  const addBtn = document.getElementById("settingsAddActivityBtn");
  const activityName = document.getElementById("settingsActivityName");
  const activityRole = document.getElementById("settingsActivityRole");
  const activitiesList = document.getElementById("settingsActivitiesList");

  loadSettingsForm();

  addBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const name = activityName?.value.trim();
    if (!name) {
      setStatus(statusEl, "Enter an activity name before adding.", "error");
      activityName?.focus();
      return;
    }
    settingsActivities.push({ name, role: activityRole?.value.trim() || "" });
    if (activityName) activityName.value = "";
    if (activityRole) activityRole.value = "";
    renderSettingsActivities(activitiesList);
    clearStatus(statusEl);
  });

  window.removeSettingsActivity = (index) => {
    settingsActivities.splice(index, 1);
    renderSettingsActivities(activitiesList);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateSettingsForm(form, activitiesList, statusEl)) return;

    const saveBtn = document.getElementById("settingsSaveBtn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
    }

    try {
      const fd = new FormData(form);
      await saveUserProfile({
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
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
        activities: settingsActivities,
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
          testScoreGoal: Number(fd.get("testScoreGoal")) || null,
        },
      });

      setStatus(statusEl, "Profile saved. College Match will use your updated info.", "success");
      if (onProfileSaved) await onProfileSaved();
    } catch (err) {
      console.error("Settings save error:", err);
      setStatus(statusEl, err.message || "Could not save profile. Try again.", "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      }
    }
  });
}

async function loadSettingsForm() {
  const data = await fetchProfileDocument();
  if (!data) return;

  setValue("settingsFirstName", data.firstName);
  setValue("settingsLastName", data.lastName);
  setValue("settingsEmail", data.email);
  setValue("settingsPhone", data.phone);
  setValue("settingsHighSchool", data.highSchool);
  setValue("settingsHomeState", data.homeState);
  setValue("settingsGraduationYear", data.graduationYear);
  setValue("settingsUnweightedGPA", data.academics?.unweightedGPA);
  setValue("settingsWeightedGPA", data.academics?.weightedGPA);
  setValue("settingsSatScore", data.academics?.satScore);
  setValue("settingsActScore", data.academics?.actScore);
  setValue("settingsApCourses", data.academics?.apCourses);
  setValue("settingsLeadershipRoles", data.extracurriculars?.leadershipRoles);
  setValue("settingsAwards", data.extracurriculars?.awards);
  setValue("settingsVolunteering", data.extracurriculars?.volunteering);
  setValue("settingsIntendedMajor", data.goals?.intendedMajor);
  setValue("settingsAlternativeMajors", data.goals?.alternativeMajors);
  setValue("settingsCareerGoals", data.goals?.careerGoals);
  setValue("settingsPreferredLocations", data.goals?.preferredLocations);
  setValue("settingsFinancialNeed", data.goals?.financialNeed);
  setValue("settingsTestScoreGoal", data.goals?.testScoreGoal);

  settingsActivities = Array.isArray(data.activities) ? [...data.activities] : [];
  renderSettingsActivities(document.getElementById("settingsActivitiesList"));

  const collegeTypes = data.goals?.collegeType || [];
  document
    .querySelectorAll('input[name="settingsCollegeType"]')
    .forEach((cb) => {
      cb.checked = collegeTypes.includes(cb.value);
    });
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el || value == null || value === "") return;
  el.value = value;
}

function renderSettingsActivities(container) {
  if (!container) return;

  if (settingsActivities.length === 0) {
    container.innerHTML =
      '<p class="settings-empty">No activities added yet. Add at least one for accurate matches.</p>';
    return;
  }

  container.innerHTML = settingsActivities
    .map(
      (activity, index) => `
      <div class="settings-activity-item">
        <div>
          <div class="settings-activity-name">${escapeHtml(activity.name)}</div>
          ${
            activity.role
              ? `<div class="settings-activity-role">${escapeHtml(activity.role)}</div>`
              : ""
          }
        </div>
        <button type="button" class="btn-secondary btn-small" onclick="removeSettingsActivity(${index})">Remove</button>
      </div>`,
    )
    .join("");
}

function validateSettingsForm(form, activitiesList, statusEl) {
  clearFieldErrors(form);

  const requiredIds = [
    "settingsFirstName",
    "settingsLastName",
    "settingsHighSchool",
    "settingsHomeState",
    "settingsGraduationYear",
    "settingsUnweightedGPA",
    "settingsApCourses",
    "settingsIntendedMajor",
    "settingsCareerGoals",
    "settingsFinancialNeed",
  ];

  let valid = true;

  for (const id of requiredIds) {
    const field = document.getElementById(id);
    if (!field || !field.value.trim()) {
      markInvalid(field);
      valid = false;
    }
  }

  if (settingsActivities.length === 0) {
    valid = false;
    activitiesList?.classList.add("field-error-block");
  }

  if (!valid) {
    setStatus(statusEl, "Fill in all required fields, including home state and at least one activity.", "error");
    const firstInvalid = form.querySelector(".field-error");
    firstInvalid?.focus();
    return false;
  }

  clearStatus(statusEl);
  return true;
}

function markInvalid(field) {
  if (field) field.classList.add("field-error");
}

function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((el) => el.classList.remove("field-error"));
  form.querySelectorAll(".field-error-block").forEach((el) => el.classList.remove("field-error-block"));
}

function setStatus(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `settings-status ${type}`;
}

function clearStatus(el) {
  if (!el) return;
  el.textContent = "";
  el.className = "settings-status";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

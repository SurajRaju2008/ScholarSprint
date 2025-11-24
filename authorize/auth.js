document.addEventListener("DOMContentLoaded", function () {
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

  let currentStep = 0;
  let activities = [];
  const totalSteps = sections.length;

  totalStepsSpan.textContent = totalSteps;

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

    prevBtn.style.display = index > 0 ? "block" : "none";
    nextBtn.style.display = index < totalSteps - 1 ? "block" : "none";
    submitBtn.style.display = index === totalSteps - 1 ? "block" : "none";

    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addActivity() {
    const name = activityNameInput.value.trim();
    const role = activityRoleInput.value.trim();

    if (!name) {
      alert("Please enter an activity name");
      return;
    }

    activities.push({ name, role });
    activityNameInput.value = "";
    activityRoleInput.value = "";
    renderActivities();
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
    `
      )
      .join("");
  }

  window.removeActivityHandler = function (index) {
    removeActivity(index);
  };

  nextBtn.addEventListener("click", function () {
    if (currentStep < totalSteps - 1) {
      currentStep++;
      showSection(currentStep);
    }
  });

  prevBtn.addEventListener("click", function () {
    if (currentStep > 0) {
      currentStep--;
      showSection(currentStep);
    }
  });

  addActivityBtn.addEventListener("click", function (e) {
    e.preventDefault();
    addActivity();
  });

  activityNameInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addActivity();
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(form);
    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      highSchool: formData.get("highSchool"),
      graduationYear: formData.get("graduationYear"),
      counselorEmail: formData.get("counselorEmail"),
      unweightedGPA: formData.get("unweightedGPA"),
      weightedGPA: formData.get("weightedGPA"),
      satScore: formData.get("satScore"),
      actScore: formData.get("actScore"),
      apCourses: formData.get("apCourses"),
      coursesMajor: formData.get("coursesMajor"),
      classRank: formData.get("classRank"),
      activities: activities,
      leadershipRoles: formData.get("leadershipRoles"),
      awards: formData.get("awards"),
      volunteering: formData.get("volunteering"),
      intendedMajor: formData.get("intendedMajor"),
      alternativeMajors: formData.get("alternativeMajors"),
      careerGoals: formData.get("careerGoals"),
      preferredLocations: formData.get("preferredLocations"),
      collegeType: formData.getAll("collegeType"),
      financialNeed: formData.get("financialNeed"),
      testScoreGoal: formData.get("testScoreGoal"),
    };

    sessionStorage.setItem("profileData", JSON.stringify(data));
    console.log("Form Data:", data);

    successModal.classList.add("active");
  });

  goToDashboardBtn.addEventListener("click", function () {
    window.location.href = "/home/home.html";
  });

  showSection(0);
});

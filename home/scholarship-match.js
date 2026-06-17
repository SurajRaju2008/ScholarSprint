const TOP_COUNT = 5;
const SAVED_KEY = "scholarsprint_saved_scholarships";

let userProfile = null;
let rankedPool = [];
let shownIds = new Set();
let lastSummary = null;

export function initScholarshipMatch(profile) {
  userProfile = profile;

  document.getElementById("generateScholarshipsBtn")?.addEventListener("click", () =>
    generateScholarships(false),
  );
  document.getElementById("regenerateScholarshipsBtn")?.addEventListener("click", () =>
    generateScholarships(true),
  );
  document.getElementById("resetScholarshipFiltersBtn")?.addEventListener("click", resetFilters);

  updateSavedCount();
}

export function updateScholarshipProfile(profile) {
  userProfile = profile;
}

function getFilters() {
  return {
    category: document.getElementById("schFilterCategory")?.value || "any",
    amount: document.getElementById("schFilterAmount")?.value || "any",
    deadline: document.getElementById("schFilterDeadline")?.value || "any",
    effort: document.getElementById("schFilterEffort")?.value || "any",
    essay: document.getElementById("schFilterEssay")?.value || "any",
    grade: document.getElementById("schFilterGrade")?.value || "any",
    location: document.getElementById("schFilterLocation")?.value || "any",
    showBroad: document.getElementById("schShowBroad")?.checked || false,
  };
}

function resetFilters() {
  [
    "schFilterCategory",
    "schFilterAmount",
    "schFilterDeadline",
    "schFilterEffort",
    "schFilterEssay",
    "schFilterGrade",
    "schFilterLocation",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "any";
  });
  const broad = document.getElementById("schShowBroad");
  if (broad) broad.checked = false;
}

async function generateScholarships(regenerate) {
  const resultsEl = document.getElementById("scholarshipResults");
  const generateBtn = document.getElementById("generateScholarshipsBtn");
  const regenBtn = document.getElementById("regenerateScholarshipsBtn");
  if (!resultsEl) return;

  if (regenerate && rankedPool.length === 0) {
    return generateScholarships(false);
  }

  if (!regenerate) {
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating…";
    resultsEl.innerHTML = `
      <div class="match-loading">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <p>Searching scholarships that fit your profile…</p>
      </div>`;

    try {
      const res = await fetch("/api/scholarship-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: userProfile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      const filters = getFilters();
      rankedPool = scoreAndRankScholarships(data.scholarships || [], filters, userProfile);
      shownIds = new Set();

      if (rankedPool.length === 0) {
        document.getElementById("scholarshipSummary").innerHTML = "";
        resultsEl.innerHTML = `
          <p class="match-empty">No scholarships matched these filters. Try <strong>Reset Filters</strong> or enable <strong>Show broad matches</strong>.</p>`;
        if (regenBtn) regenBtn.style.display = "none";
        return;
      }
    } catch (err) {
      console.error("Scholarship search error:", err);
      resultsEl.innerHTML = `<p class="match-error">Could not load scholarships: ${escapeHtml(err.message)}</p>`;
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Matches";
      return;
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Matches";
    }
  }

  const available = rankedPool.filter((s) => !shownIds.has(s.id));
  const batch = available.slice(0, TOP_COUNT);
  batch.forEach((s) => shownIds.add(s.id));

  if (batch.length === 0) {
    resultsEl.innerHTML = `
      <p class="match-empty">No more matches with these filters. Try <strong>Reset Filters</strong> or enable <strong>Show broad matches</strong>.</p>`;
    if (regenBtn) regenBtn.style.display = "none";
    return;
  }

  lastSummary = buildSummary(rankedPool, batch);
  renderSummary(lastSummary);
  if (regenBtn) {
    regenBtn.style.display = available.length > batch.length ? "inline-flex" : "none";
  }

  resultsEl.innerHTML = batch.map(renderScholarshipCard).join("");
  bindCardActions(resultsEl);
}

function buildSummary(pool, batch) {
  const strong = pool.filter((s) => s.matchPercent >= 85).length;
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const deadlinesThisMonth = pool.filter((s) => {
    if (!s.deadline) return s.deadlineType === "rolling";
    const d = new Date(s.deadline);
    return d >= now && d <= monthEnd;
  }).length;

  const totalAward = batch.reduce((sum, s) => sum + (s.amountMin || 0), 0);

  return {
    totalFound: pool.length,
    showing: batch.length,
    strongMatches: strong,
    deadlinesThisMonth,
    potentialAwards: totalAward,
  };
}

function renderSummary(summary) {
  const el = document.getElementById("scholarshipSummary");
  if (!el || !summary) return;

  el.innerHTML = `
    <div class="summary-stats-grid">
      <div class="summary-stat-card">
        <div class="summary-stat-value">${summary.totalFound}</div>
        <div class="summary-stat-label">Matches Found</div>
      </div>
      <div class="summary-stat-card highlight">
        <div class="summary-stat-value">${summary.showing}</div>
        <div class="summary-stat-label">Showing Now</div>
      </div>
      <div class="summary-stat-card">
        <div class="summary-stat-value">${summary.strongMatches}</div>
        <div class="summary-stat-label">Strong Matches</div>
      </div>
      <div class="summary-stat-card">
        <div class="summary-stat-value">${summary.deadlinesThisMonth}</div>
        <div class="summary-stat-label">Due This Month</div>
      </div>
      <div class="summary-stat-card accent">
        <div class="summary-stat-value">${formatMoney(summary.potentialAwards)}</div>
        <div class="summary-stat-label">Potential Awards (batch)</div>
      </div>
    </div>`;
}

export function scoreAndRankScholarships(scholarships, filters, profile) {
  const studentGrade = inferStudentGrade(profile?.graduationYear);

  return scholarships
    .map((sch) => {
      const scored = scoreScholarship(sch, profile, studentGrade, filters);
      return { ...sch, ...scored };
    })
    .filter((sch) => passesFilters(sch, filters, studentGrade))
    .filter((sch) => filters.showBroad || sch.matchPercent >= 40)
    .sort((a, b) => {
      if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (da !== db) return da - db;
      return (b.amountMax || 0) - (a.amountMax || 0);
    });
}

function scoreScholarship(sch, profile, studentGrade, filters) {
  let score = 0;
  const reasons = [];
  const userGpa = Number(profile?.gpa) || 0;

  if (sch.minGpa && userGpa >= sch.minGpa) {
    score += 20;
    reasons.push("your GPA meets the requirement");
  } else if (sch.minGpa && userGpa >= sch.minGpa - 0.3) {
    score += 10;
    reasons.push("your GPA is close to the listed requirement");
  } else if (!sch.minGpa && userGpa >= 3.0) {
    score += 12;
    reasons.push("your academic profile is strong");
  }

  if (studentGrade && sch.gradeLevels?.includes(studentGrade)) {
    score += 15;
    reasons.push("your class year is eligible");
  } else if (sch.gradeLevels?.includes("Senior") && studentGrade === "Senior") {
    score += 15;
    reasons.push("you are eligible as a senior");
  }

  const major = (profile?.intendedMajor || "").toLowerCase();
  const categoryHit = sch.categories?.some((c) => {
    if (major.includes("computer") || major.includes("engineering")) return c === "STEM";
    if (major.includes("business")) return c === "Leadership" || c === "Career-Specific";
    return major && c.toLowerCase().includes(major.split(" ")[0]);
  });
  if (categoryHit || (filters.category !== "any" && sch.categories?.includes(filters.category))) {
    score += 15;
    reasons.push("your intended major and interests align with this award");
  } else if (major && sch.categories?.length) {
    score += 6;
  }

  const activityText = [
    ...(profile?.activities || []),
    profile?.leadershipRoles,
    profile?.volunteering,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/leadership|captain|president|founder/i.test(activityText) && sch.categories?.includes("Leadership")) {
    score += 15;
    reasons.push("your leadership activities stand out");
  } else if (/volunteer|service|community/i.test(activityText) && sch.categories?.includes("Community Service")) {
    score += 15;
    reasons.push("your service experience is a strong fit");
  } else if (profile?.activities?.length >= 2) {
    score += 8;
    reasons.push("your extracurricular profile adds depth");
  }

  const homeState = profile?.homeState;
  if (sch.locationScope === "Local" || sch.locationScope === "State") {
    if (homeState) {
      score += 10;
      reasons.push(`this award may be available in ${homeState}`);
    }
  } else if (sch.locationScope === "National") {
    score += 8;
  }

  const need = profile?.financialNeed;
  if (sch.needBased && ["full", "substantial", "some"].includes(need)) {
    score += 10;
    reasons.push("this need-based award fits your financial profile");
  } else if (!sch.needBased) {
    score += 5;
  }

  if (filters.essay === "no-essay" && !sch.essayRequired) {
    score += 5;
  } else if (filters.essay === "essay-required" && sch.essayRequired) {
    score += 5;
  } else if (filters.essay === "any") {
    score += 3;
  }

  if (sch.deadlineType === "rolling") {
    score += 10;
    reasons.push("rolling deadline gives you flexibility");
  } else if (sch.deadline && new Date(sch.deadline) > new Date()) {
    score += 10;
  }

  const matchPercent = Math.min(Math.round((score / 100) * 100), 98);
  const matchLabel = getMatchLabel(matchPercent);

  if (reasons.length === 0) {
    reasons.push("your overall student profile aligns with this opportunity");
  }

  return {
    matchPercent,
    matchLabel,
    matchReasons: reasons.slice(0, 3),
  };
}

function getMatchLabel(percent) {
  if (percent >= 85) return "Strong Match";
  if (percent >= 65) return "Good Match";
  if (percent >= 40) return "Partial Match";
  return "Low Match";
}

function passesFilters(sch, filters, studentGrade) {
  if (filters.category !== "any" && !sch.categories?.includes(filters.category)) {
    return false;
  }

  if (filters.amount !== "any") {
    const max = sch.amountMax || sch.amountMin || 0;
    const min = sch.amountMin || 0;
    if (filters.amount === "under-1k" && max >= 1000) return false;
    if (filters.amount === "1-5k" && (max < 1000 || min > 5000)) return false;
    if (filters.amount === "5-10k" && (max < 5000 || min > 10000)) return false;
    if (filters.amount === "10k-plus" && max < 10000) return false;
    if (filters.amount === "full-tuition" && max < 50000) return false;
  }

  if (filters.deadline !== "any") {
    const now = new Date();
    if (filters.deadline === "rolling" && sch.deadlineType !== "rolling") return false;
    if (filters.deadline !== "rolling" && sch.deadline) {
      const d = new Date(sch.deadline);
      const diffDays = (d - now) / (1000 * 60 * 60 * 24);
      if (filters.deadline === "week" && diffDays > 7) return false;
      if (filters.deadline === "month" && diffDays > 31) return false;
      if (filters.deadline === "3-months" && diffDays > 92) return false;
    }
  }

  if (filters.effort !== "any" && sch.effort?.toLowerCase() !== filters.effort) {
    return false;
  }

  if (filters.essay === "essay-required" && !sch.essayRequired) return false;
  if (filters.essay === "no-essay" && sch.essayRequired) return false;

  if (filters.grade !== "any" && studentGrade && !sch.gradeLevels?.includes(filters.grade)) {
    return false;
  }

  if (filters.location !== "any" && sch.locationScope !== filters.location) {
    if (!(filters.location === "State" && sch.locationScope === "Local")) return false;
  }

  return true;
}

function inferStudentGrade(graduationYear) {
  const year = Number(graduationYear);
  const now = new Date();
  const month = now.getMonth();
  const schoolYear = month >= 7 ? now.getFullYear() + 1 : now.getFullYear();

  if (year === schoolYear) return "Senior";
  if (year === schoolYear + 1) return "Junior";
  if (year === schoolYear + 2) return "Sophomore";
  if (year === schoolYear + 3) return "Freshman";
  if (year < schoolYear) return "College student";
  return "Senior";
}

function renderScholarshipCard(sch) {
  const labelClass =
    sch.matchLabel === "Strong Match"
      ? "high"
      : sch.matchLabel === "Good Match"
        ? "medium"
        : "partial";

  const saved = getSavedIds().includes(sch.id);
  const deadlineLabel = formatDeadline(sch);

  const tags = (sch.tags || sch.categories || [])
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  const reasons = sch.matchReasons
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join("");

  return `
    <article class="scholarship-card match-card ${labelClass}-match" data-id="${escapeHtml(sch.id)}">
      <div class="scholarship-header">
        <div>
          <h3>${escapeHtml(sch.name)}</h3>
          <p class="scholarship-sponsor">${escapeHtml(sch.sponsor)}</p>
        </div>
        <div class="match-score-block ${labelClass}">
          <span class="match-score-value">${sch.matchPercent}%</span>
          <span class="match-score-label">${escapeHtml(sch.matchLabel)}</span>
        </div>
      </div>
      <div class="scholarship-details">
        <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">${escapeHtml(sch.amountLabel)}</span></div>
        <div class="detail-row"><span class="detail-label">Deadline</span><span class="detail-value">${escapeHtml(deadlineLabel)}</span></div>
        <div class="detail-row"><span class="detail-label">Eligibility</span><span class="detail-value">${escapeHtml(sch.eligibility)}</span></div>
        <div class="detail-row"><span class="detail-label">Requirements</span><span class="detail-value">${escapeHtml(sch.requirements)}</span></div>
        <div class="detail-row"><span class="detail-label">Essay</span><span class="detail-value">${sch.essayRequired ? "Required" : "No essay"}</span></div>
        <div class="detail-row"><span class="detail-label">Effort</span><span class="detail-value">${escapeHtml(sch.effort || "Medium")}</span></div>
        <div class="detail-row"><span class="detail-label">Renewable</span><span class="detail-value">${sch.renewable ? "Yes" : "No"}</span></div>
      </div>
      <div class="scholarship-tags">${tags}</div>
      <div class="match-why">
        <strong>Why this matches:</strong>
        <ul>${reasons}</ul>
      </div>
      <div class="scholarship-actions">
        <a href="${escapeHtml(sch.url)}" target="_blank" rel="noopener" class="btn-primary btn-small">View Scholarship</a>
        <button type="button" class="btn-secondary btn-small save-sch-btn ${saved ? "saved" : ""}" data-save-id="${escapeHtml(sch.id)}">
          ${saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </article>`;
}

function bindCardActions(container) {
  container.querySelectorAll(".save-sch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-save-id");
      const card = container.querySelector(`[data-id="${id}"]`);
      const sch = rankedPool.find((s) => s.id === id);
      if (!sch) return;
      toggleSave(sch);
      btn.classList.toggle("saved", getSavedIds().includes(id));
      btn.textContent = getSavedIds().includes(id) ? "Saved ✓" : "Save";
      updateSavedCount();
    });
  });
}

function getSavedIds() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

function getSavedScholarships() {
  try {
    return JSON.parse(localStorage.getItem(`${SAVED_KEY}_data`) || "[]");
  } catch {
    return [];
  }
}

function toggleSave(sch) {
  const ids = getSavedIds();
  const data = getSavedScholarships();
  const idx = ids.indexOf(sch.id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    const dataIdx = data.findIndex((s) => s.id === sch.id);
    if (dataIdx >= 0) data.splice(dataIdx, 1);
  } else {
    ids.push(sch.id);
    data.push({ id: sch.id, name: sch.name, url: sch.url, amountLabel: sch.amountLabel });
  }
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  localStorage.setItem(`${SAVED_KEY}_data`, JSON.stringify(data));
}

function updateSavedCount() {
  const el = document.getElementById("trackerSavedCount");
  if (el) el.textContent = String(getSavedIds().length);
}

function formatDeadline(sch) {
  if (sch.deadlineType === "rolling") return "Rolling deadline";
  if (!sch.deadline) return "See official site";
  const d = new Date(sch.deadline);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatMoney(n) {
  if (n >= 1000) return `$${Math.round(n / 1000)}K+`;
  return `$${n.toLocaleString()}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

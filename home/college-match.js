const REGION_STATES = {
  Midwest: ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
  Northeast: ["CT", "ME", "MA", "NH", "NJ", "NY", "PA", "RI", "VT"],
  South: [
    "AL", "AR", "DE", "FL", "GA", "KY", "LA", "MD", "MS", "NC", "OK", "SC", "TN",
    "TX", "VA", "WV", "DC",
  ],
  "West Coast": ["CA", "OR", "WA", "AK", "HI", "AZ", "NV"],
};

const LOCALE_SETTING = {
  urban: [11, 12],
  suburban: [13, 21],
  rural: [22, 23, 31, 32, 33, 41, 42, 43],
};

let userProfile = null;

export function initCollegeMatch(profile) {
  userProfile = profile;

  const btn = document.getElementById("generateMatchesBtn");
  if (!btn) return;

  btn.addEventListener("click", generateMatches);

  document.querySelectorAll("[data-goto-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      const tabId = el.getAttribute("data-goto-tab");
      if (tabId) navigateToTab(tabId);
    });
  });
}

export function navigateToTab(tabId) {
  const tab = document.getElementById(tabId);
  if (tab) tab.checked = true;
}

function getFilterValues() {
  return {
    collegeType: document.getElementById("filterCollegeType")?.value || "any",
    location: document.getElementById("filterLocation")?.value || "any",
    tuition: document.getElementById("filterTuition")?.value || "any",
    size: document.getElementById("filterSize")?.value || "any",
    selectivity: document.getElementById("filterSelectivity")?.value || "any",
    testPolicy: document.getElementById("filterTestPolicy")?.value || "no-preference",
  };
}

async function generateMatches() {
  const container = document.getElementById("collegeMatchResults");
  const btn = document.getElementById("generateMatchesBtn");
  if (!container || !btn) return;

  const filters = getFilterValues();
  const homeState = (userProfile?.homeState || "IL").toUpperCase();

  btn.disabled = true;
  btn.textContent = "Generating…";
  container.innerHTML = `
    <div class="match-loading">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <p>Finding colleges that match your criteria…</p>
    </div>`;

  try {
    const query = new URLSearchParams({
      collegeType: filters.collegeType,
      location: filters.location,
      tuition: filters.tuition,
      size: filters.size,
      homeState,
    });

    const res = await fetch(`/api/college-match?${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    let schools = data.results || [];
    schools = applyClientFilters(schools, filters, homeState);
    schools = schools
      .map((school) => {
        const likelihood = calculateAdmissionLikelihood(school, userProfile);
        const selectivityCategory = getSelectivityCategory(school, likelihood);
        return {
          ...school,
          likelihood,
          selectivityCategory,
          matchReasons: buildMatchReasons(school, filters, homeState),
        };
      })
      .filter((school) =>
        filters.selectivity === "any"
          ? true
          : school.selectivityCategory === filters.selectivity,
      );

    schools.sort((a, b) => b.likelihood - a.likelihood);

    if (schools.length === 0) {
      container.innerHTML = `
        <p class="match-empty">
          No exact matches found. Try selecting <strong>Any</strong> for one or two filters to see more options.
        </p>`;
      return;
    }

    container.innerHTML = schools.map(renderMatchCard).join("");
  } catch (err) {
    console.error("College match error:", err);
    container.innerHTML = `
      <p class="match-error">Could not load matches: ${escapeHtml(err.message)}</p>
      <p class="match-error-sub">Make sure COLLEGE_SCORECARD_API_KEY is set in your Netlify environment variables.</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate Matches";
  }
}

function applyClientFilters(schools, filters, homeState) {
  return schools.filter((school) => {
    if (filters.collegeType === "community" && school.degreesPredominant !== 2) {
      return false;
    }

    if (filters.location === "urban" || filters.location === "suburban" || filters.location === "rural") {
      const allowed = LOCALE_SETTING[filters.location] || [];
      if (school.locale != null && !allowed.includes(school.locale)) return false;
    }

    if (filters.location === "in-state" && school.state !== homeState) return false;
    if (filters.location === "out-of-state" && school.state === homeState) return false;

    if (filters.tuition !== "any") {
      const tuition = school.outOfStateTuition ?? school.inStateTuition;
      if (tuition == null || !tuitionMatches(tuition, filters.tuition)) return false;
    }

    if (filters.size !== "any") {
      const category = getSizeCategory(school.studentSize);
      const expected =
        filters.size === "small" ? "Small" : filters.size === "medium" ? "Medium" : "Large";
      if (category !== expected) return false;
    }

    if (filters.testPolicy === "test-optional" && school.testPolicy !== "Test optional") {
      return false;
    }
    if (filters.testPolicy === "test-required" && school.testPolicy !== "Test required") {
      return false;
    }

    return true;
  });
}

function tuitionMatches(tuition, rangeKey) {
  if (rangeKey === "under-15k") return tuition < 15000;
  if (rangeKey === "15-30k") return tuition >= 15000 && tuition <= 30000;
  if (rangeKey === "30-50k") return tuition > 30000 && tuition <= 50000;
  if (rangeKey === "50k-plus") return tuition > 50000;
  return true;
}

function getSizeCategory(size) {
  if (size == null) return "Unknown";
  if (size < 5000) return "Small";
  if (size <= 15000) return "Medium";
  return "Large";
}

function getTuitionRangeLabel(school) {
  const tuition = school.outOfStateTuition ?? school.inStateTuition;
  if (tuition == null) return "N/A";
  if (tuition < 15000) return "Under $15,000/year";
  if (tuition <= 30000) return "$15,000–$30,000/year";
  if (tuition <= 50000) return "$30,000–$50,000/year";
  return "$50,000+/year";
}

function getRegionForState(state) {
  if (!state) return null;
  for (const [region, states] of Object.entries(REGION_STATES)) {
    if (states.includes(state)) return region;
  }
  return null;
}

function getLocaleLabel(locale) {
  if (locale == null) return null;
  if (LOCALE_SETTING.urban.includes(locale)) return "Urban";
  if (LOCALE_SETTING.suburban.includes(locale)) return "Suburban";
  if (LOCALE_SETTING.rural.includes(locale)) return "Rural";
  return null;
}

/**
 * Estimates admission likelihood from the student's academics vs. school selectivity.
 */
export function calculateAdmissionLikelihood(school, profile) {
  const userGpa = Number(profile?.gpa) || 3.5;
  const userSat = profile?.sat ? Number(profile.sat) : null;
  const userAct = profile?.act ? Number(profile.act) : null;
  const admitRate = school.admissionRate ?? 0.5;

  let academicScore = 50;

  const schoolSat = school.satAvg ? Number(school.satAvg) : null;
  const schoolAct = school.actMidpoint ? Number(school.actMidpoint) : null;

  if (userSat && schoolSat) {
    academicScore += ((userSat - schoolSat) / 50) * 12;
  } else if (userAct && schoolAct) {
    academicScore += (userAct - schoolAct) * 5;
  }

  const selectivityOffset = (0.5 - admitRate) * 40;
  academicScore -= selectivityOffset;

  if (userGpa >= 3.9 && admitRate < 0.15) academicScore += 8;
  else if (userGpa >= 3.7 && admitRate < 0.3) academicScore += 5;
  else if (userGpa < 3.2 && admitRate < 0.4) academicScore -= 12;

  const baseChance = Math.min(admitRate * 100 * 1.15, 92);
  let likelihood = academicScore * 0.62 + baseChance * 0.38;

  if (admitRate < 0.1) likelihood = Math.min(likelihood, 38);
  if (admitRate < 0.05) likelihood = Math.min(likelihood, 22);

  if (userSat && schoolSat && userSat >= schoolSat + 80) likelihood += 8;
  if (userSat && schoolSat && userSat <= schoolSat - 100) likelihood -= 15;

  return Math.round(clamp(likelihood, 3, 97));
}

function getSelectivityCategory(school, likelihood) {
  const admitRate = school.admissionRate;
  if (admitRate != null && admitRate < 0.1) return "Highly Selective";
  if (likelihood >= 65) return "Safety";
  if (likelihood >= 35) return "Target/Match";
  return "Reach";
}

function buildMatchReasons(school, filters, homeState) {
  const reasons = [];

  if (filters.collegeType !== "any") {
    const typeLabel =
      filters.collegeType === "public"
        ? "Public"
        : filters.collegeType === "private"
          ? "Private"
          : "Community College";
    if (
      (filters.collegeType === "public" && school.ownership === "Public") ||
      (filters.collegeType === "private" && school.ownership === "Private") ||
      (filters.collegeType === "community" && school.degreesPredominant === 2)
    ) {
      reasons.push(`Matches your ${typeLabel.toLowerCase()} preference`);
    }
  }

  if (filters.location === "in-state" && school.state === homeState) {
    reasons.push(`In-state option in ${school.state}`);
  } else if (filters.location === "out-of-state" && school.state !== homeState) {
    reasons.push(`Out-of-state school in ${school.state}`);
  } else if (REGION_STATES[filters.location]?.includes(school.state)) {
    reasons.push(`Located in the ${filters.location}`);
  } else if (["urban", "suburban", "rural"].includes(filters.location)) {
    const setting = getLocaleLabel(school.locale);
    if (setting) reasons.push(`${setting} campus setting`);
  }

  if (filters.tuition !== "any") {
    reasons.push(`Fits your ${getTuitionRangeLabel(school).toLowerCase()} budget`);
  }

  if (filters.size !== "any") {
    reasons.push(`${getSizeCategory(school.studentSize)} school size`);
  }

  if (userProfile?.intendedMajor && school.strongMajors?.length) {
    const major = userProfile.intendedMajor.toLowerCase();
    const matched = school.strongMajors.find((m) =>
      major.includes(m.toLowerCase()) || m.toLowerCase().includes(major.split(" ")[0]),
    );
    if (matched) reasons.push(`Strong ${matched} program`);
  }

  if (reasons.length === 0) {
    reasons.push("Aligns with your selected preferences and academic profile");
  }

  return reasons;
}

function getLikelihoodClass(likelihood) {
  if (likelihood >= 65) return "high";
  if (likelihood >= 35) return "medium";
  return "low";
}

function renderMatchCard(school) {
  const location = [school.city, school.state].filter(Boolean).join(", ") || "Unknown";
  const majors =
    school.strongMajors?.length > 0
      ? school.strongMajors.join(", ")
      : "General programs";

  const reasonsHtml = school.matchReasons
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join("");

  const websiteLink = school.url
    ? `<a href="https://${school.url}" target="_blank" rel="noopener" class="college-link">Visit Website →</a>`
    : "";

  return `
    <article class="match-result-card">
      <div class="match-result-header">
        <div class="likelihood-badge ${getLikelihoodClass(school.likelihood)}">
          <span class="likelihood-value">${school.likelihood}%</span>
          <span class="likelihood-label">Admission Likelihood</span>
        </div>
        <div class="match-result-title">
          <h3>${escapeHtml(school.name)}</h3>
          <p class="college-location">📍 ${escapeHtml(location)} · ${escapeHtml(school.ownership)}</p>
        </div>
      </div>
      <div class="match-result-grid">
        <div class="match-detail">
          <span class="match-detail-label">Tuition</span>
          <span class="match-detail-value">${escapeHtml(getTuitionRangeLabel(school))}</span>
        </div>
        <div class="match-detail">
          <span class="match-detail-label">Size</span>
          <span class="match-detail-value">${escapeHtml(getSizeCategory(school.studentSize))}</span>
        </div>
        <div class="match-detail">
          <span class="match-detail-label">Selectivity</span>
          <span class="match-detail-value">${escapeHtml(school.selectivityCategory)}</span>
        </div>
        <div class="match-detail">
          <span class="match-detail-label">Test Policy</span>
          <span class="match-detail-value">${escapeHtml(school.testPolicy)}</span>
        </div>
      </div>
      <div class="match-majors">
        <strong>Strong programs:</strong> ${escapeHtml(majors)}
      </div>
      <div class="match-why">
        <strong>Why it matches:</strong>
        <ul>${reasonsHtml}</ul>
      </div>
      ${websiteLink}
    </article>`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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

const TOP_MATCH_COUNT = 5;
const MIN_MATCH_QUALITY = 56;

const LEADERSHIP_KEYWORDS =
  /\b(president|captain|founder|co-founder|chair|director|lead|leader|officer|head|editor-in-chief|manager|vice|treasurer|secretary)\b/i;

const MAJOR_EC_KEYWORDS = {
  engineering: /\b(robotics|engineering|stem|coding|programming|science olympiad|math team|physics)\b/i,
  "computer science": /\b(coding|programming|robotics|hackathon|computer|software|cyber|stem)\b/i,
  business: /\b(deca|fbla|business|entrepreneur|finance|marketing|economics)\b/i,
  "pre-med": /\b(hosa|research|hospital|volunteer|biology|science fair|shadowing|medical)\b/i,
  health: /\b(hosa|hospital|volunteer|medical|nursing|health)\b/i,
  nursing: /\b(hosa|hospital|volunteer|medical|nursing|health)\b/i,
  biology: /\b(research|science fair|biology|ecology|environmental)\b/i,
  journalism: /\b(newspaper|journalism|debate|yearbook|broadcast|media|writing)\b/i,
  film: /\b(film|theater|drama|video|production|media|broadcast)\b/i,
  music: /\b(band|orchestra|choir|music|theater|drama)\b/i,
  education: /\b(tutoring|mentor|teaching|coach|camp counselor)\b/i,
  psychology: /\b(psychology|research|volunteer|peer counseling)\b/i,
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
      <p>Analyzing your full profile and finding your strongest college matches…</p>
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

    const profileStrength = analyzeProfileStrength(userProfile);

    let schools = (data.results || [])
      .filter((school) => applyClientFilters([school], filters, homeState).length > 0)
      .map((school) => {
        const breakdown = calculateHolisticAdmissionLikelihood(
          school,
          userProfile,
          profileStrength,
        );
        const selectivityCategory = getSelectivityCategory(
          school,
          breakdown.likelihood,
        );
        const filterScore = scoreFilterAlignment(school, filters, homeState);
        const popularity = calculateSchoolPopularity(school);
        const matchQuality = Math.round(
          breakdown.likelihood * 0.68 +
            filterScore * 0.2 +
            popularity * 0.12,
        );

        return {
          ...school,
          likelihood: breakdown.likelihood,
          profileBreakdown: breakdown,
          selectivityCategory,
          matchQuality,
          popularity,
          matchReasons: buildMatchReasons(
            school,
            filters,
            homeState,
            breakdown,
            profileStrength,
          ),
        };
      })
      .filter((school) =>
        filters.selectivity === "any"
          ? true
          : school.selectivityCategory === filters.selectivity,
      )
      .filter((school) => school.matchQuality >= MIN_MATCH_QUALITY)
      .sort((a, b) => {
        if (b.matchQuality !== a.matchQuality) {
          return b.matchQuality - a.matchQuality;
        }
        return b.popularity - a.popularity;
      });

    const topMatches = schools.slice(0, TOP_MATCH_COUNT);

    if (topMatches.length === 0) {
      container.innerHTML = `
        <p class="match-empty">
          No strong matches found for this exact filter set. Try selecting <strong>Any</strong> for one or two filters to see more options.
        </p>`;
      return;
    }

    const countLabel =
      topMatches.length === 1
        ? "1 Top Match"
        : `${topMatches.length} Top Matches`;

    const noteHtml =
      topMatches.length < TOP_MATCH_COUNT
        ? `<p class="match-results-note">Showing ${topMatches.length} high-quality match${topMatches.length === 1 ? "" : "es"} that meet your criteria. Loosen a filter to discover more.</p>`
        : `<p class="match-results-note">Your ${TOP_MATCH_COUNT} strongest fits — ranked by full-profile admission likelihood, filter alignment, and school recognition.</p>`;

    container.innerHTML = `
      <div class="match-results-header">
        <h2>${countLabel}</h2>
        ${noteHtml}
      </div>
      ${topMatches.map(renderMatchCard).join("")}`;
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

    if (
      filters.location === "urban" ||
      filters.location === "suburban" ||
      filters.location === "rural"
    ) {
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
        filters.size === "small"
          ? "Small"
          : filters.size === "medium"
            ? "Medium"
            : "Large";
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

/**
 * Rule-based extracurricular & profile strength analysis (no AI).
 * Mirrors how admissions offices scan for leadership, depth, service, and spike.
 */
export function analyzeProfileStrength(profile) {
  const activities = profile?.activities || [];
  const combinedText = [
    profile?.leadershipRoles,
    profile?.awards,
    profile?.volunteering,
    ...activities,
  ]
    .filter(Boolean)
    .join(" ");

  const leadershipHits = (combinedText.match(LEADERSHIP_KEYWORDS) || []).length;
  const leadershipScore = clamp(10 + leadershipHits * 8, 0, 30);

  const awardsList = splitListItems(profile?.awards);
  const awardsScore = clamp(awardsList.length * 7, 0, 20);

  const serviceScore = scoreVolunteering(profile?.volunteering);

  const rolesCount = activities.filter((a) => LEADERSHIP_KEYWORDS.test(a)).length;
  const depthScore = clamp(
    Math.min(activities.length, 5) * 3 + rolesCount * 4,
    0,
    20,
  );

  const major = (profile?.intendedMajor || "").toLowerCase();
  const majorPattern = findMajorPattern(major);
  const majorAligned =
    majorPattern && majorPattern.test(combinedText) ? 15 : activities.length >= 2 ? 6 : 0;

  const apCount = Number(profile?.apCourses) || 0;
  const rigorScore =
    apCount >= 8 ? 100 : apCount >= 6 ? 85 : apCount >= 4 ? 70 : apCount >= 2 ? 50 : 25;

  const total = leadershipScore + awardsScore + serviceScore + depthScore + majorAligned;

  return {
    total: clamp(total, 0, 100),
    leadershipScore,
    awardsScore,
    serviceScore,
    depthScore,
    majorAligned,
    rigorScore,
    highlights: buildProfileHighlights({
      leadershipScore,
      awardsScore,
      serviceScore,
      depthScore,
      majorAligned,
      rigorScore,
      apCount,
    }),
  };
}

function buildProfileHighlights(scores) {
  const highlights = [];
  if (scores.leadershipScore >= 18) highlights.push("leadership");
  if (scores.awardsScore >= 10) highlights.push("awards");
  if (scores.serviceScore >= 10) highlights.push("service");
  if (scores.majorAligned >= 12) highlights.push("major-aligned activities");
  if (scores.rigorScore >= 70) highlights.push("strong course rigor");
  if (scores.depthScore >= 14) highlights.push("sustained extracurricular depth");
  return highlights;
}

function scoreVolunteering(text) {
  if (!text?.trim()) return 0;
  let score = 8;
  const hoursMatch = text.match(/(\d{2,4})\+?\s*(hours|hrs)/i);
  if (hoursMatch) {
    const hours = Number(hoursMatch[1]);
    if (hours >= 100) score += 7;
    else if (hours >= 50) score += 5;
    else if (hours >= 20) score += 3;
  }
  if (/\b(weekly|year-round|ongoing|tutor|mentor|community)\b/i.test(text)) score += 3;
  return clamp(score, 0, 15);
}

function splitListItems(text) {
  if (!text?.trim()) return [];
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMajorPattern(major) {
  if (!major) return null;
  for (const [key, pattern] of Object.entries(MAJOR_EC_KEYWORDS)) {
    if (major.includes(key)) return pattern;
  }
  return null;
}

function calculateAcademicFit(school, profile) {
  const userGpa = Number(profile?.gpa) || 3.5;
  const userSat = profile?.sat ? Number(profile.sat) : null;
  const userAct = profile?.act ? Number(profile.act) : null;
  const admitRate = school.admissionRate ?? 0.5;

  let score = 50;
  const schoolSat = school.satAvg ? Number(school.satAvg) : null;
  const schoolAct = school.actMidpoint ? Number(school.actMidpoint) : null;

  if (userSat && schoolSat) {
    score += ((userSat - schoolSat) / 50) * 14;
  } else if (userAct && schoolAct) {
    score += (userAct - schoolAct) * 5;
  }

  score += (userGpa - 3.5) * 18;
  score -= (0.5 - admitRate) * 35;

  const baseChance = Math.min(admitRate * 100 * 1.1, 90);
  return clamp(score * 0.62 + baseChance * 0.38, 5, 95);
}

function calculateMajorFit(school, profile) {
  const major = (profile?.intendedMajor || "").toLowerCase();
  if (!major || !school.strongMajors?.length) return 45;

  const matched = school.strongMajors.find(
    (m) =>
      major.includes(m.toLowerCase()) ||
      m.toLowerCase().includes(major.split(" ")[0]),
  );
  if (matched) return 88;

  const alt = (profile?.alternativeMajors || "").toLowerCase();
  if (alt && school.strongMajors.some((m) => alt.includes(m.toLowerCase()))) {
    return 68;
  }

  return 40;
}

/**
 * Holistic likelihood without AI:
 * academics 45%, EC strength 30%, major fit 15%, course rigor 10%.
 * EC weight increases slightly at more selective schools.
 */
export function calculateHolisticAdmissionLikelihood(
  school,
  profile,
  profileStrength = analyzeProfileStrength(profile),
) {
  const academicFit = calculateAcademicFit(school, profile);
  const majorFit = calculateMajorFit(school, profile);
  const admitRate = school.admissionRate ?? 0.5;

  const selectivityBoost =
    admitRate < 0.1 ? 1.25 : admitRate < 0.2 ? 1.15 : admitRate < 0.35 ? 1.05 : 1;
  const ecContribution = clamp(
    profileStrength.total * selectivityBoost,
    0,
    100,
  );

  let likelihood =
    academicFit * 0.45 +
    ecContribution * 0.3 +
    majorFit * 0.15 +
    profileStrength.rigorScore * 0.1;

  if (admitRate < 0.1) likelihood = Math.min(likelihood, 42);
  if (admitRate < 0.05) likelihood = Math.min(likelihood, 28);

  if (profileStrength.total >= 70 && admitRate < 0.25) likelihood += 6;
  if (profileStrength.total < 35 && admitRate < 0.3) likelihood -= 8;

  return {
    likelihood: Math.round(clamp(likelihood, 3, 97)),
    academicFit: Math.round(academicFit),
    ecContribution: Math.round(ecContribution),
    majorFit: Math.round(majorFit),
    rigorScore: Math.round(profileStrength.rigorScore),
    highlights: profileStrength.highlights,
  };
}

/** Recognition proxy: selective + larger enrollment schools rank higher among equal fits. */
function calculateSchoolPopularity(school) {
  const admitRate = school.admissionRate ?? 0.5;
  const size = school.studentSize ?? 5000;
  const prestige = (1 - admitRate) * 70;
  const scale = Math.min(Math.log10(Math.max(size, 500)) * 18, 30);
  return clamp(Math.round(prestige + scale), 0, 100);
}

function scoreFilterAlignment(school, filters, homeState) {
  let score = 55;
  let activeFilters = 0;

  if (filters.collegeType !== "any") {
    activeFilters += 1;
    if (
      (filters.collegeType === "public" && school.ownership === "Public") ||
      (filters.collegeType === "private" && school.ownership === "Private") ||
      (filters.collegeType === "community" && school.degreesPredominant === 2)
    ) {
      score += 12;
    }
  }

  if (filters.location !== "any") {
    activeFilters += 1;
    if (filters.location === "in-state" && school.state === homeState) score += 12;
    else if (filters.location === "out-of-state" && school.state !== homeState) score += 12;
    else if (REGION_STATES[filters.location]?.includes(school.state)) score += 12;
    else if (["urban", "suburban", "rural"].includes(filters.location)) {
      const setting = getLocaleLabel(school.locale);
      if (setting?.toLowerCase() === filters.location) score += 12;
    }
  }

  if (filters.tuition !== "any") {
    activeFilters += 1;
    const tuition = school.outOfStateTuition ?? school.inStateTuition;
    if (tuition != null && tuitionMatches(tuition, filters.tuition)) score += 10;
  }

  if (filters.size !== "any") {
    activeFilters += 1;
    const expected =
      filters.size === "small"
        ? "Small"
        : filters.size === "medium"
          ? "Medium"
          : "Large";
    if (getSizeCategory(school.studentSize) === expected) score += 10;
  }

  if (filters.testPolicy !== "no-preference") {
    activeFilters += 1;
    if (
      (filters.testPolicy === "test-optional" &&
        school.testPolicy === "Test optional") ||
      (filters.testPolicy === "test-required" &&
        school.testPolicy === "Test required")
    ) {
      score += 8;
    }
  }

  if (activeFilters === 0) score = 70;
  return clamp(score, 0, 100);
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

function getLocaleLabel(locale) {
  if (locale == null) return null;
  if (LOCALE_SETTING.urban.includes(locale)) return "Urban";
  if (LOCALE_SETTING.suburban.includes(locale)) return "Suburban";
  if (LOCALE_SETTING.rural.includes(locale)) return "Rural";
  return null;
}

function getSelectivityCategory(school, likelihood) {
  const admitRate = school.admissionRate;
  if (admitRate != null && admitRate < 0.1) return "Highly Selective";
  if (likelihood >= 65) return "Safety";
  if (likelihood >= 35) return "Target/Match";
  return "Reach";
}

function buildMatchReasons(school, filters, homeState, breakdown, profileStrength) {
  const reasons = [];

  if (breakdown.academicFit >= 60) {
    reasons.push("Academic profile aligns well with typical admitted students");
  } else if (breakdown.academicFit >= 45) {
    reasons.push("Academic stats are competitive for this school");
  }

  if (profileStrength.highlights.length > 0) {
    reasons.push(
      `Holistic strengths: ${profileStrength.highlights.slice(0, 2).join(" and ")}`,
    );
  }

  if (breakdown.majorFit >= 75) {
    reasons.push("Strong program match for your intended major");
  }

  if (filters.location === "in-state" && school.state === homeState) {
    reasons.push(`In-state option in ${school.state}`);
  } else if (filters.location === "out-of-state" && school.state !== homeState) {
    reasons.push(`Out-of-state school in ${school.state}`);
  } else if (REGION_STATES[filters.location]?.includes(school.state)) {
    reasons.push(`Located in the ${filters.location}`);
  }

  if (filters.tuition !== "any") {
    reasons.push(`Fits your ${getTuitionRangeLabel(school).toLowerCase()} budget`);
  }

  if (reasons.length === 0) {
    reasons.push("Strong overall fit based on your full student profile");
  }

  return reasons.slice(0, 4);
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

  const breakdown = school.profileBreakdown;
  const factorsHtml = breakdown
    ? `
      <div class="match-factors">
        <span>Academics ${breakdown.academicFit}%</span>
        <span>Activities ${breakdown.ecContribution}%</span>
        <span>Major fit ${breakdown.majorFit}%</span>
        <span>Rigor ${breakdown.rigorScore}%</span>
      </div>`
    : "";

  const websiteLink = school.url
    ? `<a href="https://${school.url}" target="_blank" rel="noopener" class="college-link">Visit Website →</a>`
    : "";

  return `
    <article class="match-result-card">
      <div class="match-result-header">
        <div class="likelihood-badge ${getLikelihoodClass(school.likelihood)}">
          <span class="likelihood-value">${school.likelihood}%</span>
          <span class="likelihood-label">Holistic Likelihood</span>
        </div>
        <div class="match-result-title">
          <h3>${escapeHtml(school.name)}</h3>
          <p class="college-location">📍 ${escapeHtml(location)} · ${escapeHtml(school.ownership)}</p>
        </div>
      </div>
      ${factorsHtml}
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

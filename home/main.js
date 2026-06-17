// main.js
import { getUserProfile } from "./firebase-config.js";
import { initCollegeMatch, updateCollegeMatchProfile } from "./college-match.js";
import { initSettings } from "./settings.js";
import { initObjectives } from "./objectives.js";
import { initRoadmap, updateRoadmapProfile } from "./roadmap.js";
import { initScholarshipMatch, updateScholarshipProfile } from "./scholarship-match.js";

// ─── Bootstrap ───────────────────────────────────────────────────────────────

let userProfile = null;

async function refreshUserProfile() {
  userProfile = await getUserProfile();
  populateProfile(userProfile);
  updateCollegeMatchProfile(userProfile);
  updateRoadmapProfile(() => userProfile);
  updateScholarshipProfile(userProfile);
}

(async () => {
  await refreshUserProfile();
  await initObjectives();
  initCollegeSearch();
  initStrategyAssistant();
  initCollegeMatch(userProfile);
  initSettings(refreshUserProfile);
  initRoadmap(() => userProfile);
  initScholarshipMatch(userProfile);
})();

// ─── Profile Population ───────────────────────────────────────────────────────

function populateProfile(p) {
  // Home tab
  setText("displayUnweightedGPAHome", p.gpa ?? "—");
  setText("displaySATHome", p.sat ?? "—");

  // Determine application season from graduation year
  const season = p.graduationYear
    ? `${Number(p.graduationYear) - 1}–${p.graduationYear}`
    : "2025–2026";
  setText("applicationSeason", season);

  // Profile tab
  setText("displayUnweightedGPA", p.gpa ?? "—");
  setText("displayWeightedGPA", p.weightedGpa ?? "—");
  setText("displayAP", p.apCourses != null ? `${p.apCourses} courses` : "—");
  setText("displaySAT", p.sat ?? "—");
  setText("displayACT", p.act ?? "—");
  setText("intendedMajor", p.intendedMajor || "—");
  setText("alternativeMajor", p.alternativeMajors || "—");
  setText("careerGoals", p.careerGoals || "—");
  setText("preferredLocations", p.preferredLocations || "—");

  // Activities list
  const actEl = document.getElementById("activitiesList");
  if (actEl) {
    const activities = Array.isArray(p.activities)
      ? p.activities
      : p.activities
        ? p.activities.split(",").map((a) => a.trim())
        : [];

    if (activities.length > 0) {
      actEl.innerHTML = activities
        .map(
          (act, i) => `
          <div class="activity-item">
            <span class="activity-number">${i + 1}</span>
            <span class="activity-name">${escapeHtml(act)}</span>
          </div>`,
        )
        .join("");
    } else {
      actEl.innerHTML = `<p class="placeholder-text">No activities on file. Add them in your profile settings.</p>`;
    }
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Application Strategy Assistant ──────────────────────────────────────────

function initStrategyAssistant() {
  const btn = document.getElementById("analyzeButton");
  const output = document.getElementById("asssistantFeedback"); // note: 3 s's in HTML

  if (!btn || !output) return;

  // Clear the initial "Loading..." text
  output.textContent =
    "Click Analyze to get personalized advice based on your profile.";
  output.className = "assistant-placeholder";

  btn.addEventListener("click", async () => {
    if (!userProfile) {
      output.innerHTML = `<p class="error-text">Profile not loaded yet. Please wait a moment and try again.</p>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Analyzing...";
    output.className = "assistant-loading";
    output.innerHTML = `
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
      <p>Analyzing your profile with AI…</p>`;

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: userProfile }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      output.className = "assistant-result";
      output.innerHTML = formatAdvice(data.advice);
    } catch (err) {
      console.error("Gemini error:", err);
      output.className = "assistant-error";
      output.innerHTML = `
        <p class="error-text">⚠️ Could not load advice: ${escapeHtml(err.message)}</p>
        <p class="error-subtext">Check that your GEMINI_API_KEY is set in Netlify environment variables.</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Analyze";
    }
  });
}

/**
 * Parses the AI response into structured section cards.
 * Detects the 4 sections from the prompt and renders each as its own card.
 */
function formatAdvice(text) {
  // Map section keywords to icons and labels
  const sectionDefs = [
    { key: "overall profile strength", icon: "📊", label: "Profile Strength" },
    { key: "top recommendations", icon: "🎯", label: "Top Recommendations" },
    {
      key: "college list strategy",
      icon: "🏫",
      label: "College List Strategy",
    },
    { key: "one key strength", icon: "⭐", label: "Key Strength to Highlight" },
  ];

  // Split the raw text into sections by detecting numbered headers or bold titles
  const sections = parseSections(text, sectionDefs);

  if (sections.length === 0) {
    // Fallback: just render as plain paragraphs
    return text
      .split("\n")
      .filter((l) => l.trim())
      .map(
        (l) =>
          `<div class="advice-card"><p class="advice-card-body">${inlineBold(l.trim())}</p></div>`,
      )
      .join("");
  }

  return sections
    .map(({ icon, label, lines }) => {
      const bodyHtml = lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return "";
          if (
            trimmed.startsWith("- ") ||
            trimmed.startsWith("* ") ||
            /^\d+\.\s/.test(trimmed)
          ) {
            const content = trimmed.replace(/^[-*\d]+\.?\s*/, "");
            return `<div class="advice-bullet-item">${inlineBold(content)}</div>`;
          }
          return `<p class="advice-card-body">${inlineBold(trimmed)}</p>`;
        })
        .join("");

      return `
      <div class="advice-card">
        <div class="advice-card-title">
          <span class="advice-icon">${icon}</span>
          ${escapeHtml(label)}
        </div>
        ${bodyHtml}
      </div>`;
    })
    .join("");
}

/**
 * Splits raw text into sections matching the prompt structure.
 */
function parseSections(text, defs) {
  const lines = text.split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    const stripped = line
      .replace(/\*\*/g, "")
      .replace(/^#+\s*/, "")
      .replace(/^\d+\.\s*/, "")
      .toLowerCase()
      .trim();

    const matched = defs.find((d) => stripped.includes(d.key));
    if (matched) {
      if (current) sections.push(current);
      current = { icon: matched.icon, label: matched.label, lines: [] };
    } else if (current && line.trim()) {
      current.lines.push(line);
    }
  }

  if (current) sections.push(current);
  return sections;
}

function inlineBold(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// ─── College Search ───────────────────────────────────────────────────────────

function initCollegeSearch() {
  const btn = document.getElementById("searchButton");
  const input = document.getElementById("collegeSearch");
  const results = document.getElementById("collegeResults");

  if (!btn || !input || !results) return;

  const doSearch = () => {
    const q = input.value.trim();
    if (q.length < 2) {
      results.innerHTML = `<p class="search-hint">Enter at least 2 characters to search.</p>`;
      return;
    }
    fetchColleges(q, results);
  };

  btn.addEventListener("click", doSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

async function fetchColleges(query, container) {
  container.innerHTML = `
    <div class="search-loading">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <p>Searching colleges…</p>
    </div>`;

  try {
    const res = await fetch(
      `/api/college-search?q=${encodeURIComponent(query)}`,
    );
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    if (!data.results || data.results.length === 0) {
      container.innerHTML = `<p class="search-no-results">No colleges found for "<strong>${escapeHtml(query)}</strong>". Try a different name.</p>`;
      return;
    }

    container.innerHTML = data.results.map(renderCollegeCard).join("");
  } catch (err) {
    console.error("College search error:", err);
    container.innerHTML = `
      <p class="error-text">⚠️ Search failed: ${escapeHtml(err.message)}</p>
      <p class="error-subtext">Make sure COLLEGE_SCORECARD_API_KEY is set in your Netlify environment variables.</p>`;
  }
}

function renderCollegeCard(school) {
  const admitRate =
    school.admissionRate != null
      ? `${Math.round(school.admissionRate * 100)}%`
      : "N/A";

  const tuition =
    school.outOfStateTuition != null
      ? `$${school.outOfStateTuition.toLocaleString()}`
      : school.inStateTuition != null
        ? `$${school.inStateTuition.toLocaleString()} (in-state)`
        : "N/A";

  const satInfo =
    school.satAvg != null ? `${Math.round(school.satAvg)}` : "N/A";
  const actInfo = school.actMidpoint != null ? `${school.actMidpoint}` : "N/A";
  const size =
    school.studentSize != null ? school.studentSize.toLocaleString() : "N/A";

  const location =
    [school.city, school.state].filter(Boolean).join(", ") || "Unknown";

  // Determine selectivity badge
  let selectivityBadge = "";
  if (school.admissionRate != null) {
    const rate = school.admissionRate;
    if (rate < 0.1)
      selectivityBadge = `<span class="selectivity-badge reach">Highly Selective</span>`;
    else if (rate < 0.25)
      selectivityBadge = `<span class="selectivity-badge reach">Very Selective</span>`;
    else if (rate < 0.5)
      selectivityBadge = `<span class="selectivity-badge match">Selective</span>`;
    else
      selectivityBadge = `<span class="selectivity-badge safety">Less Selective</span>`;
  }

  // Compare to user's stats if available
  const matchIndicator = getMatchIndicator(school);

  const websiteLink = school.url
    ? `<a href="https://${school.url}" target="_blank" rel="noopener" class="college-link">Visit Website →</a>`
    : "";

  return `
    <div class="college-card">
      <div class="college-card-header">
        <div>
          <h3 class="college-name">${escapeHtml(school.name)}</h3>
          <p class="college-location">📍 ${escapeHtml(location)} · ${escapeHtml(school.ownership)}</p>
        </div>
        <div class="college-badges">
          ${selectivityBadge}
          ${matchIndicator}
        </div>
      </div>
      <div class="college-stats-grid">
        <div class="college-stat">
          <span class="stat-label">Acceptance Rate</span>
          <span class="stat-value ${getAdmitClass(school.admissionRate)}">${admitRate}</span>
        </div>
        <div class="college-stat">
          <span class="stat-label">Avg SAT</span>
          <span class="stat-value">${satInfo}</span>
        </div>
        <div class="college-stat">
          <span class="stat-label">Avg ACT</span>
          <span class="stat-value">${actInfo}</span>
        </div>
        <div class="college-stat">
          <span class="stat-label">Tuition (OOS)</span>
          <span class="stat-value">${tuition}</span>
        </div>
        <div class="college-stat">
          <span class="stat-label">Undergrads</span>
          <span class="stat-value">${size}</span>
        </div>
      </div>
      ${websiteLink}
    </div>`;
}

function getAdmitClass(rate) {
  if (rate == null) return "";
  if (rate < 0.15) return "stat-value-red";
  if (rate < 0.4) return "stat-value-yellow";
  return "stat-value-green";
}

/**
 * Compares the college's SAT average to the user's SAT score
 * to show a quick Reach / Match / Safety tag.
 */
function getMatchIndicator(school) {
  if (!userProfile?.sat || !school.satAvg) return "";

  const userSAT = Number(userProfile.sat);
  const schoolSAT = Number(school.satAvg);
  const diff = userSAT - schoolSAT;

  if (diff >= 100)
    return `<span class="selectivity-badge safety">Safety</span>`;
  if (diff >= -60) return `<span class="selectivity-badge match">Match</span>`;
  return `<span class="selectivity-badge reach">Reach</span>`;
}

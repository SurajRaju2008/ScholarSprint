import {
  getSavedRoadmap,
  saveRoadmap,
  isSignedInUser,
} from "./firebase-config.js";
import { addObjectiveFromRoadmap, getAddedRoadmapItemIds } from "./objectives.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let getProfile = () => null;
let currentRoadmap = null;

function setRoadmapStatus(message, type = "") {
  const el = document.getElementById("roadmapStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `roadmap-status${type ? ` roadmap-status-${type}` : ""}`;
}

function renderRoadmap(roadmap) {
  const container = document.getElementById("roadmapTimeline");
  const titleEl = document.getElementById("roadmapTimelineTitle");
  if (!container) return;

  currentRoadmap = roadmap;
  const addedIds = getAddedRoadmapItemIds();

  if (titleEl) {
    titleEl.textContent = roadmap.timelineLabel || "Your Timeline";
  }

  if (!roadmap.phases?.length) {
    container.innerHTML = `<p class="placeholder-text">Click Generate Roadmap to build your personalized application timeline.</p>`;
    container.classList.add("roadmap-empty");
    return;
  }

  container.classList.remove("roadmap-empty");
  container.innerHTML = roadmap.phases
    .map((phase, phaseIndex) => {
      const status = phase.status || "upcoming";
      const markerClass =
        status === "completed"
          ? "completed"
          : status === "active"
            ? "active"
            : "";
      const badgeLabel =
        status === "completed"
          ? "Completed"
          : status === "active"
            ? "In Progress"
            : "Upcoming";

      const itemsHtml = phase.items
        .map((item, itemIndex) => {
          const isAdded = addedIds.has(item.id);
          return `
            <li class="roadmap-task">
              <span class="roadmap-task-text">${escapeHtml(item.text)}</span>
              <button
                type="button"
                class="roadmap-add-btn${isAdded ? " added" : ""}"
                data-phase-index="${phaseIndex}"
                data-item-index="${itemIndex}"
                aria-label="${isAdded ? "Added to objectives" : "Add to objectives"}"
                title="${isAdded ? "Added to objectives" : "Add to objectives"}"
                ${isAdded ? "disabled" : ""}
              >
                ${isAdded ? "✓" : "+"}
              </button>
            </li>`;
        })
        .join("");

      return `
        <div class="timeline-item">
          <div class="timeline-marker ${markerClass}"></div>
          <div class="timeline-content">
            <h3>${escapeHtml(phase.title)}</h3>
            <ul>${itemsHtml}</ul>
            <span class="status-badge ${status}">${badgeLabel}</span>
          </div>
        </div>`;
    })
    .join("");
}

async function generateRoadmap() {
  const btn = document.getElementById("generateRoadmapBtn");
  const profile = getProfile();

  if (!profile) {
    setRoadmapStatus("Profile not loaded yet. Please wait a moment and try again.", "error");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Generating…";
  }

  setRoadmapStatus("Building your personalized timeline…");

  const container = document.getElementById("roadmapTimeline");
  if (container) {
    container.innerHTML = `
      <div class="search-loading">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <p>Generating your roadmap with AI…</p>
      </div>`;
    container.classList.remove("roadmap-empty");
  }

  try {
    const res = await fetch("/api/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    const roadmap = data.roadmap;
    renderRoadmap(roadmap);

    if (isSignedInUser()) {
      try {
        await saveRoadmap(roadmap);
        setRoadmapStatus("Roadmap saved to your account.", "success");
      } catch (err) {
        setRoadmapStatus(`Roadmap generated, but could not save: ${err.message}`, "error");
      }
    } else {
      setRoadmapStatus("Roadmap generated. Sign in to save it to your account.", "success");
    }
  } catch (err) {
    console.error("Roadmap error:", err);
    if (container) {
      container.innerHTML = `<p class="error-text">Could not generate roadmap: ${escapeHtml(err.message)}</p>`;
      container.classList.add("roadmap-empty");
    }
    setRoadmapStatus("Generation failed. Check that GROQ_API_KEY is set for netlify dev.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Generate Roadmap";
    }
  }
}

async function handleRoadmapClick(event) {
  const addBtn = event.target.closest(".roadmap-add-btn");
  if (!addBtn || addBtn.disabled || !currentRoadmap) return;

  const phaseIndex = Number(addBtn.dataset.phaseIndex);
  const itemIndex = Number(addBtn.dataset.itemIndex);
  const item = currentRoadmap.phases?.[phaseIndex]?.items?.[itemIndex];
  if (!item) return;

  addBtn.disabled = true;
  addBtn.textContent = "…";

  try {
    const added = await addObjectiveFromRoadmap({
      text: item.text,
      roadmapItemId: item.id,
    });
    if (added) {
      addBtn.classList.add("added");
      addBtn.textContent = "✓";
      addBtn.title = "Added to objectives";
      addBtn.setAttribute("aria-label", "Added to objectives");
      setRoadmapStatus("Added to your objectives on the Home tab.", "success");
    } else {
      addBtn.classList.add("added");
      addBtn.textContent = "✓";
      setRoadmapStatus("That task is already in your objectives.", "success");
    }
  } catch (err) {
    addBtn.disabled = false;
    addBtn.textContent = "+";
    setRoadmapStatus(err.message, "error");
  }
}

export function initRoadmap(profileGetter) {
  getProfile = profileGetter;

  const btn = document.getElementById("generateRoadmapBtn");
  const container = document.getElementById("roadmapTimeline");

  btn?.addEventListener("click", generateRoadmap);
  container?.addEventListener("click", handleRoadmapClick);

  document.addEventListener("objectives:updated", () => {
    if (currentRoadmap) renderRoadmap(currentRoadmap);
  });

  (async () => {
    if (!isSignedInUser()) {
      renderRoadmap({ timelineLabel: "Your Timeline", phases: [] });
      return;
    }

    const saved = await getSavedRoadmap();
    if (saved) {
      renderRoadmap(saved);
      setRoadmapStatus("Showing your saved roadmap. Click Generate Roadmap to refresh.", "success");
    }
  })();
}

export function updateRoadmapProfile(profileGetter) {
  getProfile = profileGetter;
}

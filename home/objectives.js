import {
  getUserObjectives,
  saveUserObjectives,
  isSignedInUser,
} from "./firebase-config.js";

let objectives = [];
let addedRoadmapIds = new Set();

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createObjectiveId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `obj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function syncAddedRoadmapIds() {
  addedRoadmapIds = new Set(
    objectives
      .filter((item) => item.roadmapItemId)
      .map((item) => item.roadmapItemId),
  );
}

async function persistObjectives() {
  await saveUserObjectives(objectives);
  syncAddedRoadmapIds();
  document.dispatchEvent(new CustomEvent("objectives:updated"));
}

function renderObjectives() {
  const list = document.getElementById("objectiveList");
  if (!list) return;

  if (objectives.length === 0) {
    list.innerHTML = `
      <li class="objective-empty">
        <p class="placeholder-text">No objectives yet. Open your Roadmap and tap <strong>+</strong> on any task to add it here.</p>
      </li>`;
    return;
  }

  list.innerHTML = objectives
    .map(
      (item) => `
      <li class="objective-item${item.completed ? " completed" : ""}" data-id="${escapeHtml(item.id)}">
        <button type="button" class="objective-check" aria-label="${item.completed ? "Mark incomplete" : "Mark complete"}" aria-pressed="${item.completed}">
          <span class="checkbox${item.completed ? " checked" : ""}">${item.completed ? "✓" : ""}</span>
        </button>
        <span class="objective-text">${escapeHtml(item.text)}</span>
        <button type="button" class="objective-remove" aria-label="Remove objective">×</button>
      </li>`,
    )
    .join("");
}

function bindObjectiveEvents() {
  const list = document.getElementById("objectiveList");
  if (!list || list.dataset.bound === "true") return;

  list.dataset.bound = "true";
  list.addEventListener("click", async (event) => {
    const checkBtn = event.target.closest(".objective-check");
    const removeBtn = event.target.closest(".objective-remove");
    const row = event.target.closest(".objective-item[data-id]");
    if (!row) return;

    const id = row.dataset.id;

    if (checkBtn) {
      const item = objectives.find((entry) => entry.id === id);
      if (!item) return;

      item.completed = !item.completed;
      try {
        await persistObjectives();
        renderObjectives();
      } catch (err) {
        item.completed = !item.completed;
        alert(err.message);
      }
      return;
    }

    if (removeBtn) {
      objectives = objectives.filter((entry) => entry.id !== id);
      try {
        await persistObjectives();
        renderObjectives();
      } catch (err) {
        alert(err.message);
      }
    }
  });
}

export function getAddedRoadmapItemIds() {
  return addedRoadmapIds;
}

export async function initObjectives() {
  bindObjectiveEvents();

  if (!isSignedInUser()) {
    objectives = [];
    syncAddedRoadmapIds();
    renderObjectives();
    return;
  }

  objectives = await getUserObjectives();
  syncAddedRoadmapIds();
  renderObjectives();
}

export async function addObjectiveFromRoadmap({ text, roadmapItemId }) {
  if (!isSignedInUser()) {
    throw new Error("Sign in to save objectives to your account.");
  }

  const trimmed = String(text || "").trim();
  if (!trimmed) return false;

  if (
    objectives.some(
      (item) =>
        item.text.toLowerCase() === trimmed.toLowerCase() ||
        (roadmapItemId && item.roadmapItemId === roadmapItemId),
    )
  ) {
    return false;
  }

  objectives.push({
    id: createObjectiveId(),
    text: trimmed,
    completed: false,
    roadmapItemId: roadmapItemId || null,
    addedAt: new Date().toISOString(),
  });

  await persistObjectives();
  renderObjectives();
  return true;
}

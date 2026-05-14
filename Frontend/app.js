// URL base de la API. Deja vacío para usar el mismo origen o escribe la URL pública.
const API_BASE_URL = "";

// Textos del UI (estilo arcade en inglés/uppercase).
const TEXT_TITLE             = (day) => `DAY ${day}`;
const TEXT_COUNT             = (current, target) => `${current} / ${target} REPS`;
const TEXT_FEEDBACK_DEFAULT  = "INSERT VALUE > 0";
const TEXT_FEEDBACK_GOAL     = "STAGE CLEARED - GO REST";
const TEXT_FEEDBACK_INVALID  = "ERROR: INVALID VALUE";
const TEXT_FEEDBACK_LOADING  = (n) => `LOADING +${n} REPS`;

function getCurrentDayNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diffMs = now - start;
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.floor(diffMs / dayMs);
}

let currentDay = getCurrentDayNumber();
let currentCount = 0;
let targetCount = currentDay;

const apiBaseUrl = (
  API_BASE_URL ||
  (new URLSearchParams(window.location.search).get("api") ?? "")
).replace(/\/+$/, "");

const progressRing = document.getElementById("progress-ring");
const progressPercent = document.getElementById("progress-percent");
const progressRemaining = document.getElementById("progress-remaining");
const countDisplay = document.getElementById("count-display");
const title = document.getElementById("title");
const customAmountInput = document.getElementById("custom-amount-input");
const addCustomBtn = document.getElementById("add-custom-btn");
const customAmountFeedback = document.getElementById("custom-amount-feedback");
const goalMessage = document.getElementById("goal-message");
const actionButtons = Array.from(document.querySelectorAll(".action-btn"));

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function buildApiUrl(path) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (!apiBaseUrl) return safePath;
  return `${apiBaseUrl}${safePath}`;
}

function setFeedback(text, state) {
  customAmountFeedback.textContent = text;
  customAmountFeedback.dataset.state = state;
}

function updateProgressUI() {
  const ratio = targetCount > 0 ? Math.min(currentCount / targetCount, 1) : 0;
  const offset = CIRCUMFERENCE * (1 - ratio);
  const percent = Math.round(ratio * 100);
  const hasReachedGoal = targetCount > 0 && currentCount >= targetCount;

  progressRing.style.strokeDasharray = CIRCUMFERENCE.toFixed(3);
  progressRing.style.strokeDashoffset = offset.toFixed(3);
  progressPercent.textContent = `${percent}%`;
  progressRemaining.textContent = `${Math.max(targetCount - currentCount, 0)} LEFT`;
  countDisplay.textContent = TEXT_COUNT(currentCount, targetCount);
  title.textContent = TEXT_TITLE(currentDay);

  goalMessage.classList.toggle("hidden", !hasReachedGoal);

  actionButtons.forEach((b) => { b.disabled = hasReachedGoal; });
  customAmountInput.disabled = hasReachedGoal;
  addCustomBtn.disabled = hasReachedGoal;

  if (hasReachedGoal) {
    setFeedback(TEXT_FEEDBACK_GOAL, "success");
  } else if (customAmountFeedback.dataset.state === "success") {
    setFeedback(TEXT_FEEDBACK_DEFAULT, "default");
  }
}

async function loadData() {
  try {
    const response = await fetch(buildApiUrl("/api/today"), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      currentDay = data.day_number ?? currentDay;
      targetCount = data.target_count ?? data.day_number ?? targetCount;
      currentCount = data.current_count ?? currentCount;
    }
  } catch (error) {
    console.warn("No se pudo cargar /api/today, usando estado local.", error);
  } finally {
    updateProgressUI();
  }
}

async function addPushups(amount) {
  if (targetCount > 0 && currentCount >= targetCount) {
    updateProgressUI();
    return;
  }

  const previousCount = currentCount;
  currentCount = Math.min(currentCount + amount, targetCount);
  updateProgressUI();

  try {
    const response = await fetch(buildApiUrl("/api/add"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, day_number: currentDay }),
    });

    if (response.ok) {
      const data = await response.json();
      currentCount = data.current_count ?? currentCount;
      targetCount = data.target_count ?? data.day_number ?? targetCount;
      currentDay = data.day_number ?? currentDay;
      updateProgressUI();
    } else {
      currentCount = previousCount;
      updateProgressUI();
    }
  } catch (error) {
    currentCount = previousCount;
    updateProgressUI();
    console.error("Error al guardar en /api/add", error);
  }
}

function addCustomPushups() {
  if (targetCount > 0 && currentCount >= targetCount) {
    updateProgressUI();
    return;
  }

  const rawValue = customAmountInput.value.trim();
  const amount = Number(rawValue);
  const isValid = Number.isInteger(amount) && amount > 0;

  if (!isValid) {
    setFeedback(TEXT_FEEDBACK_INVALID, "error");
    return;
  }

  setFeedback(TEXT_FEEDBACK_LOADING(amount), "info");
  addPushups(amount);
  customAmountInput.value = "";
}

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const amount = Number(button.dataset.amount);
    if (!Number.isNaN(amount)) addPushups(amount);
  });
});

addCustomBtn.addEventListener("click", addCustomPushups);
customAmountInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addCustomPushups();
});

updateProgressUI();
loadData();

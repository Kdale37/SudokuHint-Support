"use strict";

const ISLANDS = [
  { image: window.RIDDLE_IMAGES.svalbard },
  { image: window.RIDDLE_IMAGES.okinawa },
  { image: window.RIDDLE_IMAGES.als },
  { image: window.RIDDLE_IMAGES.granCanaria },
  { image: window.RIDDLE_IMAGES.bornholm },
  { image: window.RIDDLE_IMAGES.groenland },
  { image: window.RIDDLE_IMAGES.nordoeenNewZealand }
];

const CORRECT_WORD = "SANGBOG";
const NOTIFY_TOPIC = "leif-riddle-aksel-84e0d5aa37b24e98";
const STORAGE_KEY = "leif-riddle-state-v1";

const defaultState = () => ({ admitted: false, page: 0, answers: Array(ISLANDS.length).fill(""), letters: [], solved: false });
let state = loadState();
let selectedIndex = null;
let dragIndex = null;

const $ = (id) => document.getElementById(id);
const loginScreen = $("loginScreen");
const puzzleScreen = $("puzzleScreen");
const finalScreen = $("finalScreen");
const answerInput = $("islandAnswer");

function loadState() {
  try {
    return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalize(text) {
  return text.trim().toLocaleUpperCase("da-DK");
}

function firstLetter(text) {
  return Array.from(normalize(text))[0] || "?";
}

function showOnly(screen) {
  [loginScreen, puzzleScreen, finalScreen].forEach((item) => item.classList.toggle("hidden", item !== screen));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPuzzle() {
  const index = state.page;
  $("islandImage").src = ISLANDS[index].image;
  $("progressText").textContent = `Ø ${index + 1} af ${ISLANDS.length}`;
  $("progressBar").style.width = `${((index + 1) / ISLANDS.length) * 100}%`;
  answerInput.value = state.answers[index];
  $("firstLetter").textContent = firstLetter(answerInput.value);
  $("backButton").disabled = index === 0;
  $("backButton").style.opacity = index === 0 ? ".45" : "1";
  $("nextButton").textContent = index === ISLANDS.length - 1 ? "Til bogstaverne" : "Næste";
  $("answerError").textContent = "";
  showOnly(puzzleScreen);
  setTimeout(() => answerInput.focus(), 80);
}

function lettersFromAnswers() {
  return state.answers.map(firstLetter);
}

function ensureLetters() {
  const currentLetters = lettersFromAnswers();
  const valid = state.letters.length === ISLANDS.length &&
    [...state.letters].sort().join("") === [...currentLetters].sort().join("");
  if (!valid) state.letters = currentLetters;
}

function swapLetters(a, b) {
  [state.letters[a], state.letters[b]] = [state.letters[b], state.letters[a]];
  selectedIndex = null;
  saveState();
  renderLetters();
}

function chooseLetter(index) {
  if (selectedIndex === null) {
    selectedIndex = index;
    $("selectionHint").textContent = "Vælg nu det bogstav, det skal bytte plads med.";
    renderLetters();
    return;
  }
  if (selectedIndex === index) {
    selectedIndex = null;
    $("selectionHint").textContent = "Vælg det første bogstav.";
    renderLetters();
    return;
  }
  swapLetters(selectedIndex, index);
  $("selectionHint").textContent = "Bogstaverne er byttet. Vælg to nye, hvis du vil bytte igen.";
}

function renderLetters() {
  const holder = $("letterTiles");
  holder.innerHTML = "";
  state.letters.forEach((letter, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `letter-tile${selectedIndex === index ? " selected" : ""}`;
    tile.textContent = letter;
    tile.setAttribute("aria-label", `Bogstav ${letter}, position ${index + 1}`);
    tile.draggable = true;
    tile.addEventListener("click", () => chooseLetter(index));
    tile.addEventListener("dragstart", () => { dragIndex = index; tile.classList.add("dragging"); });
    tile.addEventListener("dragend", () => { dragIndex = null; tile.classList.remove("dragging"); });
    tile.addEventListener("dragover", (event) => event.preventDefault());
    tile.addEventListener("drop", (event) => {
      event.preventDefault();
      if (dragIndex !== null && dragIndex !== index) swapLetters(dragIndex, index);
    });
    holder.appendChild(tile);
  });
  $("formedWord").textContent = state.letters.join("");
}

function renderFinal() {
  ensureLetters();
  saveState();
  selectedIndex = null;
  $("selectionHint").textContent = "Vælg det første bogstav.";
  $("resultBox").className = "result-box hidden";
  renderLetters();
  showOnly(finalScreen);
}

async function sendNotification(message, tags) {
  const response = await fetch(`https://ntfy.sh/${NOTIFY_TOPIC}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      "Title": "Leif-Riddle",
      "Priority": "high",
      "Tags": tags
    },
    body: message
  });
  if (!response.ok) throw new Error("Notification failed");
}

async function submitAnswer() {
  const word = normalize(state.letters.join(""));
  const correct = word === CORRECT_WORD;
  const resultBox = $("resultBox");
  const button = $("sendButton");
  button.disabled = true;
  button.textContent = "Sender …";
  resultBox.className = `result-box ${correct ? "success" : "wrong"}`;
  resultBox.textContent = correct ? "Rigtigt! Du har løst opgaven 🎉" : `Det er ikke det rigtige ord. Du sendte ${word}. Prøv igen.`;
  try {
    await sendNotification(correct ? "Aksel har løst opgaven" : `Forkert, Aksel tror svaret er ${word}`, correct ? "tada" : "thinking_face");
    if (correct) {
      state.solved = true;
      saveState();
    }
  } catch {
    resultBox.textContent += " Beskeden kunne ikke sendes, men dit svar er registreret på skærmen.";
  } finally {
    button.disabled = false;
    button.textContent = correct ? "Sendt" : "Send svar igen";
  }
}

$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (normalize($("nameInput").value) !== "AKSEL") {
    $("loginError").textContent = "Det navn åbner ikke gåden.";
    return;
  }
  state.admitted = true;
  saveState();
  renderPuzzle();
});

answerInput.addEventListener("input", () => {
  state.answers[state.page] = answerInput.value;
  $("firstLetter").textContent = firstLetter(answerInput.value);
  saveState();
});

$("nextButton").addEventListener("click", () => {
  const answer = answerInput.value.trim();
  if (!answer) {
    $("answerError").textContent = "Skriv et ønavn, før du går videre.";
    answerInput.focus();
    return;
  }
  state.answers[state.page] = answer;
  saveState();
  if (state.page === ISLANDS.length - 1) renderFinal();
  else { state.page += 1; saveState(); renderPuzzle(); }
});

$("backButton").addEventListener("click", () => {
  if (state.page > 0) { state.page -= 1; saveState(); renderPuzzle(); }
});

$("finalBackButton").addEventListener("click", () => {
  state.page = ISLANDS.length - 1;
  saveState();
  renderPuzzle();
});

$("sendButton").addEventListener("click", submitAnswer);

$("resetButton").addEventListener("click", () => {
  if (!window.confirm("Vil du slette alle svar og starte helt forfra?")) return;
  state = defaultState();
  localStorage.removeItem(STORAGE_KEY);
  $("nameInput").value = "";
  $("loginError").textContent = "";
  showOnly(loginScreen);
});

if (state.admitted) {
  if (state.page >= ISLANDS.length || state.solved) renderFinal();
  else renderPuzzle();
} else {
  showOnly(loginScreen);
}

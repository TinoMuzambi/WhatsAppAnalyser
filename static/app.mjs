import { analyseChat, ChatFormatError } from "./analyser.mjs";
import { analysisJson, participantCsv, downloadText } from "./export.mjs";
import { initCommerce } from "./commerce.mjs";
let currentAnalysis = null;

const form = document.querySelector("#analysis-form");
const input = document.querySelector("#chat-input");
const fileInput = document.querySelector("#file-input");
const fileName = document.querySelector("#file-name");
const errorMessage = document.querySelector("#error-message");
const results = document.querySelector("#results");

const SAMPLE = `[01/08/2026, 09:42] Alex: Morning! Are we still meeting today?
[01/08/2026, 09:43] Sam: Yes, I'll bring coffee.
[01/08/2026, 09:44] Alex: Perfect. I'll bring the notes.
[01/08/2026, 11:06] Sam: That was a good conversation.
[02/08/2026, 18:15] Alex: I've sent the revised plan.
[02/08/2026, 18:20] Sam: Thank you! The revised plan looks great.
[02/08/2026, 18:21] Alex: Let's ship it tomorrow.
[03/08/2026, 08:02] Sam: Agreed. Coffee first, then we'll ship it.`;

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function replaceChildren(target, children) {
  target.replaceChildren(...children);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderStats(summary) {
  const stats = [
    ["Messages", formatNumber(summary.messages)],
    ["Words", formatNumber(summary.words)],
    ["People", formatNumber(summary.participants)],
    ["Active days", formatNumber(summary.activeDays)],
    ["Words / message", formatNumber(summary.averageWords, 1)],
  ];

  replaceChildren(
    document.querySelector("#stat-grid"),
    stats.map(([label, value]) => {
      const card = element("article", "stat-card");
      card.append(element("span", "stat-value", value), element("span", "stat-label", label));
      return card;
    }),
  );
}

function renderParticipants(participants) {
  const maximum = participants[0]?.messages ?? 1;
  replaceChildren(
    document.querySelector("#participants-list"),
    participants.slice(0, 10).map((participant) => {
      const item = element("li", "rank-item");
      const copy = element("div", "rank-copy");
      copy.append(
        element("strong", "", participant.name),
        element("span", "", `${formatNumber(participant.words)} words`),
      );
      const count = element("span", "rank-count", formatNumber(participant.messages));
      const progress = element("progress", "rank-progress");
      progress.max = maximum;
      progress.value = participant.messages;
      progress.setAttribute("aria-label", `${participant.name}: ${participant.messages} messages`);
      item.append(copy, count, progress);
      return item;
    }),
  );
}

function renderWords(words) {
  replaceChildren(
    document.querySelector("#word-list"),
    words.map(({ word, count }, index) => {
      const item = element("li", "word-item");
      item.append(
        element("span", "word-number", String(index + 1).padStart(2, "0")),
        element("strong", "", word),
        element("span", "", formatNumber(count)),
      );
      return item;
    }),
  );
}

function formatHour(hour) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(
    new Date(2020, 0, 1, hour),
  );
}

function renderHours(hours) {
  const activeHours = hours.filter(({ count }) => count > 0);
  const maximum = Math.max(...activeHours.map(({ count }) => count), 1);
  replaceChildren(
    document.querySelector("#hour-list"),
    activeHours.map(({ hour, count }) => {
      const row = element("div", "hour-row");
      row.append(element("span", "", formatHour(hour)));
      const progress = element("progress");
      progress.max = maximum;
      progress.value = count;
      progress.setAttribute("aria-label", `${formatHour(hour)}: ${count} messages`);
      row.append(progress, element("span", "", formatNumber(count)));
      return row;
    }),
  );
}

function showError(message) {
  currentAnalysis = null;
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  results.hidden = true;
}

function runAnalysis() {
  errorMessage.hidden = true;
  try {
    const analysis = analyseChat(input.value);
    currentAnalysis = analysis;
    renderStats(analysis.summary);
    renderParticipants(analysis.participants);
    renderWords(analysis.topWords);
    renderHours(analysis.hours);
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError(
      error instanceof ChatFormatError
        ? error.message
        : "That export could not be analysed. Please check the file and try again.",
    );
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runAnalysis();
});

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showError("That file is over 10 MB. Choose a smaller text export.");
    fileInput.value = "";
    return;
  }

  try {
    input.value = await file.text();
    fileName.textContent = file.name;
    runAnalysis();
  } catch {
    showError("The file could not be read as text.");
  }
});

document.querySelector("#sample-button").addEventListener("click", () => {
  input.value = SAMPLE;
  fileName.textContent = "Sample conversation loaded";
  runAnalysis();
});

document.querySelector("#clear-button").addEventListener("click", () => {
  currentAnalysis = null;
  for (const selector of ["#stat-grid", "#participants-list", "#word-list", "#hour-list"]) {
    document.querySelector(selector).replaceChildren();
  }
  document.querySelector("#report-title").value = "Our conversation";
  document.querySelector("#report-dedication").value = "";
  input.value = "";
  fileInput.value = "";
  fileName.textContent = "Choose a .txt file up to 10 MB";
  errorMessage.hidden = true;
  results.hidden = true;
  input.focus();
  window.scrollTo({ top: document.querySelector("#input-title").offsetTop, behavior: "smooth" });
});

// Export handlers read memory only. Private text never enters a payment request.
document.querySelector("#export-json").addEventListener("click", () => {
  if (currentAnalysis) downloadText(analysisJson(currentAnalysis), "chatfold-analysis.json", "application/json");
});
document.querySelector("#export-csv").addEventListener("click", () => {
  if (currentAnalysis) downloadText(participantCsv(currentAnalysis), "chatfold-contributors.csv", "text/csv;charset=utf-8");
});
document.querySelector("#export-source").addEventListener("click", () => {
  if (currentAnalysis) downloadText(input.value, "chatfold-original.txt", "text/plain;charset=utf-8");
});
initCommerce(() => currentAnalysis);

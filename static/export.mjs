export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[char]));
}
function csvCell(value) {
  let text = String(value);
  // Prevent spreadsheet formula execution when participant names are opened in Excel.
  if (/^[\s\uFEFF]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function participantCsv(analysis) {
  return [["Participant", "Messages", "Words"], ...analysis.participants.map(person => [person.name, person.messages, person.words])]
    .map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function analysisJson(analysis) { return JSON.stringify(analysis, null, 2) + "\n"; }
export function renderReport(template, analysis, { title = "Our conversation", dedication = "", theme = "correspondence" } = {}) {
  if (typeof template !== "string" || !template.startsWith("<!doctype html>")) throw new Error("Invalid report design.");
  const number = value => new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1 }).format(value);
  const e = escapeHtml;
  const short = (value, length) => String(value).length > length ? String(value).slice(0, length - 1) + "…" : String(value);
  const values = {
    titleClass: title.trim().length > 45 ? "title-long" : "",
    title: e(title.trim().slice(0, 80) || "Our conversation"), dedication: e(dedication.trim().slice(0, 240)),
    theme: theme === "after-hours" ? "after-hours" : "correspondence",
    edition: theme === "after-hours" ? "After hours" : "Correspondence",
    firstDate: e(short(analysis.summary.firstDate, 32)), lastDate: e(short(analysis.summary.lastDate, 32)),
    messages: number(analysis.summary.messages), people: number(analysis.summary.participants),
    days: number(analysis.summary.activeDays), words: number(analysis.summary.words), average: number(analysis.summary.averageWords),
    participants: analysis.participants.slice(0, 12).map(p => `<tr><td>${e(short(p.name, 64))}</td><td>${number(p.messages)}</td></tr>`).join(""),
    topWords: analysis.topWords.map(w => `<li>${e(short(w.word, 28))}<small>${number(w.count)}</small></li>`).join(""),
    hours: analysis.hours.map(h => `<div class="hour"><span>${String(h.hour).padStart(2, "0")}:00</span><strong>${number(h.count)}</strong></div>`).join(""),
  };
  // One pass: user-supplied text containing {{placeholders}} is never interpreted again.
  return template.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error("Unknown report field.");
    return values[key];
  });
}
export function downloadText(contents, filename, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

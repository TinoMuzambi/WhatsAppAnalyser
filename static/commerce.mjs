import { renderReport, downloadText } from "./export.mjs";

export function initCommerce(getAnalysis) {
  const message = document.querySelector("#purchase-message");
  const purchaseButton = document.querySelector("#purchase-button");
  const reportButton = document.querySelector("#report-button");
  const restoreDetails = document.querySelector("#restore-purchase");
  const legacyHelp = document.querySelector("#legacy-purchase-help");
  // Keep receipt entry in this tab; the recovery link carries no private values.
  legacyHelp.hidden = location.origin === new URL(legacyHelp.querySelector("a").href).origin;
  if (location.hash === "#restore-purchase") restoreDetails.open = true;
  let available = false;
  let unlocked = false;
  let busy = false;
  const say = (text, error = false) => { message.textContent = text; message.classList.toggle("purchase-error", error); };
  const buttons = () => { purchaseButton.disabled = busy || !available || unlocked; purchaseButton.textContent = unlocked ? "Pack purchased" : "Get both designs for R79"; reportButton.disabled = busy || !unlocked; };
  const request = async (action, body) => {
    let response;
    try {
      response = await fetch(`/api/commerce?action=${action}`, {
        method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "This request could not be completed.");
      return result;
    } catch (error) {
      if (response) throw error;
      throw new Error("The purchase service could not be reached. Free analysis still works. Try again shortly.");
    }
  };
  const refresh = async (quiet = false) => {
    try {
      const status = await request("status"); available = status.available; unlocked = status.unlocked;
      if (!quiet) say(unlocked ? "Your keepsake pack is unlocked. Analyse a chat, then download a design." :
        !available ? "Purchases are not open yet. Free analysis and data exports are ready to use." :
        status.testMode ? "Test checkout — no real payment. This is a staging purchase flow." :
        "The keepsake pack costs R79 once off. No subscription.");
    } catch { if (!quiet) say("Purchases are temporarily unavailable. Free analysis and exports still work."); }
    buttons();
  };
  document.querySelector("#purchase-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!available || busy || unlocked) return;
    const checkoutTab = window.open("about:blank", "_blank");
    if (checkoutTab) { checkoutTab.opener = null; checkoutTab.document.title = "Opening secure checkout"; checkoutTab.document.body.textContent = "Opening Paystack checkout…"; }
    busy = true; buttons();
    try {
      const result = await request("checkout", { email: document.querySelector("#purchase-email").value });
      const link = document.querySelector("#checkout-link"); link.href = result.url; link.hidden = false;
      if (checkoutTab) checkoutTab.location = result.url;
      say(`Checkout is ready in a new tab. Keep this receipt reference: ${result.reference}. Your chat remains in this tab.`);
    } catch (error) { checkoutTab?.close(); say(error.message, true); }
    finally { busy = false; buttons(); }
  });
  document.querySelector("#restore-form").addEventListener("submit", async event => {
    event.preventDefault(); if (busy) return; busy = true; buttons();
    try {
      const result = await request("restore", { email: document.querySelector("#restore-email").value,
        reference: document.querySelector("#restore-reference").value.trim() });
      unlocked = result.unlocked; say("Purchase restored. Analyse a chat, then download either keepsake design.");
    } catch (error) { restoreDetails.open = true; say(error.message, true); }
    finally { busy = false; buttons(); }
  });
  document.querySelector("#report-form").addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !unlocked) return;
    const analysis = getAnalysis();
    if (!analysis) { say("Analyse a chat above before creating your keepsake.", true); document.querySelector("#input-title").scrollIntoView(); return; }
    busy = true; buttons();
    try {
      const { template } = await request("template");
      if (getAnalysis() !== analysis) throw new Error("The chat changed or was cleared. Analyse the chat you want, then download again.");
      const html = renderReport(template, analysis, { title: document.querySelector("#report-title").value,
        dedication: document.querySelector("#report-dedication").value, theme: document.querySelector("#report-theme").value });
      downloadText(html, "chatfold-keepsake.html", "text/html;charset=utf-8");
      say("Keepsake downloaded. Open the HTML file and use Print → Save as PDF, with A4 paper and background graphics enabled.");
    } catch (error) { say(error.message, true); }
    finally { busy = false; buttons(); }
  });
  window.addEventListener("focus", () => { if (!busy) refresh(true); });
  async function start() {
    const query = new URLSearchParams(location.search);
    if (query.get("payment") === "return") {
      const reference = query.get("reference") || query.get("trxref");
      history.replaceState(null, "", "/#keepsake");
      busy = true; buttons(); say("Confirming your payment. Please keep this tab open…");
      try {
        const result = await request("verify", { reference });
        unlocked = result.unlocked; available = true;
        say(`Payment verified. Reference: ${result.reference}. Return to your original tab to keep using its chat, or open an export above.`);
      } catch (error) { restoreDetails.open = true; say(error.message, true); }
      finally { busy = false; buttons(); }
    } else await refresh();
  }
  start();
}

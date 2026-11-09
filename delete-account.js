const deletionForm = document.querySelector("#deletion-form");
const deletionStatus = document.querySelector("#deletion-status");
const deletionGame = document.querySelector("#deletion-game");
const otherGameField = document.querySelector("#deletion-other-game-field");
const otherGameInput = document.querySelector("#deletion-other-game");
const deletionSubmit = deletionForm.querySelector('button[type="submit"]');

const newDeletionRequestId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
let deletionRequestId = newDeletionRequestId();
const deletionError = "Your request could not be sent. Try again.";

function showDeletionStatus(state, message) {
  deletionStatus.className = `form-status form-status-${state}`;
  deletionStatus.textContent = message;
}

function updateOtherGame() {
  const isOther = deletionGame.value === "other";
  otherGameField.hidden = !isOther;
  otherGameInput.disabled = !isOther;
  otherGameInput.required = isOther;
}

deletionGame.addEventListener("change", updateOtherGame);
window.addEventListener("pageshow", updateOtherGame);
updateOtherGame();
deletionSubmit.disabled = false;

deletionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (deletionSubmit.disabled || !deletionForm.reportValidity()) return;

  const fields = new FormData(deletionForm);
  const gameField = fields.get("game") === "other" ? "otherGame" : "game";
  const payload = {
    name: fields.get("name").trim(),
    email: fields.get("email").trim(),
    game: fields.get(gameField).trim(),
    details: fields.get("details").trim(),
    acknowledged: fields.has("acknowledged"),
    website: fields.get("website"),
    requestId: deletionRequestId,
  };

  deletionSubmit.disabled = true;
  showDeletionStatus("pending", "Sending your request…");

  try {
    const response = await fetch(deletionForm.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || typeof result?.message !== "string") {
      const message = result?.error ?? result?.message;
      showDeletionStatus("error", typeof message === "string" ? message : deletionError);
      return;
    }

    deletionForm.reset();
    updateOtherGame();
    deletionRequestId = newDeletionRequestId();
    showDeletionStatus("success", result.ticketId
      ? `${result.message} Reference ${result.ticketId}.`
      : result.message);
  } catch {
    showDeletionStatus("error", deletionError);
  } finally {
    deletionSubmit.disabled = false;
  }
});

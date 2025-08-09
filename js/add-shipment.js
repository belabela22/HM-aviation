// js/add-shipment.js
import {
  seedIfEmpty,
  loadFlights,
  upsertShipment,
  assignShipmentToFlight,
  generateTrackingCode
} from "./data.js";

document.addEventListener("DOMContentLoaded", () => {
  seedIfEmpty();
  setupHeaderYear();

  const form = document.getElementById("form-add-shipment");
  const codeInput = document.getElementById("add-code");
  const genBtn = document.getElementById("btn-generate-code-add");
  const flightSelect = document.getElementById("add-flight-select");

  // Prefill tracking code and flight options
  codeInput.value = generateTrackingCode();
  fillFlightOptions(flightSelect, loadFlights());

  genBtn.addEventListener("click", () => {
    codeInput.value = generateTrackingCode();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const now = new Date().toISOString();
    const data = Object.fromEntries(fd.entries());
    const shipment = {
      id: cryptoId(),
      sender: data.sender,
      recipient: data.recipient,
      origin: data.origin,
      destination: data.destination,
      weight: Number(data.weight),
      code: data.code,
      status: data.status,
      flightId: data.flightId || null,
      createdAt: now,
      history: [{ status: data.status, at: now }]
    };

    upsertShipment(shipment);
    if (shipment.flightId) assignShipmentToFlight(shipment.id, shipment.flightId);

    // Redirect to shipments list
    window.location.href = "./shipments.html";
  });
});

function fillFlightOptions(select, flights) {
  const opts = flights.map(f => `<option value="${f.id}">${f.number} — ${f.origin} → ${f.destination}</option>`).join("");
  select.insertAdjacentHTML("beforeend", opts);
}

function cryptoId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function setupHeaderYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));
  }
}

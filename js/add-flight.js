// js/add-flight.js
import { seedIfEmpty, upsertFlight } from "./data.js";

document.addEventListener("DOMContentLoaded", () => {
  seedIfEmpty();
  setupHeaderYear();

  const form = document.getElementById("form-add-flight");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    const flight = {
      id: cryptoId(),
      number: data.number,
      origin: data.origin,
      destination: data.destination,
      etd: toIso(data.etd),
      eta: toIso(data.eta),
      assignedShipmentIds: []
    };
    upsertFlight(flight);
    window.location.href = "./flights.html";
  });
});

function toIso(local) {
  return new Date(local).toISOString();
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

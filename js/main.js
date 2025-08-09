// js/main.js
// Core UI logic per page, ES6 modules.

import {
  seedIfEmpty,
  STATUSES,
  loadShipments, loadFlights, saveShipments, saveFlights,
  upsertShipment, deleteShipment, generateTrackingCode,
  updateShipmentStatus, findShipmentByCode, findShipmentById,
  upsertFlight, deleteFlight, findFlightById,
  assignShipmentToFlight, unassignShipmentFromFlight
} from "./data.js";

document.addEventListener("DOMContentLoaded", () => {
  seedIfEmpty();
  setupCommonUI();

  const page = document.body.dataset.page;
  if (page === "landing") initLanding();
  if (page === "dashboard") initDashboard();
  if (page === "shipments") initShipments();
  if (page === "flights") initFlights();
  if (page === "tracking") initTracking();
});

/* Common UI */
function setupCommonUI() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));
  }
}

/* Landing */
function initLanding() {
  // Micro-animation can be adjusted if needed
}

/* Dashboard */
function initDashboard() {
  const shipments = loadShipments();
  const flights = loadFlights();
  // Stats
  setText("#stat-total-shipments", shipments.length);
  setText("#stat-active-flights", flights.filter(isFlightActive).length);
  setText("#stat-pending", shipments.filter(s => s.status === "Pending").length);
  setText("#stat-delivered", shipments.filter(s => s.status === "Delivered").length);
  // Activity
  const feed = document.getElementById("activity-feed");
  if (feed) {
    const all = shipments.flatMap(s => s.history.map(h => ({ code: s.code, ...h })));
    all.sort((a, b) => new Date(b.at) - new Date(a.at));
    feed.innerHTML = all.slice(0, 10).map(item => {
      const icon = statusIcon(item.status);
      return `<li>
        <div class="icon">${icon}</div>
        <div><strong>${item.status}</strong> — ${item.code}<div class="muted">${formatDateTime(item.at)}</div></div>
        <div class="muted">${ago(item.at)}</div>
      </li>`;
    }).join("");
  }
  // Charts
  renderStatusChart(shipments);
  renderTrendChart(shipments);
}

function isFlightActive(f) {
  const now = new Date();
  return new Date(f.etd) <= now && now <= new Date(f.eta);
}

function renderStatusChart(shipments) {
  const ctx = document.getElementById("chart-status");
  if (!ctx || !window.Chart) return;
  const counts = {
    "Pending": shipments.filter(s => s.status === "Pending").length,
    "In Transit": shipments.filter(s => s.status === "In Transit").length,
    "Delivered": shipments.filter(s => s.status === "Delivered").length
  };
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ["#f59e0b", "#38bdf8", "#22c55e"],
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: { labels: { color: "#e5e7eb" } }
      }
    }
  });
}

function renderTrendChart(shipments) {
  const ctx = document.getElementById("chart-trend");
  if (!ctx || !window.Chart) return;
  const days = [...Array(7)].map((_, i) => dayLabel(-6 + i));
  const byDay = days.map(label => shipments.filter(s => sameDayLabel(s.createdAt, label)).length);
  new Chart(ctx, {
    type: "line",
    data: {
      labels: days,
      datasets: [{
        label: "Shipments",
        data: byDay,
        borderColor: "#FF4C4C",
        backgroundColor: "rgba(255,76,76,.2)",
        tension: .35,
        fill: true,
        pointRadius: 3
      }]
    },
    options: {
      scales: {
        x: { ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,.06)" }, beginAtZero: true, precision: 0 }
      },
      plugins: { legend: { labels: { color: "#e5e7eb" } } }
    }
  });
}

/* Shipments */
function initShipments() {
  const tbody = document.querySelector("#table-shipments tbody");
  const search = document.getElementById("search-shipments");
  const filter = document.getElementById("filter-status");
  const addBtn = document.getElementById("btn-add-shipment");
  const modal = document.getElementById("modal-shipment");
  const form = document.getElementById("form-shipment");
  const deleteBtn = document.getElementById("btn-delete-shipment");
  const genBtn = document.getElementById("btn-generate-code");
  const flightSelect = document.getElementById("shipment-flight-select");
  const historyList = document.getElementById("shipment-history-list");

  let shipments = loadShipments();
  let flights = loadFlights();
  let currentId = null;

  renderShipments();

  // Search & filter
  [search, filter].forEach(el => el.addEventListener("input", renderShipments));

  // Add
  addBtn.addEventListener("click", () => {
    currentId = null;
    fillFlightOptions(flightSelect, flights);
    form.reset();
    form.elements["status"].value = "Pending";
    form.elements["code"].value = generateTrackingCode();
    setText("#shipment-modal-title", "Add shipment");
    historyList.innerHTML = "";
    openModal(modal);
  });

  // Generate code
  genBtn.addEventListener("click", () => { form.elements["code"].value = generateTrackingCode(); });

  // Row actions
  tbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest(".btn-view")) {
      // Edit/view
      const s = shipments.find(x => x.id === id);
      currentId = s.id;
      fillFlightOptions(flightSelect, flights);
      setText("#shipment-modal-title", `Shipment ${s.code}`);
      form.elements["id"].value = s.id;
      form.elements["sender"].value = s.sender;
      form.elements["recipient"].value = s.recipient;
      form.elements["origin"].value = s.origin;
      form.elements["destination"].value = s.destination;
      form.elements["weight"].value = s.weight;
      form.elements["status"].value = s.status;
      form.elements["code"].value = s.code;
      form.elements["flightId"].value = s.flightId || "";

      // History
      historyList.innerHTML = s.history.slice().reverse().map(h => `<li>${h.status} — <span class="muted">${formatDateTime(h.at)}</span></li>`).join("");
      openModal(modal);
    }
  });

  // Save form
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = formDataToObject(new FormData(form));
    const now = new Date().toISOString();
    let shipment;
    if (data.id) {
      shipment = shipments.find(s => s.id === data.id);
      const statusChanged = shipment.status !== data.status;
      shipment = {
        ...shipment,
        sender: data.sender,
        recipient: data.recipient,
        origin: data.origin,
        destination: data.destination,
        weight: Number(data.weight),
        code: data.code,
        status: data.status,
        flightId: data.flightId || null,
        history: statusChanged ? [...shipment.history, { status: data.status, at: now }] : shipment.history
      };
    } else {
      shipment = {
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
        history: [{ status: data.status || "Pending", at: now }]
      };
    }
    upsertShipment(shipment);

    // Ensure assignments reflect on flights
    flights = loadFlights();
    if (shipment.flightId) {
      assignShipmentToFlight(shipment.id, shipment.flightId);
    } else {
      // Remove from any flight that had it
      flights.forEach(f => unassignShipmentFromFlight(shipment.id, f.id));
    }

    shipments = loadShipments();
    renderShipments();
    closeModal(modal);
  });

  // Delete shipment
  deleteBtn.addEventListener("click", () => {
    const s = shipments.find(x => x.id === currentId);
    if (!s) return;
    confirmDialog(`Delete shipment ${s.code}? This cannot be undone.`, () => {
      deleteShipment(s.id);
      shipments = loadShipments();
      flights = loadFlights();
      renderShipments();
      closeModal(modal);
    });
  });

  // Helpers
  function renderShipments() {
    shipments = loadShipments();
    flights = loadFlights();
    const term = (search.value || "").toLowerCase();
    const filterStatus = filter.value;
    const filtered = shipments.filter(s => {
      const matchesTerm = [s.sender, s.recipient, s.code].some(v => v.toLowerCase().includes(term));
      const matchesStatus = filterStatus === "all" ? true : s.status === filterStatus;
      return matchesTerm && matchesStatus;
    });

    tbody.innerHTML = filtered.map(s => {
      const badge = renderStatusBadge(s.status);
      const flight = s.flightId ? flights.find(f => f.id === s.flightId)?.number || "-" : "-";
      return `<tr data-id="${s.id}">
        <td>${escapeHtml(s.sender)}</td>
        <td>${escapeHtml(s.recipient)}</td>
        <td><code>${escapeHtml(s.code)}</code></td>
        <td>${badge}</td>
        <td>${flight}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-view"><i class="fa-solid fa-eye"></i> View</button>
        </td>
      </tr>`;
    }).join("");
  }
}

/* Flights */
function initFlights() {
  const tbody = document.querySelector("#table-flights tbody");
  const addBtn = document.getElementById("btn-add-flight");
  const modal = document.getElementById("modal-flight");
  const form = document.getElementById("form-flight");
  const deleteBtn = document.getElementById("btn-delete-flight");

  const drawer = document.getElementById("drawer-flight");
  const drawerClose = document.getElementById("drawer-close");
  const drawerMeta = document.getElementById("drawer-meta");
  const drawerShipments = document.getElementById("drawer-shipments");
  const assignSelect = document.getElementById("assign-shipment-select");
  const assignBtn = document.getElementById("btn-assign-shipment");

  let flights = loadFlights();
  let shipments = loadShipments();
  let currentId = null;

  renderFlights();

  // Add flight
  addBtn.addEventListener("click", () => {
    currentId = null;
    form.reset();
    setText("#flight-modal-title", "Add flight");
    openModal(modal);
  });

  // Save flight
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = formDataToObject(new FormData(form));
    let flight;
    if (data.id) {
      flight = flights.find(f => f.id === data.id);
      flight = {
        ...flight,
        number: data.number,
        origin: data.origin,
        destination: data.destination,
        etd: toIso(data.etd),
        eta: toIso(data.eta)
      };
    } else {
      flight = {
        id: cryptoId(),
        number: data.number,
        origin: data.origin,
        destination: data.destination,
        etd: toIso(data.etd),
        eta: toIso(data.eta),
        assignedShipmentIds: []
      };
    }
    upsertFlight(flight);
    flights = loadFlights();
    renderFlights();
    closeModal(modal);
  });

  // Delete flight
  deleteBtn.addEventListener("click", () => {
    const f = flights.find(x => x.id === currentId);
    if (!f) return;
    confirmDialog(`Delete flight ${f.number}? Shipments will be unassigned.`, () => {
      deleteFlight(f.id);
      flights = loadFlights();
      shipments = loadShipments();
      renderFlights();
      closeModal(modal);
      closeDrawer(drawer);
    });
  });

  // Row actions
  tbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const id = row.dataset.id;
    const flight = flights.find(f => f.id === id);
    if (e.target.closest(".btn-view")) {
      // Open drawer details
      openDrawer(drawer);
      currentId = id;
      fillFlightDrawer(flight);
    } else if (e.target.closest(".btn-edit")) {
      currentId = id;
      setText("#flight-modal-title", `Edit flight ${flight.number}`);
      form.elements["id"].value = flight.id;
      form.elements["number"].value = flight.number;
      form.elements["origin"].value = flight.origin;
      form.elements["destination"].value = flight.destination;
      form.elements["etd"].value = toLocalInputValue(flight.etd);
      form.elements["eta"].value = toLocalInputValue(flight.eta);
      openModal(modal);
    }
  });

  // Drawer close
  drawerClose.addEventListener("click", () => closeDrawer(drawer));
  drawer.querySelector(".drawer-backdrop").addEventListener("click", () => closeDrawer(drawer));

  // Assign shipment
  assignBtn.addEventListener("click", () => {
    const flight = findFlightById(currentId);
    const shipmentId = assignSelect.value || null;
    if (!shipmentId) return;
    assignShipmentToFlight(shipmentId, flight.id);
    // Persist in shipment as well
    const s = findShipmentById(shipmentId);
    if (s && s.status === "Pending") {
      updateShipmentStatus(s.id, "In Transit");
    }
    flights = loadFlights();
    shipments = loadShipments();
    fillFlightDrawer(findFlightById(currentId));
  });

  // Unassign within drawer
  drawerShipments.addEventListener("click", (e) => {
    if (e.target.closest(".btn-unassign")) {
      const shipmentId = e.target.closest("tr").dataset.sid;
      unassignShipmentFromFlight(shipmentId, currentId);
      const s = findShipmentById(shipmentId);
      if (s && s.status !== "Delivered") {
        updateShipmentStatus(s.id, "Pending");
      }
      flights = loadFlights();
      shipments = loadShipments();
      fillFlightDrawer(findFlightById(currentId));
    }
  });

  function renderFlights() {
    flights = loadFlights();
    shipments = loadShipments();
    tbody.innerHTML = flights.map(f => {
      const count = f.assignedShipmentIds?.length || shipments.filter(s => s.flightId === f.id).length;
      return `<tr data-id="${f.id}">
        <td><strong>${escapeHtml(f.number)}</strong></td>
        <td>${escapeHtml(f.origin)}</td>
        <td>${escapeHtml(f.destination)}</td>
        <td>${formatDateTime(f.etd)}</td>
        <td>${formatDateTime(f.eta)}</td>
        <td>${count}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-view"><i class="fa-solid fa-eye"></i> Details</button>
          <button class="btn btn-ghost btn-edit"><i class="fa-solid fa-pen"></i> Edit</button>
        </td>
      </tr>`;
    }).join("");
  }

  function fillFlightDrawer(flight) {
    if (!flight) return;
    setText("#drawer-title", `Flight ${flight.number}`);
    drawerMeta.innerHTML = `
      <div class="kv"><div class="k">Route</div><div class="v"><strong>${flight.origin}</strong> → <strong>${flight.destination}</strong></div></div>
      <div class="kv"><div class="k">Schedule</div><div class="v">${formatDateTime(flight.etd)} → ${formatDateTime(flight.eta)}</div></div>
    `;
    const assignedIds = new Set(flight.assignedShipmentIds || []);
    // Normalize: also include shipments referencing this flight
    loadShipments().forEach(s => { if (s.flightId === flight.id) assignedIds.add(s.id); });
    const assigned = loadShipments().filter(s => assignedIds.has(s.id));

    drawerShipments.innerHTML = assigned.map(s => `
      <tr data-sid="${s.id}">
        <td><code>${escapeHtml(s.code)}</code></td>
        <td>${escapeHtml(s.sender)}</td>
        <td>${escapeHtml(s.recipient)}</td>
        <td>${renderStatusBadge(s.status)}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-unassign"><i class="fa-solid fa-link-slash"></i> Unassign</button>
        </td>
      </tr>
    `).join("");

    // Fill assign select with pending or in-transit unassigned shipments
    const options = loadShipments()
      .filter(s => !assignedIds.has(s.id))
      .filter(s => !s.flightId)
      .map(s => `<option value="${s.id}">${s.code} — ${s.sender} → ${s.recipient}</option>`)
      .join("");
    assignSelect.innerHTML = `<option value="">Select a pending shipment...</option>${options}`;
  }
}

/* Tracking */
function initTracking() {
  const form = document.getElementById("form-tracking");
  const input = document.getElementById("tracking-code");
  const simulateSwitch = document.getElementById("simulate-switch");
  const result = document.getElementById("tracking-result");
  const error = document.getElementById("tracking-error");
  const historyEl = document.getElementById("track-history");
  const progressEl = document.getElementById("track-progress");
  const statusBadge = document.getElementById("track-status-badge");

  let activeCode = null;
  let timer = null;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) return;
    const s = findShipmentByCode(code);
    if (!s) {
      result.hidden = true;
      error.hidden = false;
      if (timer) { clearInterval(timer); timer = null; }
      return;
    }
    activeCode = s.code;
    error.hidden = true;
    result.hidden = false;
    fillTracking(s);
    if (simulateSwitch.checked) startSimulation();
  });

  simulateSwitch.addEventListener("change", () => {
    if (!activeCode) return;
    simulateSwitch.checked ? startSimulation() : stopSimulation();
  });

  window.addEventListener("beforeunload", () => stopSimulation());

  function fillTracking(s) {
    setText("#track-code", s.code);
    setText("#track-summary", `${s.sender} → ${s.recipient}`);
    setText("#detail-sender", s.sender);
    setText("#detail-recipient", s.recipient);
    setText("#detail-origin", s.origin);
    setText("#detail-destination", s.destination);
    setText("#detail-weight", String(s.weight));
    const flight = s.flightId ? findFlightById(s.flightId) : null;
    setText("#detail-flight", flight ? `${flight.number} (${flight.origin} → ${flight.destination})` : "—");

    historyEl.innerHTML = s.history.slice().reverse().map(h => `<li><strong>${h.status}</strong> — <span class="muted">${formatDateTime(h.at)}</span></li>`).join("");

    // Status badge
    statusBadge.className = "badge " + statusClass(s.status);
    statusBadge.textContent = s.status;

    // Progress
    const pct = s.status === "Pending" ? 12 : s.status === "In Transit" ? 62 : 100;
    progressEl.style.width = `${pct}%`;
  }

  function startSimulation() {
    stopSimulation();
    timer = setInterval(() => {
      if (!activeCode) return;
      const s = findShipmentByCode(activeCode);
      if (!s) { stopSimulation(); return; }
      if (s.status === "Delivered") { stopSimulation(); return; }
      const next = s.status === "Pending" ? "In Transit" : "Delivered";
      const updated = updateShipmentStatus(s.id, next);
      fillTracking(updated);
    }, 5000);
  }
  function stopSimulation() {
    if (timer) clearInterval(timer);
    timer = null;
  }
}

/* UI helpers */
function setText(sel, text) {
  const el = document.querySelector(sel);
  if (el) el.textContent = text;
}
function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}
function dayLabel(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function sameDayLabel(iso, label) {
  const d = new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d === label;
}
function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function renderStatusBadge(status) {
  const cls = statusClass(status);
  const icon = statusIcon(status);
  return `<span class="badge ${cls}">${icon} ${status}</span>`;
}
function statusClass(status) {
  if (status === "Pending") return "pending";
  if (status === "In Transit") return "intransit";
  if (status === "Delivered") return "delivered";
  return "";
}
function statusIcon(status) {
  if (status === "Pending") return `<i class="fa-solid fa-clock"></i>`;
  if (status === "In Transit") return `<i class="fa-solid fa-plane"></i>`;
  if (status === "Delivered") return `<i class="fa-solid fa-circle-check"></i>`;
  return `<i class="fa-solid fa-info-circle"></i>`;
}
function openModal(modal) {
  modal?.setAttribute("aria-hidden", "false");
  modal?.querySelectorAll("[data-close-modal]").forEach(btn => btn.addEventListener("click", () => closeModal(modal), { once: true }));
}
function closeModal(modal) {
  modal?.setAttribute("aria-hidden", "true");
}
function confirmDialog(message, onYes) {
  const modal = document.getElementById("modal-confirm");
  const msg = document.getElementById("confirm-message");
  const yes = document.getElementById("confirm-yes");
  msg.textContent = message;
  const onClick = () => {
    onYes?.();
    yes.removeEventListener("click", onClick);
    closeModal(modal);
  };
  yes.addEventListener("click", onClick);
  openModal(modal);
}
function openDrawer(drawer) { drawer?.setAttribute("aria-hidden", "false"); }
function closeDrawer(drawer) { drawer?.setAttribute("aria-hidden", "true"); }

function formDataToObject(fd) {
  const obj = {};
  fd.forEach((v, k) => {

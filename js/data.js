// js/data.js
// Data layer: seed, load/save via localStorage, and helpers.

export const STATUSES = ["Pending", "In Transit", "Delivered"];

const DEFAULT_SHIPMENTS = [
  {
    id: cryptoRandomId(),
    sender: "H&M London Warehouse",
    recipient: "H&M NYC Flagship",
    origin: "LHR",
    destination: "JFK",
    weight: 120.5,
    code: "HM-1A2B3C",
    status: "In Transit",
    createdAt: isoDaysAgo(5),
    flightId: null,
    history: [
      { status: "Pending", at: isoDaysAgo(5) },
      { status: "In Transit", at: isoDaysAgo(4) }
    ]
  },
  {
    id: cryptoRandomId(),
    sender: "H&M Stockholm DC",
    recipient: "H&M Milan Store",
    origin: "ARN",
    destination: "MXP",
    weight: 64.2,
    code: "HM-4D5E6F",
    status: "Pending",
    createdAt: isoDaysAgo(2),
    flightId: null,
    history: [
      { status: "Pending", at: isoDaysAgo(2) }
    ]
  },
  {
    id: cryptoRandomId(),
    sender: "H&M Berlin Depot",
    recipient: "H&M Paris Champs-Élysées",
    origin: "TXL",
    destination: "CDG",
    weight: 78.3,
    code: "HM-7G8H9I",
    status: "Delivered",
    createdAt: isoDaysAgo(7),
    flightId: null,
    history: [
      { status: "Pending", at: isoDaysAgo(7) },
      { status: "In Transit", at: isoDaysAgo(6) },
      { status: "Delivered", at: isoDaysAgo(5) }
    ]
  }
];

const DEFAULT_FLIGHTS = [
  {
    id: cryptoRandomId(),
    number: "HM412",
    origin: "LHR",
    destination: "JFK",
    etd: isoHoursFromNow(-2),
    eta: isoHoursFromNow(4),
    assignedShipmentIds: []
  },
  {
    id: cryptoRandomId(),
    number: "HM205",
    origin: "ARN",
    destination: "MXP",
    etd: isoHoursFromNow(6),
    eta: isoHoursFromNow(9),
    assignedShipmentIds: []
  }
];

const KEY_SHIPMENTS = "hm_shipments";
const KEY_FLIGHTS = "hm_flights";

export function seedIfEmpty() {
  if (!localStorage.getItem(KEY_SHIPMENTS)) {
    localStorage.setItem(KEY_SHIPMENTS, JSON.stringify(DEFAULT_SHIPMENTS));
  }
  if (!localStorage.getItem(KEY_FLIGHTS)) {
    localStorage.setItem(KEY_FLIGHTS, JSON.stringify(DEFAULT_FLIGHTS));
  }
}

export function loadShipments() {
  return JSON.parse(localStorage.getItem(KEY_SHIPMENTS)) || [];
}
export function loadFlights() {
  return JSON.parse(localStorage.getItem(KEY_FLIGHTS)) || [];
}
export function saveShipments(shipments) {
  localStorage.setItem(KEY_SHIPMENTS, JSON.stringify(shipments));
}
export function saveFlights(flights) {
  localStorage.setItem(KEY_FLIGHTS, JSON.stringify(flights));
}

export function findShipmentByCode(code) {
  const shipments = loadShipments();
  return shipments.find(s => s.code.toLowerCase() === code.toLowerCase()) || null;
}
export function findShipmentById(id) {
  const shipments = loadShipments();
  return shipments.find(s => s.id === id) || null;
}
export function findFlightById(id) {
  const flights = loadFlights();
  return flights.find(f => f.id === id) || null;
}

export function upsertShipment(shipment) {
  const shipments = loadShipments();
  const idx = shipments.findIndex(s => s.id === shipment.id);
  if (idx >= 0) {
    shipments[idx] = shipment;
  } else {
    shipments.push(shipment);
  }
  saveShipments(shipments);
  return shipment;
}

export function deleteShipment(id) {
  const shipments = loadShipments().filter(s => s.id !== id);
  // Remove from any flight assignments
  const flights = loadFlights().map(f => ({ ...f, assignedShipmentIds: f.assignedShipmentIds.filter(x => x !== id) }));
  saveShipments(shipments);
  saveFlights(flights);
}

export function upsertFlight(flight) {
  const flights = loadFlights();
  const idx = flights.findIndex(f => f.id === flight.id);
  if (idx >= 0) { flights[idx] = flight; } else { flights.push(flight); }
  saveFlights(flights);
  return flight;
}

export function deleteFlight(id) {
  // Unassign shipments referencing this flight
  const flights = loadFlights().filter(f => f.id !== id);
  const shipments = loadShipments().map(s => (s.flightId === id ? { ...s, flightId: null } : s));
  saveFlights(flights);
  saveShipments(shipments);
}

export function assignShipmentToFlight(shipmentId, flightId) {
  const shipments = loadShipments();
  const flights = loadFlights();
  const sIdx = shipments.findIndex(s => s.id === shipmentId);
  const fIdx = flights.findIndex(f => f.id === flightId);
  if (sIdx === -1 || fIdx === -1) return;
  shipments[sIdx].flightId = flightId;
  if (!flights[fIdx].assignedShipmentIds.includes(shipmentId)) {
    flights[fIdx].assignedShipmentIds.push(shipmentId);
  }
  saveShipments(shipments);
  saveFlights(flights);
}

export function unassignShipmentFromFlight(shipmentId, flightId) {
  const shipments = loadShipments();
  const flights = loadFlights();
  const sIdx = shipments.findIndex(s => s.id === shipmentId);
  const fIdx = flights.findIndex(f => f.id === flightId);
  if (sIdx === -1 || fIdx === -1) return;
  if (shipments[sIdx].flightId === flightId) shipments[sIdx].flightId = null;
  flights[fIdx].assignedShipmentIds = flights[fIdx].assignedShipmentIds.filter(id => id !== shipmentId);
  saveShipments(shipments);
  saveFlights(flights);
}

export function updateShipmentStatus(id, newStatus) {
  const shipments = loadShipments();
  const idx = shipments.findIndex(s => s.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  shipments[idx] = {
    ...shipments[idx],
    status: newStatus,
    history: [...shipments[idx].history, { status: newStatus, at: now }]
  };
  saveShipments(shipments);
  return shipments[idx];
}

export function generateTrackingCode() {
  // Format: HM-XXXXXX (alphanumeric)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `HM-${s}`;
}

/* Helpers */
function isoDaysAgo(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
}
function isoHoursFromNow(h) {
  const dt = new Date();
  dt.setHours(dt.getHours() + h);
  return dt.toISOString();
}
function cryptoRandomId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

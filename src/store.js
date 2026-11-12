/**
 * Notes store for Notewise.
 *
 * Source of truth is localStorage, so the app works fully offline and in
 * demo mode. When Firestore is available and the user is signed in
 * (anonymous), notes are also mirrored to Firestore (collection "notes").
 * A Firestore failure never breaks the app — it logs a warning and keeps
 * using local storage.
 */
import { getDb } from "./firebase.js";

const STORAGE_KEY = "notewise.notes.v1";

function uid() {
  return "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowIso() {
  return new Date().toISOString();
}

export const SAMPLE_NOTES = [
  {
    id: "sample-photosynthesis",
    title: "Photosynthesis — how plants make food",
    body: [
      "Photosynthesis is the process by which green plants, algae and some bacteria convert light energy into chemical energy.",
      "It takes place mainly in the leaves, inside chloroplasts, using the pigment chlorophyll.",
      "The overall equation is: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2.",
      "The light-dependent reactions split water and release oxygen, while the Calvin cycle fixes carbon dioxide into glucose.",
      "Factors that affect the rate include light intensity, carbon dioxide concentration and temperature.",
      "Photosynthesis is the base of nearly every food chain on Earth."
    ].join("\n\n"),
    tags: ["biology", "plants", "energy"],
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    sample: true
  },
  {
    id: "sample-internet",
    title: "How the internet actually works",
    body: [
      "The internet is a network of networks: millions of private, public, academic and government networks connected by common protocols.",
      "The core protocol is TCP/IP. IP addresses packets and routes them, while TCP makes sure they arrive complete and in order.",
      "DNS translates human-readable names like example.com into IP addresses, acting like a phone book for the internet.",
      "When you open a website, your browser asks a DNS server for the address, then opens a TCP connection and requests the page over HTTP or HTTPS.",
      "Data travels in small packets that can take different routes and are reassembled at the destination.",
      "Content delivery networks (CDNs) cache copies of popular content close to users, so pages load faster."
    ].join("\n\n"),
    tags: ["networking", "internet", "protocols"],
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    sample: true
  }
];

export class NotesStore {
  constructor() {
    this.notes = this._load();
    if (this.notes.length === 0) {
      this.notes = SAMPLE_NOTES.map((n) => ({ ...n }));
      this._save();
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes));
    } catch {
      // Storage full or unavailable — the in-memory copy still works.
    }
  }

  list() {
    return [...this.notes].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  get(id) {
    return this.notes.find((n) => n.id === id) || null;
  }

  create() {
    const note = {
      id: uid(),
      title: "",
      body: "",
      tags: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sample: false
    };
    this.notes.unshift(note);
    this._save();
    this._mirrorToFirestore(note);
    return note;
  }

  update(id, patch) {
    const note = this.get(id);
    if (!note) return null;
    Object.assign(note, patch, { updatedAt: nowIso(), sample: false });
    this._save();
    this._mirrorToFirestore(note);
    return note;
  }

  remove(id) {
    this.notes = this.notes.filter((n) => n.id !== id);
    this._save();
    this._deleteFromFirestore(id);
  }

  async _mirrorToFirestore(note) {
    const db = getDb();
    if (!db) return;
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "notes", note.id), {
        title: note.title,
        body: note.body,
        tags: note.tags || [],
        updatedAt: note.updatedAt
      });
    } catch (err) {
      console.warn("[notewise] Firestore sync skipped:", err.code || err.message);
    }
  }

  async _deleteFromFirestore(id) {
    const db = getDb();
    if (!db) return;
    try {
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "notes", id));
    } catch {
      // Local delete already happened; Firestore mirror is best-effort.
    }
  }
}

// Produkt-Registry — die Plattform ist mehrproduktfähig, aktuell ist nur
// Sable gelistet. Ein neues Produkt = ein neuer Eintrag hier (+ eigene
// Sheet-IDs in der .env). Frontend (/api/products) und Redeem-Endpoint
// lesen ausschließlich aus dieser Registry.

"use strict";

function envList(...names) {
  return names.map((n) => process.env[n]).filter(Boolean);
}

const PRODUCTS = {
  sable: {
    slug: "sable",
    name: "Sable 2.0",
    tagline: "Der KI-Agent, der deinen PC bedient — jetzt mit der Circle-Geste.",
    status: "available", // available | coming_soon
    totalSlots: Number(process.env.SABLE_TOTAL_SLOTS || 100),
    // Codes: SABLE-XXXX-XXXX-XXXX, Crockford-Alphabet (kein 0/O/1/I/L/U)
    codePattern: /^SABLE-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/,
    codePlaceholder: "SABLE-XXXX-XXXX-XXXX",
    // Zwei Google Sheets à 50 Codes = ein logischer Pool von 100.
    sheets: envList("SABLE_SHEET_ID_1", "SABLE_SHEET_ID_2").map((id) => ({
      id,
      tab: process.env.SABLE_SHEET_TAB || "Codes",
    })),
    // Auslieferung nach erfolgreicher Einlösung. Der Mechanismus ist bewusst
    // konfigurierbar: URL austauschen genügt (Download-Link, Portal-Login, …).
    // Fallback zeigt auf das im Repo ausgelieferte Sable-2.0-ZIP
    // (public/downloads/) - so funktioniert der Download-Flow ohne .env,
    // production kann per SABLE_DOWNLOAD_URL trotzdem auf eine externe
    // Ablage (CDN, Release-Server) umleiten.
    delivery: {
      type: "download",
      url: process.env.SABLE_DOWNLOAD_URL || "/downloads/Sable2-win-x64.zip",
      label: "Sable 2.0 herunterladen",
      steps: [
        "Lade Sable 2.0 herunter und entpacke den Ordner (ZIP, keine Installation nötig).",
        "Sable2.exe starten. Windows SmartScreen kann beim ersten Start warnen (unsignierte App) — „Weitere Informationen“ → „Trotzdem ausführen“.",
        "Strg + Leertaste öffnet Sable, Strg + Shift + Leertaste startet die Circle-Geste (Bildschirm einkreisen, direkt fragen).",
        "Optional für den Privacy-Modus (alles lokal): Ollama installieren (ollama.com) und in den Sable-Einstellungen auf „Nur lokal“ umschalten.",
      ],
    },
  },

  // Beispiel für ein späteres Produkt (bewusst auskommentiert):
  // nextproduct: {
  //   slug: "nextproduct",
  //   name: "…",
  //   tagline: "…",
  //   status: "coming_soon",
  //   totalSlots: 100,
  //   codePattern: /^NEXT-[2-9A-HJKMNP-TV-Z]{4}-…$/,
  //   sheets: envList("NEXT_SHEET_ID_1").map((id) => ({ id, tab: "Codes" })),
  //   delivery: { type: "download", url: "", label: "…", steps: [] },
  // },
};

function getProduct(slug) {
  return PRODUCTS[slug] || null;
}

// Öffentliche Sicht — ohne Sheets/Patterns, nichts Internes leakt ins Frontend.
function publicProducts() {
  return Object.values(PRODUCTS).map((p) => ({
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    status: p.status,
    totalSlots: p.totalSlots,
  }));
}

module.exports = { PRODUCTS, getProduct, publicProducts };

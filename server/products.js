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
    name: "Sable",
    tagline: "Der KI-Agent, der deinen PC für dich bedient.",
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
    delivery: {
      type: "download",
      url: process.env.SABLE_DOWNLOAD_URL || "", // TODO: echten Release-Link eintragen
      label: "Sable herunterladen",
      steps: [
        "Lade Sable herunter und entpacke den Ordner.",
        "Für ein lokales Modell: installiere Ollama (ollama.com) und starte es einmal. Für ein Cloud-Modell überspringst du diesen Schritt.",
        "Starte Sable und drücke Strg + Leertaste — fertig.",
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

// Einmaliges Import-Script: ersetzt den lokalen Demo-Code-Pool für "sable"
// durch die 100 echten Zugangscodes aus data/codes-all-100.csv.
// Aufruf: node scripts/import-real-codes.js

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { db, importCode } = require("../server/db");

const csvPath = path.join(__dirname, "..", "data", "codes-all-100.csv");
const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n").slice(1);

const before = db.prepare("SELECT COUNT(*) AS n FROM codes WHERE product = 'sable'").get().n;
db.exec("DELETE FROM codes WHERE product = 'sable'");

let count = 0;
for (const line of lines) {
  const code = line.split(",")[0].trim();
  if (!code) continue;
  importCode(code, "sable", { source: "seed" });
  count++;
}

const after = db.prepare("SELECT COUNT(*) AS n FROM codes WHERE product = 'sable'").get().n;
console.log(`Alte Sable-Codes entfernt: ${before}`);
console.log(`Echte Codes importiert: ${count} (in DB jetzt: ${after})`);

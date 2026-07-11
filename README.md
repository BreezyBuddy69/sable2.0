# Sable Sales & Redemption Platform

High-Conversion-Landingpage + Code-Einlösung für den limitierten Sable-Launch
(100 einmalig gültige Zugangscodes, verwaltet in zwei Google Sheets à 50).
Docker-ready für Hostinger-VPS (Deployment via Kodee AI Agent).

## Architektur in einem Absatz

Ein einziger Node-Prozess **ohne npm-Dependencies** (kleine Angriffsfläche,
kein Supply-Chain-Risiko, ~60 MB Image). **SQLite ist die Source of Truth**
für Einlösungen — jede Einlösung läuft als eine Transaktion
(`UPDATE … WHERE status='available'`), Doppel-Einlösung ist damit auch bei
gleichzeitigen Requests strukturell unmöglich. Die zwei Google Sheets sind
nur **Zulieferer** (Codes werden periodisch in die DB gesynct) und
**Spiegel** (Einlöse-Status wird per Retry-Queue zurückgeschrieben). Fällt
die Sheets-API aus, läuft die Einlösung unverändert weiter.

```
Google Sheet 1 (50 Codes) ─┐  Pull-Sync (5 min)          Writeback-Queue (Retry/Backoff)
Google Sheet 2 (50 Codes) ─┴──────────────▶ SQLite ◀────────────── Einlösungen
                                              ▲
                              Landingpage ── /api/redeem (rate-limited, atomar)
```

- Multi-Produkt-fähig: neue Produkte in `server/products.js` eintragen —
  Landingpage-Produktgrid und API ziehen automatisch nach. Aktuell: nur Sable.
- Ohne Google-Credentials startet die Plattform im **lokalen Demo-Modus**
  (100 generierte Codes in `data/demo-codes.txt`) — kompletter Flow testbar.

## Lokal starten

```powershell
cd website
node server/index.js        # braucht Node >= 22.13
# -> http://localhost:8080  (Demo-Codes: website/data/demo-codes.txt)
```

Docker:

```bash
cd website
cp .env.example .env        # ausfüllen (siehe unten)
docker compose up -d --build
curl http://localhost:8080/healthz
```

## Die zwei Google Sheets einrichten

1. **Codes generieren:** `node server/generate-codes.js` erzeugt
   `data/codes-sheet-1.csv` und `data/codes-sheet-2.csv` (je 50 Codes,
   Format `SABLE-XXXX-XXXX-XXXX`, ~59 Bit Entropie). CSVs danach löschen.
2. **Zwei Google Sheets anlegen**, in beiden einen Tab **`Codes`** mit
   Kopfzeile `Code | Status | Eingelöst am | Beleg-ID`; die CSVs importieren
   (Codes stehen ab Zeile 2, Spalte A).
3. **Service Account:** In der [Google Cloud Console](https://console.cloud.google.com)
   ein Projekt anlegen → „Google Sheets API“ aktivieren → Service Account
   erstellen → JSON-Schlüssel herunterladen.
4. **Beide Sheets für die Service-Account-E-Mail freigeben** (Editor-Recht —
   sie muss den Einlöse-Status zurückschreiben).
5. JSON-Schlüssel als Base64 in `.env` eintragen
   (`GOOGLE_SERVICE_ACCOUNT_JSON_B64`), dazu `SABLE_SHEET_ID_1/2`
   (die IDs aus den Sheet-URLs).

Der Server synct die Sheets alle 5 Minuten in die lokale DB. Eingelöste Codes
werden im Ursprungs-Sheet markiert (`REDEEMED` + Zeitstempel + Beleg-ID) —
bei API-Ausfall automatisch später (Backoff bis 1 h, nichts geht verloren).

## Deployment auf Hostinger-VPS (via Kodee AI Agent)

Kodee auf dem VPS anweisen (oder selbst per SSH):

```bash
# 1. Code aufs VPS bringen (git clone oder scp des website/-Ordners)
cd website

# 2. Konfigurieren
cp .env.example .env && nano .env   # Secrets eintragen, TRUST_PROXY=true

# 3. Bauen & starten
docker compose up -d --build

# 4. Prüfen
docker compose ps                    # healthy?
curl http://127.0.0.1:8080/healthz
```

Dann im Hostinger-Panel (bzw. via Kodee) den **Reverse Proxy** einrichten:
Domain → `http://127.0.0.1:8080`, TLS via Let's Encrypt. Beispiel-nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name sable.example.com;   # TODO: echte Domain
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

| Was | Wert |
|---|---|
| Port | 8080 (nur an 127.0.0.1 gebunden, siehe compose) |
| Volume | `sable_data:/data` — **enthält die Einlöse-Wahrheit, nie löschen** |
| Healthcheck | `GET /healthz` (im Image & compose integriert) |
| Logs | `docker compose logs -f` |
| Backup | `docker compose cp sable-platform:/data ./backup-data` |

## ENV-Variablen (vollständig in `.env.example`)

| Variable | Pflicht | Zweck |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON_B64` | für Sheets | Service-Account-JSON, Base64 |
| `SABLE_SHEET_ID_1` / `_2` | für Sheets | die beiden Code-Sheets |
| `SABLE_DOWNLOAD_URL` | vor Launch | Auslieferung nach Einlösung |
| `TRUST_PROXY` | ja | `true` hinter nginx/Traefik, sonst `false` |
| `ADMIN_TOKEN` | optional | schaltet `GET /api/admin/audit` frei |
| `SABLE_TOTAL_SLOTS` | nein | Default 100 |
| `SYNC_INTERVAL_SECONDS` | nein | Default 300 |

## API

| Endpoint | Zweck |
|---|---|
| `GET /` | Landingpage |
| `GET /api/status?product=sable` | Live-Zähler (echter Einlösestand, 5 s Cache) |
| `GET /api/products` | Produktliste fürs Grid (multi-produkt-fähig) |
| `POST /api/redeem` | `{product, code}` → atomare Einlösung; 8 Versuche/10 min/IP |
| `GET /healthz` | Container-Health (DB, Sync-Alter, Queue) |
| `GET /api/admin/audit` | letzte 200 Audit-Einträge (Bearer `ADMIN_TOKEN`) |

Fehlercodes von `/api/redeem`: `invalid_format` (422), `not_found` (404),
`already_redeemed` (409), `rate_limited` (429 + `Retry-After`),
`server_error` (500). Jede Antwort sagt dem Nutzer ausdrücklich, ob sein
Code verbraucht wurde (bei Fehlern: nie).

## Sicherheit (Kurzfassung)

- **Atomare Einlösung:** eine SQLite-Transaktion, single-process serialisiert —
  kein Code kann doppelt eingelöst werden, auch nicht bei Race-Versuchen.
- **Brute-Force:** 8 Versuche/10 min pro IP + globales Limit + 400–900 ms
  Zufallsverzögerung auf Fehlversuche. Codes haben ~59 Bit Entropie.
- **Keine Secrets im Frontend:** Codes und Sheet-Credentials existieren nur
  serverseitig; strikte CSP, keine externen Requests, keine Cookies/Tracker.
- **Audit:** jede Einlösung/jeder Fehlversuch landet in `audit_log`
  (Code, Zeitstempel, tagesgesalzener IP-Hash — keine Klartext-IPs).

## Vor dem echten Launch noch eintragen (TODO)

1. `.env` auf dem VPS: Google-Credentials, beide Sheet-IDs,
   **`SABLE_DOWNLOAD_URL`** (solange leer, zeigt die Erfolgsseite einen
   „Link wird freigeschaltet“-Hinweis statt des Download-Buttons).
2. Echte Codes generieren und in die Sheets importieren (Demo-Modus füllt
   die DB sonst mit Testcodes — vor Produktivgang `data/` bzw. das Volume
   einmal leeren, damit nur Sheet-Codes zählen).
3. Domain + TLS im Hostinger-Panel; danach `TRUST_PROXY=true` verifizieren
   (`/healthz` von außen, Rate-Limit greift pro Besucher-IP).
4. Footer: Impressum & Datenschutzerklärung verlinken (Platzhalter markiert).
5. Optional `ADMIN_TOKEN` setzen und einen Blick in `/api/admin/audit` werfen.

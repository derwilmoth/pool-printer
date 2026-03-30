# Pool Printer

Pool Printer ist eine lokale Druckkonto- und Abrechnungsplattform für Hochschul-/Labornetze.
Sie kombiniert:

- Self-Service für normale Windows-Nutzer (ohne Supervisor-Login)
- Supervisor-Dashboard für Verwaltung und Kasse
- Print Middleware für automatisierte Spooler-Abrechnung

---

## Deutsch (Startklar)

### 1) Was das System macht

Pool Printer verwaltet Guthaben, Druckkosten und Transaktionen pro Nutzerkonto (`userId`).
Druckaufträge werden nicht direkt im Browser ausgelöst, sondern über Windows-Druckerwarteschlangen erkannt und serverseitig abgerechnet.

Kernfunktionen:

- Supervisor-Login (Credentials via NextAuth)
- Benutzerverwaltung (anlegen, aufladen, belasten, kostenlos markieren)
- Self-Service Seite `/public` für Endnutzer
- Automatische Druckabbuchung (S/W und Farbe, mit Preisen aus Einstellungen)
- Manueller Zahlungs-/Buchungsfluss (z. B. Bar/Karte)
- 7-Tage Löschantrag mit Wiederherstellung statt sofortiger Löschung
- PDF-Belege/Rechnungen

### 2) Architektur (wichtig)

Das Projekt läuft bewusst als **Split-Architektur**:

1. **Next.js App**
   - UI + API + SQLite Zugriff
   - Standard-Port lokal: `3000`

2. **Next.js Proxy (`src/proxy.ts`)**
   - Schützt Dashboard/API per Session
   - Erlaubt `/public` und `/api/public/*` ohne Supervisor-Login
   - Schützt `/api/print/*` zusätzlich mit `Authorization: Bearer API_KEY`
   - Optional LAN-Einschränkung (`LAN_ONLY`)

3. **Print Middleware (`print-middleware/index.ts`)**
   - Pollt den Windows Spooler
   - Reserviert Druckkosten vor dem Druck (`/api/print/reserve`)
   - Bestätigt nach Erfolg (`/api/print/confirm`) oder storniert/refundet (`/api/print/cancel`)

### 3) Voraussetzungen

- Windows (für Print-Spooler-Steuerung)
- Node.js 20+
- npm
- Zugriff auf Ziel-Druckerwarteschlangen
- Rechte, um PrintJobs zu lesen/fortzusetzen/zu pausieren

Optional/Produktion:

- PM2 für Prozessverwaltung

### 4) Initiales Setup

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Umgebungsdatei anlegen:

```bash
copy .env.example .env.local
```

3. Pflichtwerte in `.env.local` setzen:

- `NEXTAUTH_SECRET`
- `API_KEY`

4. Datenbank initialisieren:

```bash
npm run db:init
```

Hinweis:

- `db:init` erstellt die SQLite-Datei unter `data/pool-printer.db`.
- Standard-Supervisor wird angelegt: `root / root`.

### 5) Konfiguration (`.env.local`)

Pflicht:

- `NEXTAUTH_SECRET` – Secret für NextAuth/JWT
- `API_KEY` – gemeinsamer Schlüssel zwischen App und Print Middleware

Häufig genutzte Optionen:

- `NEXTAUTH_URL` – Basis-URL der App (Default: `http://localhost:3000`)
- `LAN_ONLY` – `1` = nur Loopback + private Netze, `0` = offen
- `POLL_INTERVAL` – Pollingintervall Print Middleware (ms)
- `PRINTER_BW`, `PRINTER_COLOR` – Druckernamen
- `NEXT_PUBLIC_INVOICE_*` – Rechnungs-/Absenderdaten im PDF

### 6) Datenbankstruktur

Die Anwendung nutzt SQLite mit folgenden Tabellen:

1. `supervisors`

- `id` (PK)
- `username` (unique)
- `password_hash`

2. `users`

- `userId` (PK)
- `balance` (Integer, Cent)
- `is_free_account` (`0/1`)
- `account_state` (`active` | `deletion_requested`)
- `deletion_requested_at`
- `deletion_expires_at`
- `deletion_requested_by`

3. `transactions`

- `id` (PK)
- `userId` (FK -> `users.userId`)
- `amount` (Integer, Cent)
- `pages`
- `type` (`deposit` | `print_bw` | `print_color` | `manual`)
- `description`
- `status` (`pending` | `completed` | `failed` | `refunded`)
- `paymentMethod`
- `timestamp`

4. `settings`

- `key` (PK)
- `value`

Standardwerte in `settings`:

- `price_bw = 5`
- `price_color = 20`
- `session_timeout = 60`

Wichtige Laufzeitlogik:

- Beim DB-Zugriff werden abgelaufene Löschanträge automatisch bereinigt:
  - betroffene `transactions` gelöscht
  - betroffene `users` gelöscht

### 7) Starten in Produktion

1. Build erstellen:

```bash
npm run build
```

2. Next.js App starten:

```bash
npm run start
```

3. Print Middleware separat starten:

```bash
npx tsx print-middleware/index.ts
```

### 8) PM2 Autostart

#### 8.1 Prozesse in PM2 anlegen

```bash
pm2 start npm --name pool-app -- run start
pm2 start npx --name pool-print -- tsx print-middleware/index.ts
```

#### 8.2 Prozessliste speichern

```bash
pm2 save
```

#### 8.3 Autostart aktivieren (Windows)

- PM2 selbst verwaltet Prozesse, aber Boot-Autostart wird in Windows typischerweise per Task Scheduler/Service ergänzt.
- Praxis: PM2 beim Systemstart ausführen und danach `pm2 resurrect` aufrufen.

Beispiel (manuell/testweise):

```bash
pm2 resurrect
```

### 9) Betriebslogik (End-to-End)

#### 9.1 Supervisor-Bereich

- Login über `/login`
- Dashboard zeigt Kennzahlen inkl. manueller Aufträge/Umsatz
- Benutzerseite hat zwei Sichten:
  - `Aktiv`
  - `Löschanträge`
- Nutzer mit `deletion_requested` sind aus normalen Abläufen ausgeklinkt

#### 9.2 Self-Service (`/public`)

- User gibt seine Benutzer-ID direkt ein
- Falls kein Konto existiert: Konto kann angelegt werden
- Kontostand + Transaktionen sichtbar
- Löschantrag kann vom User selbst gestellt und innerhalb von 7 Tagen widerrufen werden

#### 9.3 Druckfluss

**Normal (Erfolgreich):**

1. Print Middleware erkennt Job im Spooler
2. `/api/print/reserve` prüft:
   - Nutzerkonto vorhanden?
   - `account_state = active`?
   - ausreichenendes Guthaben oder Free-Account?
3. Bei Erfolg: Job wird **sofort freigegeben** (Drucker unpausiert), Transaktion `pending` angelegt
4. Bei erfolgreichem Druck: `/api/print/confirm` -> Transaktion `completed`
5. Drucker wird wieder pausiert, falls keine weiteren Aufträge ausstehen

**Fehler: Nutzer nicht vorhanden oder unzureichendes Guthaben:**

- `/api/print/reserve` lehnt ab mit `allowed: false`
- Job wird **sofort und direkt aus der Print Queue gelöscht** (nicht in die Queue genommen)
- **Keine Transaktion** wird angelegt
- **Keine Refund-Logik notwendig** (nie reserviert)
- Middleware loggt: `[DENIED] Job #X from userId: Insufficient balance / User not found`

**Fehler während des Drucks (nach Freigabe):**

- Drucker ist offline, Papierfehler, Job hängt, oder Timeout (>5 Min):
  - `/api/print/cancel` wird aufgerufen -> Transaktion `refunded`
  - Guthaben wird dem Nutzer rückgängig gemacht
- Bei kritischem Fehler nach Druckbeginn: `/api/print/confirm` wird nicht aufgerufen, stattdessen Refund

#### 9.5 Fehlerszenarien und Systemverhalten

| Szenario                       | Verhalten                                                          | Folge                                        |
| ------------------------------ | ------------------------------------------------------------------ | -------------------------------------------- |
| Nutzer existiert nicht         | Job wird sofort gelöscht (vor Freigabe)                            | Nicht sichtbar für User, kein Support-Ticket |
| Guthaben unzureichend          | Job wird sofort gelöscht (vor Freigabe)                            | ——                                           |
| Nutzer in `deletion_requested` | Job wird abgelehnt                                                 | ——                                           |
| Free-Account Nutzer            | Job wird freigegeben (keine Kosten)                                | Transaktion `completed` ohne Belastung       |
| Druckfehler vor Abschluss      | Job wird storniert, Guthaben refundet                              | Transaktion `refunded`                       |
| Job hängt >5 Min               | Timeout, Job wird gelöscht, Guthaben refundet                      | Transaktion `refunded`                       |
| Printer offline                | Job bleibt im Spooler, wird nach Fehlerbereinigung erneut versucht | Middleware loggt Fehler                      |

#### 9.5 Löschantrag (7 Tage)

- Kein sofortiges Hard-Delete mehr
- Statuswechsel auf `deletion_requested`
- `deletion_expires_at = requested_at + 7 Tage`
- Wiederherstellung möglich durch:
  - Supervisor (`/api/users/restore`)
  - User selbst (`/api/public/account-deletion` mit `restore=true`)
- Nach Ablauf werden User + zugehörige Transaktionen automatisch entfernt

### 11) Print Middleware Logging und Debugging

Die Print Middleware gibt ausführliches Logging aus. Bei der Ausführung sehen Sie Meldungen wie:

```
[NEW] Job #123 from maxmustermann on PoolDrucker_SW (10 pages x 1 copies = 10 total, bw, status: Paused)
[DENIED] Job #123 from maxmustermann: Insufficient balance
        Balance: 50, Required: 100
[REMOVED] Job #123 has been deleted from PoolDrucker_SW (user not found or insufficient balance)

[RESUMED] Job #456 - Transaction #789
[COMPLETED] Job #456 - Transaction #789 confirmed
[CANCELLED] Job #456 - Error: Offline, Refunded
[TIMEOUT] Job #456 - Stuck for 305s
[REFUNDED] Job #456 - Timed out, refunded
```

Wichtiger Hinweis: **Abgelehnte Aufträge werden nicht in Logs des Systems gespeichert** (nur in der Console der Middleware). Dies ist beabsichtigt, um die Datenbankgröße zu reduzieren.

### 11) API-Übersicht (wichtigste Routen)

Public:

- `GET /api/public/me`
- `POST /api/public/create-account`
- `GET /api/public/transactions`
- `POST /api/public/account-deletion`

Supervisor/Intern (Session nötig):

- `POST /api/auth/*` (NextAuth)
- `GET/POST/DELETE /api/users`
- `POST /api/users/restore`
- `POST /api/users/deposit`
- `POST /api/users/charge`
- `GET /api/transactions`
- `POST /api/transactions/cancel-manual`
- `GET /api/stats`
- `GET/POST /api/settings`

Print Middleware (API Key geschützt):

- `POST /api/print/reserve`
- `POST /api/print/confirm`
- `POST /api/print/cancel`

---

## English (Getting Started)

### 1) What this system does

Pool Printer is a local print-account and billing platform for campus/lab networks.
It combines:

- End-user self-service (without supervisor login)
- Supervisor dashboard for account and payment operations
- Print middleware for automated spooler-based billing

Main capabilities:

- Supervisor login via NextAuth credentials
- User management (create, deposit, charge, free account flag)
- Public self-service page at `/public`
- Automatic print charging (B/W + color pricing)
- Manual transaction flow (cash/card/etc.)
- 7-day deletion request with restore window
- PDF receipts/invoices

### 2) Architecture (important)

The runtime is intentionally split into separate components:

1. **Next.js app**
   - UI + API + SQLite access

2. **Next.js proxy (`src/proxy.ts`)**
   - Session protection for dashboard/internal APIs
   - Public passthrough for `/public` and `/api/public/*`
   - API key protection for `/api/print/*`
   - Optional LAN IP restriction (`LAN_ONLY`)

3. **Print Middleware (`print-middleware/index.ts`)**
   - Polls Windows Print Spooler every 3 seconds (configurable)
   - Reserves print costs before printing (`/api/print/reserve`)
   - Confirms after success (`/api/print/confirm`) or cancels/refunds (`/api/print/cancel`)

### 3) Requirements

- Windows (for print spooler control)
- Node.js 20+
- npm
- Access to target print queues
- Rights to read/resume/pause PrintJobs

Optional/Production:

- PM2 for process management

### 4) Initial Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
copy .env.example .env.local
```

3. Set required values in `.env.local`:

- `NEXTAUTH_SECRET`
- `API_KEY`

4. Initialize database:

```bash
npm run db:init
```

Note:

- `db:init` creates SQLite file at `data/pool-printer.db`
- Default supervisor created: `root / root`

### 5) Configuration (`.env.local`)

Required:

- `NEXTAUTH_SECRET` – Secret for NextAuth/JWT
- `API_KEY` – shared key between app and print middleware

Common Options:

- `NEXTAUTH_URL` – App base URL (default: `http://localhost:3000`)
- `LAN_ONLY` – `1` = loopback + private networks only, `0` = open
- `POLL_INTERVAL` – Print middleware polling interval (ms)
- `PRINTER_BW`, `PRINTER_COLOR` – printer queue names
- `NEXT_PUBLIC_INVOICE_*` – invoice/sender data for PDF

### 6) Database Structure

The app uses SQLite with the following tables:

1. `supervisors`

- `id` (PK)
- `username` (unique)
- `password_hash`

2. `users`

- `userId` (PK)
- `balance` (Integer, cents)
- `is_free_account` (`0/1`)
- `account_state` (`active` | `deletion_requested`)
- `deletion_requested_at`
- `deletion_expires_at`
- `deletion_requested_by`

3. `transactions`

- `id` (PK)
- `userId` (FK -> `users.userId`)
- `amount` (Integer, cents)
- `pages`
- `type` (`deposit` | `print_bw` | `print_color` | `manual`)
- `description`
- `status` (`pending` | `completed` | `failed` | `refunded`)
- `paymentMethod`
- `timestamp`

4. `settings`

- `key` (PK)
- `value`

Default values in `settings`:

- `price_bw = 5`
- `price_color = 20`
- `session_timeout = 60`

Important runtime logic:

- Expired deletion requests are automatically cleaned up on database access:
  - affected `transactions` deleted
  - affected `users` deleted

### 7) Starting in Production

1. Create build:

```bash
npm run build
```

2. Start Next.js app:

```bash
npm run start
```

3. Start Print Middleware separately:

```bash
npx tsx print-middleware/index.ts
```

### 8) PM2 Autostart

#### 8.1 Create processes in PM2

```bash
pm2 start npm --name pool-app -- run start
pm2 start npx --name pool-print -- tsx print-middleware/index.ts
```

#### 8.2 Save process list

```bash
pm2 save
```

#### 8.3 Enable autostart (Windows)

- PM2 itself manages processes, but boot autostart is typically implemented via Windows Task Scheduler/Service
- Practice: Run PM2 at system startup and then call `pm2 resurrect`

Example (manual/testing):

```bash
pm2 resurrect
```

### 9) Operational Logic (End-to-End)

#### 9.1 Supervisor Area

- Login via `/login`
- Dashboard shows statistics including manual transactions/revenue
- Users page has two views:
  - `Active`
  - `Deletion Requests`
- Users with `deletion_requested` are excluded from normal operations

#### 9.2 Self-Service (`/public`)

- User enters their user ID directly
- If account doesn't exist: can be created
- Account balance + transactions visible
- Deletion request can be submitted by user and reverted within 7 days

#### 9.3 Print Flow

**Normal (Successful):**

1. Print Middleware detects job in spooler
2. `/api/print/reserve` checks:
   - User account exists?
   - `account_state = active`?
   - Sufficient balance or free account?
3. On success: Job is **immediately released** (printer unpaused), transaction `pending` created
4. On successful print: `/api/print/confirm` -> Transaction `completed`
5. Printer paused again if no further jobs pending

**Error: User not found or insufficient balance:**

- `/api/print/reserve` rejects with `allowed: false`
- Job is **immediately and directly deleted from print queue** (not queued)
- **No transaction** created
- **No refund logic necessary** (never reserved)
- Middleware logs: `[DENIED] Job #X from userId: Insufficient balance / User not found`

**Error during print (after release):**

- Printer offline, paper jam, job stuck, or timeout (>5 min):
  - `/api/print/cancel` called -> Transaction `refunded`
  - User balance is refunded
- Critical error after print start: `/api/print/confirm` not called, refund instead

#### 9.4 Error Scenarios and System Behavior

| Scenario                      | Behavior                                          | Consequence                            |
| ----------------------------- | ------------------------------------------------- | -------------------------------------- |
| User does not exist           | Job deleted immediately (before release)          | Not visible to user, no support ticket |
| Insufficient balance          | Job deleted immediately (before release)          | ——                                     |
| User in `deletion_requested`  | Job rejected                                      | ——                                     |
| Free account user             | Job released (no charge)                          | Transaction `completed` without debit  |
| Print error before completion | Job cancelled, balance refunded                   | Transaction `refunded`                 |
| Job stuck >5 min              | Timeout, job deleted, balance refunded            | Transaction `refunded`                 |
| Printer offline               | Job remains in spooler, retried after error clear | Middleware logs error                  |

#### 9.5 Deletion Request (7 Days)

- No immediate hard delete
- Status change to `deletion_requested`
- `deletion_expires_at = requested_at + 7 days`
- Restoration possible via:
  - Supervisor (`/api/users/restore`)
  - User self (`/api/public/account-deletion` with `restore=true`)
- After expiry, user + associated transactions auto-deleted

### 10) Print Middleware Logging and Debugging

The print middleware outputs detailed logging. During execution you will see messages like:

```
[NEW] Job #123 from maxmustermann on PoolDrucker_SW (10 pages x 1 copies = 10 total, bw, status: Paused)
[DENIED] Job #123 from maxmustermann: Insufficient balance
        Balance: 50, Required: 100
[REMOVED] Job #123 has been deleted from PoolDrucker_SW (user not found or insufficient balance)

[RESUMED] Job #456 - Transaction #789
[COMPLETED] Job #456 - Transaction #789 confirmed
[CANCELLED] Job #456 - Error: Offline, Refunded
[TIMEOUT] Job #456 - Stuck for 305s
[REFUNDED] Job #456 - Timed out, refunded
```

Important Note: **Rejected jobs are not stored in system logs** (only in middleware console). This is intentional to reduce database size.

### 11) API Overview (most important routes)

Public:

- `GET /api/public/me`
- `POST /api/public/create-account`
- `GET /api/public/transactions`
- `POST /api/public/account-deletion`

Supervisor/Internal (session required):

- `POST /api/auth/*` (NextAuth)
- `GET/POST/DELETE /api/users`
- `POST /api/users/restore`
- `POST /api/users/deposit`
- `POST /api/users/charge`
- `GET /api/transactions`
- `POST /api/transactions/cancel-manual`
- `GET /api/stats`
- `GET/POST /api/settings`

Print Middleware (API Key protected):

- `POST /api/print/reserve`
- `POST /api/print/confirm`
- `POST /api/print/cancel`

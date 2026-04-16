# Pool Printer

Pool Printer ist eine lokale Druckkonto- und Abrechnungsplattform für Hochschul-/Labornetze.
Sie kombiniert:

- Self-Service für normale Nutzer über `/public`
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
- Manueller Zahlungs-/Buchungsfluss
- 7-Tage Löschantrag mit Wiederherstellung statt sofortiger Löschung
- PDF-Belege/Rechnungen

### 2) Architektur (wichtig)

Das Projekt läuft als Split-Architektur:

1. **Next.js App**
   - UI + API + SQLite Zugriff
   - Standard-Port lokal: `3000`

2. **Next.js Proxy (`src/proxy.ts`)**
   - Schützt Dashboard/API per Session
   - Erlaubt `/public` und `/api/public/*` ohne Supervisor-Login
   - Schützt `/api/print/*` zusätzlich mit `Authorization: Bearer API_KEY`
   - Optional LAN-Einschränkung (`LAN_ONLY`)

3. **PowerShell Launcher (`launch-pool-printer.ps1`)**
   - Liest den aktuellen Windows-Benutzernamen aus
   - Normalisiert immer auf lowercase
   - Öffnet Browser mit `/public?user=<username>`

4. **Print Middleware (`print-middleware/index.ts`)**
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

- `NEXTAUTH_SECRET` - Secret für NextAuth/JWT
- `API_KEY` - gemeinsamer Schlüssel zwischen App und Print Middleware

Häufig genutzte Optionen:

- `NEXTAUTH_URL` - Basis-URL der App (Default: `http://localhost:3000`)
- `LAN_ONLY` - `1` = nur Loopback + private Netze, `0` = offen
- `POLL_INTERVAL` - Pollingintervall Print Middleware (ms)
- `PRINTER_BW`, `PRINTER_COLOR` - Druckernamen
- `NEXT_PUBLIC_INVOICE_*` - Rechnungs-/Absenderdaten im PDF

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

### 8) Public Launcher (PowerShell)

Der Public-Flow arbeitet ohne IIS und ohne Header-Forwarding.
Stattdessen startet man die Public-Seite über das Script `launch-pool-printer.ps1`.

Standardstart:

```powershell
.\launch-pool-printer.ps1
```

Start gegen einen anderen Host:

```powershell
.\launch-pool-printer.ps1 -BaseUrl "http://server-name:3000/public"
```

Das Script:

- liest den aktuellen Windows-Benutzer
- normalisiert den Namen auf lowercase
- öffnet die URL mit `?user=<username>`

Wichtig:

- Der Benutzername wird im Frontend und Backend zusätzlich normalisiert.
- Groß-/Kleinschreibung ist damit immer konsistent lowercase.

### 9) PM2 Autostart

#### 9.1 Prozesse in PM2 anlegen

```bash
pm2 start npm --name pool-app -- run start
pm2 start npx --name pool-print -- tsx print-middleware/index.ts
```

#### 9.2 Prozessliste speichern

```bash
pm2 save
```

#### 9.3 Autostart aktivieren (Windows)

- PM2 selbst verwaltet Prozesse, aber Boot-Autostart wird unter Windows typischerweise per Task Scheduler/Service ergänzt.
- Praxis: PM2 beim Systemstart ausführen und danach `pm2 resurrect` aufrufen.

Beispiel:

```bash
pm2 resurrect
```

### 10) Betriebslogik (End-to-End)

#### 10.1 Supervisor-Bereich

- Login über `/login`
- Dashboard zeigt Kennzahlen inkl. manueller Aufträge/Umsatz
- Benutzerseite hat zwei Sichten:
  - `Aktiv`
  - `Löschanträge`
- Nutzer mit `deletion_requested` sind aus normalen Abläufen ausgeklinkt

#### 10.2 Self-Service (`/public`)

- Public-Benutzer wird aus dem URL-Parameter `user` gelesen
- Falls kein Konto existiert: Konto kann angelegt werden
- Kontostand + Transaktionen sichtbar
- Löschantrag kann vom User selbst gestellt und innerhalb von 7 Tagen widerrufen werden

#### 10.3 Druckfluss

**Normal (erfolgreich):**

1. Print Middleware erkennt Job im Spooler
2. `/api/print/reserve` prüft:
   - Nutzerkonto vorhanden?
   - `account_state = active`?
   - ausreichendes Guthaben oder Free-Account?
3. Bei Erfolg: Job wird freigegeben, Transaktion `pending` angelegt
4. Bei erfolgreichem Druck: `/api/print/confirm` -> Transaktion `completed`
5. Drucker wird wieder pausiert, falls keine weiteren Aufträge ausstehen

**Fehler: Nutzer nicht vorhanden oder unzureichendes Guthaben:**

- `/api/print/reserve` lehnt ab mit `allowed: false`
- Job wird direkt aus der Print Queue gelöscht
- Keine Transaktion wird angelegt

**Fehler während des Drucks:**

- Bei Fehler/Timeout ruft Middleware `/api/print/cancel` auf
- Transaktion wird `refunded`
- Guthaben wird rückgängig gemacht

### 11) API-Übersicht

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

- End-user self-service at `/public`
- Supervisor dashboard for account and payment operations
- Print middleware for automated spooler-based billing

Main capabilities:

- Supervisor login via NextAuth credentials
- User management (create, deposit, charge, free account flag)
- Public self-service page at `/public`
- Automatic print charging (B/W + color pricing)
- Manual transaction flow
- 7-day deletion request with restore window
- PDF receipts/invoices

### 2) Architecture

1. **Next.js app**
   - UI + API + SQLite access
   - Local default port: `3000`

2. **Next.js proxy (`src/proxy.ts`)**
   - Session protection for dashboard/internal APIs
   - Public passthrough for `/public` and `/api/public/*`
   - API key protection for `/api/print/*`
   - Optional LAN IP restriction (`LAN_ONLY`)

3. **PowerShell launcher (`launch-pool-printer.ps1`)**
   - Reads current Windows username
   - Always normalizes to lowercase
   - Opens browser with `/public?user=<username>`

4. **Print middleware (`print-middleware/index.ts`)**
   - Polls Windows spooler
   - Reserves before print (`/api/print/reserve`)
   - Confirms/cancels (`/api/print/confirm`, `/api/print/cancel`)

### 3) Requirements

- Windows
- Node.js 20+
- npm
- Access to target print queues
- Permission to read/resume/pause print jobs

### 4) Setup

```bash
npm install
copy .env.example .env.local
npm run db:init
```

Required `.env.local` keys:

- `NEXTAUTH_SECRET`
- `API_KEY`

### 5) Run

Development:

```bash
npm run dev
```

Production:

```bash
npm run build
npm run start
npx tsx print-middleware/index.ts
```

### 6) Public launcher usage

```powershell
.\launch-pool-printer.ps1
```

Custom host:

```powershell
.\launch-pool-printer.ps1 -BaseUrl "http://server-name:3000/public"
```

The username is forced to lowercase in both launcher and app normalization.

### 7) Main APIs

Public:

- `GET /api/public/me`
- `POST /api/public/create-account`
- `GET /api/public/transactions`
- `POST /api/public/account-deletion`

Supervisor:

- `POST /api/auth/*`
- `GET/POST/DELETE /api/users`
- `POST /api/users/restore`
- `POST /api/users/deposit`
- `POST /api/users/charge`
- `GET /api/transactions`
- `POST /api/transactions/cancel-manual`
- `GET /api/stats`
- `GET/POST /api/settings`

Print middleware:

- `POST /api/print/reserve`
- `POST /api/print/confirm`
- `POST /api/print/cancel`

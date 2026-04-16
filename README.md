# Pool Printer

Pool Printer is a local print-account and billing platform for campus or lab networks.
It combines:

- end-user self-service at `/public`
- a supervisor dashboard for account and payment operations
- print middleware for automated spooler-based billing

---

## Deutsch (Startklar)

### 1) Was das System macht

Pool Printer verwaltet Guthaben, Druckkosten und Transaktionen pro Nutzerkonto (`userId`).
Druckaufträge werden nicht direkt im Browser ausgelöst, sondern über Windows-Druckerwarteschlangen erkannt und serverseitig abgerechnet.

Kernfunktionen:

- Supervisor-Login über NextAuth Credentials
- Benutzerverwaltung: anlegen, aufladen, belasten, kostenlos markieren
- Self-Service für normale Nutzer über `/public`
- Automatische Druckabrechnung für Schwarz/Weiß und Farbe
- Manuelle Transaktionen
- 7-Tage-Löschantrag mit Restore-Fenster
- PDF-Quittungen und Rechnungen

### 2) Architektur

1. **Next.js app**
   - UI, API und SQLite access
   - Local default port: `3000`

2. **Next.js proxy (`src/proxy.ts`)**
   - Session protection for dashboard and internal APIs
   - Public passthrough for `/public` and `/api/public/*`
   - API key protection for `/api/print/*`
   - Optional LAN IP restriction via `LAN_ONLY`

3. **PowerShell launcher (`launch-pool-printer.ps1`)**
   - Liest den aktuellen Windows-Benutzernamen
   - Normalisiert ihn zu lowercase
   - Sendet Benutzername + Secret per POST an `/api/public/launch`
   - Öffnet danach die URL mit `?launchToken=...`

4. **Print middleware (`print-middleware/index.ts`)**
   - Polls the Windows spooler
   - Reserves before print via `/api/print/reserve`
   - Confirms or cancels via `/api/print/confirm` and `/api/print/cancel`

### 3) Anforderungen

- Windows
- Node.js 20+
- npm
- Access to target print queues
- Permission to read, resume, and pause print jobs

### 4) Setup

```bash
npm install
copy .env.example .env.local
npm run db:init
```

Erforderliche `.env.local` Werte:

- `NEXTAUTH_SECRET`
- `API_KEY`
- `PUBLIC_LAUNCH_SECRET`

### 5) Betrieb

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

### 6) Windows Autostart mit PowerShell

Lege im Projektordner diese Datei an:

- `start-pool-printer.ps1`

Das Skript:

- startet die Next.js App im Hintergrund
- startet die Print Middleware im Hintergrund
- kann optional den Autostart als Task anlegen

Normales Starten:

```powershell
.\start-pool-printer.ps1
```

Autostart als Task anlegen:

```powershell
.\start-pool-printer.ps1 -InstallAutostart
```

Hinweise:

- Das Skript verwendet standardmäßig den Ordner, in dem es liegt.
- Vorher einmal `npm run build` ausführen, damit `npm run start` lauffähig ist.
- Die Prozesse laufen im Hintergrund als eigene PowerShell-Prozesse.

### 7) Public Launcher (PowerShell)

Der Public-Flow arbeitet ohne IIS und ohne Header-Forwarding.

Standardstart:

```powershell
.\launch-pool-printer.ps1 -LaunchSecret "DEIN_SECRET"
```

Start gegen einen anderen Host:

```powershell
.\launch-pool-printer.ps1 -BaseUrl "http://server-name:3000/public" -LaunchSecret "DEIN_SECRET"
```

Das Script:

- liest den aktuellen Windows-Benutzer
- normalisiert den Namen auf lowercase
- sendet Benutzername + Secret per POST an `/api/public/launch`
- öffnet danach die URL mit `?launchToken=...`

Wichtig:

- Der Benutzername wird im Frontend und Backend zusätzlich normalisiert.
- Groß-/Kleinschreibung ist damit immer konsistent lowercase.

### 8) Umgebungsvariablen

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-me
API_KEY=change-me
PUBLIC_LAUNCH_SECRET=change-me
PUBLIC_LAUNCH_TTL_SECONDS=120
LAN_ONLY=false
```

`PUBLIC_LAUNCH_SECRET` muss mit dem Secret übereinstimmen, das von `launch-pool-printer.ps1` verwendet wird.

### 9) Betriebslogik (End-to-End)

#### 9.1 Supervisor-Bereich

- Login über `/login`
- Dashboard zeigt Kennzahlen inkl. manueller Aufträge/Umsatz
- Benutzerseite hat zwei Sichten:
  - `Aktiv`
  - `Löschanträge`
- Nutzer mit `deletion_requested` sind aus normalen Abläufen ausgeklinkt

#### 9.2 Self-Service (`/public`)

- Zugriff auf `/public` nur mit gültigem `launchToken`
- Public-Benutzer wird serverseitig aus dem `launchToken` abgeleitet
- Falls kein Konto existiert: Konto kann angelegt werden
- Kontostand + Transaktionen sichtbar
- Löschantrag kann vom User selbst gestellt und innerhalb von 7 Tagen widerrufen werden

#### 9.3 Druckfluss

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

### 10) API-Übersicht

Public:

- `POST /api/public/launch`
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

Pool Printer is a local print-account and billing platform for campus or lab networks.
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
   - Sends username + secret via POST to `/api/public/launch`
   - Opens browser with `/public?launchToken=...`

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
- `PUBLIC_LAUNCH_SECRET`

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

### 5.1) Windows autostart (PowerShell)

Create only this one PowerShell script in the project folder:

- `start-pool-printer.ps1`

The script:

- starts the Next.js app in the background
- starts the print middleware in the background
- can optionally install autostart as a scheduled task

Run it normally:

```powershell
.\start-pool-printer.ps1
```

Create the scheduled task:

```powershell
.\start-pool-printer.ps1 -InstallAutostart
```

Notes:

- The script uses the folder it lives in by default.
- Run `npm run build` once before using `npm run start`.
- The processes run as separate hidden PowerShell processes.

### 6) Public launcher usage

```powershell
.\launch-pool-printer.ps1 -LaunchSecret "YOUR_SECRET"
```

Custom host:

```powershell
.\launch-pool-printer.ps1 -BaseUrl "http://server-name:3000/public" -LaunchSecret "YOUR_SECRET"
```

### 7) Main APIs

Public:

- `POST /api/public/launch`
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

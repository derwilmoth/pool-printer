# Pool-Printer – Druckmanagement & Abrechnungssystem

Ein schlankes System zur Verwaltung und Abrechnung von Druckaufträgen in einem PC-Pool (z. B. Uni, Copyshop, Bibliothek).

## Überblick

Das System besteht aus **zwei Komponenten**:

| Komponente           | Beschreibung                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js Web-App**  | Dashboard für Aufsichtspersonen: Guthaben aufladen, Druckjobs & Nutzer verwalten, Preise konfigurieren, Statistiken einsehen. Studenten haben **keinen** Zugriff.                             |
| **Print Middleware** | Node.js-Skript auf dem Windows Print Server. Kommuniziert mit dem Windows Print Spooler, fängt pausierte Druckaufträge ab, prüft Guthaben über die API und gibt Jobs frei oder blockiert sie. |

## Features

- 💸 **Bargeld-Aufladung** – Aufsichtspersonen laden Nutzerkonten über das Dashboard auf
- 🖨️ **Automatische Abrechnung** – Druckjobs werden pausiert → Guthaben geprüft → bei Erfolg freigegeben & abgebucht
- 🔄 **Load Balancing** – Windows Printer Pooling: mehrere physische Drucker hinter einem virtuellen Drucker
- 🎨 **Farbe & S/W** – Getrennte, konfigurierbare Preise pro Seite
- 📊 **Statistiken** – Umsatz, Seitenanzahl, Druckaufträge (24h / 1 Woche / 1 Monat / 1 Jahr)
- 🛡️ **Aufsichts-Accounts** – Kostenloses Drucken, nicht in Statistiken erfasst
- 🔙 **Auto-Refund** – Automatische Rückerstattung bei Druckerfehlern (+ manuelle Stornierung im Dashboard)
- 🌍 **i18n** – Deutsch (Standard) & Englisch umschaltbar
- 🌙 **Dark Mode** – Hell / Dunkel / System-Einstellung

## Tech Stack

| Technologie                       | Verwendung                    |
| --------------------------------- | ----------------------------- |
| Next.js (App Router)              | Frontend & API                |
| SQLite (better-sqlite3)           | Datenbank (Raw SQL, kein ORM) |
| Tailwind CSS + shadcn/ui          | Styling & UI-Komponenten      |
| Zustand                           | Client State Management       |
| NextAuth (Credentials)            | Authentifizierung (JWT)       |
| next-themes                       | Dark Mode                     |
| Node.js + TypeScript + PowerShell | Print Middleware              |

---

## Installation & Setup

### Voraussetzungen

- **Node.js** ≥ 18
- **Windows** (für die Print Middleware – nutzt PowerShell-Cmdlets)
- Mindestens ein installierter Drucker

### 1. Repository klonen & Abhängigkeiten installieren

```bash
git clone <repo-url>
cd pool-printer
npm install
```

### 2. Umgebungsvariablen konfigurieren

Erstelle eine Datei **`.env.local`** im Projektroot (`pool-printer/.env.local`):

```env
NEXTAUTH_SECRET=ein-langes-zufaelliges-passwort
NEXTAUTH_URL=http://localhost:3000
API_KEY=dein-api-key-hier
```

#### Alle Umgebungsvariablen – Web-App

| Variable          | Pflicht | Standard | Beschreibung                                                                                                                                          |
| ----------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXTAUTH_SECRET` | ✅ Ja   | –        | Geheimer Schlüssel für JWT-Token-Verschlüsselung. Muss ein langer, zufälliger String sein. Kann z. B. mit `openssl rand -base64 32` generiert werden. |
| `NEXTAUTH_URL`    | ✅ Ja   | –        | Die Basis-URL der Web-App. Lokal: `http://localhost:3000`. In Produktion die echte Domain. Wird auch von der Print Middleware als API-URL verwendet.  |
| `API_KEY`         | ✅ Ja   | –        | API-Schlüssel, den die Print Middleware verwendet, um sich bei der Web-App zu authentifizieren. Muss in Middleware und Web-App **identisch** sein.    |

#### Alle Umgebungsvariablen – Print Middleware

Diese werden beim Starten der Middleware gesetzt (per Umgebungsvariable oder `.env`-Datei im `print-middleware/`-Ordner). `NEXTAUTH_URL` und `API_KEY` werden aus der `.env.local` gelesen, wenn die Middleware im gleichen Projektordner läuft:

| Variable        | Pflicht | Standard            | Beschreibung                                                                                |
| --------------- | ------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `API_KEY`       | ✅ Ja   | –                   | API-Schlüssel – **muss identisch** mit `API_KEY` in `.env.local` sein.                      |
| `POLL_INTERVAL` | Nein    | `3000`              | Abfrage-Intervall in Millisekunden. Wie oft der Print Spooler nach neuen Jobs geprüft wird. |
| `PRINTER_BW`    | Nein    | `PoolDrucker_SW`    | Name des virtuellen S/W-Druckers in Windows.                                                |
| `PRINTER_COLOR` | Nein    | `PoolDrucker_Farbe` | Name des virtuellen Farbdruckers in Windows.                                                |

> ⚠️ **Wichtig:** `API_KEY` muss in **beiden** Konfigurationen (`.env.local` der Web-App und Middleware) den gleichen Wert haben!

### 3. Datenbank initialisieren

```bash
npm run db:init
```

Erstellt die SQLite-Datenbank unter `data/pool-printer.db` mit dem Standard-Login:

- **Benutzername:** `root`
- **Passwort:** `root`

> ⚠️ Erstelle nach dem ersten Login einen neuen eigenen Supervisor und lösche root!

### 4. Web-App starten

```bash
# Entwicklung
npm run dev

# Produktion
npm run build
npm start
```

Erreichbar unter `http://localhost:3000`. Einloggen mit `root` / `root`.

---

## Drucker einrichten (Windows)

Die Middleware erwartet zwei virtuelle Drucker: **`PoolDrucker_SW`** (Schwarz-Weiß) und **`PoolDrucker_Farbe`** (Farbe).

### Drucker prüfen

```powershell
Get-Printer | Select-Object Name, PortName, DriverName, PrinterStatus
```

### Drucker umbenennen

```powershell
Rename-Printer -Name "Aktueller Druckername" -NewName "PoolDrucker_SW"
Rename-Printer -Name "Aktueller Farbdrucker" -NewName "PoolDrucker_Farbe"
```

Oder alternativ die Middleware-Variablen `PRINTER_BW` / `PRINTER_COLOR` auf die echten Druckernamen setzen.

### Printer Pooling (Load Balancing für mehrere S/W-Drucker)

Wenn du **mehrere physische S/W-Drucker** hast, kannst du Windows Printer Pooling verwenden. Die Studenten sehen dann nur **einen** virtuellen Drucker, Windows verteilt die Jobs automatisch auf den nächsten freien Drucker.

**Einrichtung:**

1. Stelle sicher, dass beide physischen Drucker installiert sind und funktionieren
2. Merke dir die **Portnamen** beider Drucker:
   ```powershell
   Get-Printer | Select-Object Name, PortName
   ```
3. Einen Drucker auf `PoolDrucker_SW` umbenennen:
   ```powershell
   Rename-Printer -Name "HP LaserJet 1" -NewName "PoolDrucker_SW"
   ```
4. **Druckerpool aktivieren:**
   - **Systemsteuerung** → **Geräte und Drucker**
   - Rechtsklick auf `PoolDrucker_SW` → **Druckereigenschaften**
   - Tab **Anschlüsse** (Ports)
   - Haken bei **☑ Druckerpool aktivieren** (unten)
   - **Beide Ports** anhaken (den eigenen + den des zweiten Druckers)
   - **OK** klicken
5. Zweiten Drucker entfernen (läuft jetzt über den Pool):
   ```powershell
   Remove-Printer -Name "HP LaserJet 2"
   ```

> Das gleiche kann auch für den Farbdrucker gemacht werden, falls mehrere vorhanden sind.

### Drucker anhalten (WICHTIG!)

Damit die Middleware Jobs abfangen kann, müssen die Drucker auf **"Angehalten"** stehen:

1. **Systemsteuerung** → **Geräte und Drucker**
2. Rechtsklick auf `PoolDrucker_SW` → **Alle Druckaufträge anzeigen**
3. Menü **Drucker** → **Drucker anhalten** ✅
4. Das gleiche für `PoolDrucker_Farbe`

> ⚠️ **Ohne diesen Schritt werden Jobs sofort gedruckt und die Middleware kann sie nicht abfangen!**

---

## Print Middleware starten

In einem **separaten Terminal** (muss dauerhaft laufen):

```bash
npx ts-node print-middleware/index.ts
```

Erwartete Ausgabe:

```
=== Print Middleware Starting ===
API URL: http://localhost:3000
Printers: PoolDrucker_SW, PoolDrucker_Farbe
Poll interval: 3000ms
================================
```

Um eigene Druckernamen und API-Key zu verwenden:

```bash
# Windows PowerShell
$env:API_KEY="mein-geheimer-key"; $env:PRINTER_BW="MeinDrucker"; npx ts-node print-middleware/index.ts

# Oder mit .env-Datei (print-middleware/.env):
# API_KEY=mein-geheimer-key
# PRINTER_BW=MeinDrucker
# PRINTER_COLOR=MeinFarbdrucker
```

---

## So funktioniert das System

```
Student druckt auf "PoolDrucker_SW"
        │
        ▼
Job wird pausiert (Drucker steht auf "Angehalten")
        │
        ▼
Middleware erkennt pausierten Job (alle 3 Sekunden)
        │
        ▼
API prüft: Hat der Nutzer genug Guthaben?
        │
   ┌────┴────┐
   │         │
   ▼         ▼
  JA        NEIN
   │         │
   ▼         ▼
Job wird   Job wird
fortgesetzt  gelöscht
   │
   ▼
Druck läuft → Geld wird abgebucht
   │
   ▼
Fehler? → Automatische Rückerstattung
```

---

## Projektstruktur

```
pool-printer/
├── .env.local                  # Umgebungsvariablen (Web-App)
├── data/
│   └── pool-printer.db         # SQLite-Datenbank (nach db:init)
├── print-middleware/
│   └── index.ts                # Print Middleware Skript
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root Layout
│   │   ├── login/page.tsx      # Login-Seite
│   │   └── (dashboard)/
│   │       ├── dashboard/page.tsx  # Statistik-Dashboard
│   │       ├── users/page.tsx      # Nutzerverwaltung
│   │       ├── jobs/page.tsx       # Druckaufträge
│   │       └── settings/page.tsx   # Einstellungen & Preise
│   ├── components/
│   │   ├── app-sidebar.tsx     # Sidebar mit Navigation
│   │   ├── providers.tsx       # Session, Theme, i18n Provider
│   │   └── ui/                 # shadcn/ui Komponenten
│   ├── lib/
│   │   ├── db.ts               # Datenbankverbindung
│   │   ├── useAppStore.ts      # Zustand Store
│   │   └── i18n/               # Übersetzungen (de/en)
│   └── middleware.ts           # Auth & API-Key Middleware
└── scripts/
    └── init-db.js              # Datenbank-Initialisierung
```

---

## Verfügbare Scripts

| Befehl                                  | Beschreibung                             |
| --------------------------------------- | ---------------------------------------- |
| `npm run dev`                           | Startet die Web-App im Entwicklungsmodus |
| `npm run build`                         | Erstellt einen Produktions-Build         |
| `npm start`                             | Startet den Produktions-Build            |
| `npm run db:init`                       | Initialisiert die SQLite-Datenbank       |
| `npx ts-node print-middleware/index.ts` | Startet die Print Middleware             |

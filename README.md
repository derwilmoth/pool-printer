# Print Management & Billing System

Ein schlankes, performantes System zur Verwaltung und Abrechnung von Druckaufträgen in einem PC-Pool.

Dieses System besteht aus zwei Teilen:

1. **Next.js Web-App (Backend & Frontend):** Dient als Datenbank-API und als Management-Dashboard für die Aufsichtspersonen. Benutzer (Studenten) haben hierauf keinen Zugriff.
2. **Node.js Print Middleware:** Ein kleines Skript, das lokal auf dem Windows Print Server läuft, mit dem Windows Print Spooler kommuniziert und Druckaufträge freigibt oder blockiert.

## Features

- 💸 **Bargeld-Aufladung:** Aufsichtspersonen laden das Konto der Nutzer (`userId`) über das Dashboard auf.
- 🖨️ **Automatische Abrechnung:** Druckaufträge werden pausiert, das Guthaben geprüft, sofort reserviert und bei erfolgreichem Druck abgebucht.
- 🔄 **Load Balancing:** Nutzt den nativen Windows-Druckerpool (mehrere physische Drucker hinter einem virtuellen Drucker).
- 🎨 **Farbe & Schwarz-Weiß:** Unterschiedliche Preise, die im Dashboard konfigurierbar sind.
- 📊 **Statistiken:** Übersicht über Umsatz, Seitenanzahl und Druckaufträge (24h, 1 Woche, 1 Monat, 1 Jahr).
- 🛡️ **Aufsichts-Accounts:** Kostenloses Drucken für die Aufsicht (ohne Erfassung in den Statistiken).
- 🔙 **Auto-Refund:** Bei Papierstau oder Druckerfehlern wird das Geld automatisch zurückerstattet (auch manuell im Dashboard möglich).

## Tech Stack

- **Framework:** Next.js (App Router)
- **Datenbank:** SQLite (`better-sqlite3`) mit Raw SQL (kein ORM).
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **Authentifizierung:** NextAuth (Credentials)
- **Middleware:** Node.js + TypeScript + PowerShell

## Installation & Setup

### 1. Web-App vorbereiten

```bash
# Repository klonen
git clone <repo-url>
cd print-management

# Abhängigkeiten installieren
npm install

# Umgebungsvariablen kopieren und anpassen
cp .env.example .env
```

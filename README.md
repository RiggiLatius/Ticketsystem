# Reisser AG — Reklamations-Ticketsystem

Internes, webbasiertes Ticketsystem zur Erfassung und Bearbeitung von Reklamationen.

## Schnellstart (Entwicklung)

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Server läuft danach auf `http://localhost:3000`.

Beim ersten Start wird ein Default-Admin angelegt:

- E-Mail: `admin@firma.de`
- Passwort: `Admin1234!`

Bitte direkt nach dem ersten Login das Passwort ändern.

## Struktur

- `backend/` — Node.js/Express + SQLite (better-sqlite3)
- `frontend/` — Vanilla HTML/CSS/JS, keine externen CDN-Abhängigkeiten
- `backend/data/` — SQLite-Datenbank und Uploads (nicht im Git)

## Umgebungsvariablen

Siehe `backend/.env.example` — dort sind alle SMTP-, IMAP- und Server-Parameter dokumentiert.

## Stand

Meilenstein 1 abgeschlossen: Backend-Grundgerüst, DB-Schema, Default-Seed, Health-Endpoint.

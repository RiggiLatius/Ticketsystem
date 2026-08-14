# Reisser Gruppe — Reklamations-Ticketsystem

Internes, webbasiertes Ticketsystem zur Erfassung und Bearbeitung von Reklamationen.
Backend: Node.js/Express + SQLite (via `better-sqlite3`).
Frontend: Vanilla HTML/CSS/JavaScript, keine externen CDNs.

---

## Funktionsumfang

- **Öffentliches Reklamationsformular** unter `/reklamation.html` — kein Login
  nötig, mit Kategorie-Auswahl (Lieferung, Rechnung, Falsche Ware, Sonstiges),
  Priorität, optionalem Anhang (max. 5 MB) und automatischer Zuweisung an den
  passenden Bereich (Logistik / Buchhaltung / Einkauf).
- **Login-Bereich** (Sessions, 8 h, `bcrypt`-gehashte Passwörter) mit
  Dashboard, Filtern, Suche und Ticket-Detailansicht.
- **Ticket-Detail** mit chronologischer Timeline aller Ereignisse
  (Kommentare, Statuswechsel, Zuweisungen, ein-/ausgehende Mails).
- **E-Mail-Integration**: Ausgehend via SMTP (`nodemailer`), Antworten werden
  per IMAP (`imapflow`) abgeholt und anhand `[Ticket #ID]`-Referenz im Betreff
  automatisch dem richtigen Ticket zugeordnet. Nicht zuordenbare Mails landen
  im Admin-Posteingang.
- **Admin-Bereich**: Benutzer- und Bereichsverwaltung, Passwort-Reset,
  Aktivierung/Deaktivierung, Bereichs-Zuweisungen, opt-out für
  Benachrichtigungen je Benutzer.
- **Berechtigungen**: Admins sehen alles; Bereichs-Benutzer sehen Tickets aus
  ihren Bereichen oder Tickets, die ihnen persönlich zugewiesen wurden.

---

## Schnellstart (Entwicklung)

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Server läuft dann auf <http://localhost:3000>.

Beim ersten Start wird automatisch angelegt:

- Bereiche: `Einkauf`, `Logistik`, `Buchhaltung`
- Default-Admin: `admin@firma.de` / `Admin1234!`
  (Bitte direkt nach dem ersten Login das Passwort ändern.)

Wichtige Adressen:

- `/` — Login und geschützter App-Bereich
- `/reklamation.html` — öffentliches Formular

---

## Deployment mit Docker

```bash
cp backend/.env.example backend/.env   # SMTP/IMAP/SESSION_SECRET setzen
docker compose up --build -d
```

- Der Container läuft als non-root user `app`.
- Persistente Daten (SQLite-DB + Uploads) liegen im Docker-Volume
  `reklamations-data`, gemountet unter `/app/backend/data`.
- Port `3000` wird auf den Host durchgereicht.
- Umgebungsvariablen kommen aus `backend/.env` (`env_file`).

Neustart nach Code-Änderung: `docker compose up --build -d`.
Logs beobachten: `docker compose logs -f app`.

---

## Umgebungsvariablen (`backend/.env`)

Alle Variablen sind in `backend/.env.example` dokumentiert. Die wichtigsten:

| Variable | Zweck |
|---|---|
| `PORT` | HTTP-Port (Default 3000) |
| `SESSION_SECRET` | Für Session-Signing — bitte in Produktion ein starkes, zufälliges Secret |
| `FIRMA_NAME` | Anzeigename in Header und Mail-Signatur |
| `MAIL_FROM` | Absender-Adresse für ausgehende Mails |
| `MAIL_NOTIFY_INBOX` | Interne Benachrichtigungs-Adresse für neue Tickets |
| `SMTP_*` | Ausgehende Mails (host, port, secure, user, pass) |
| `IMAP_*` | Postfach für eingehende Antworten inkl. `IMAP_POLL_INTERVAL_MIN` |
| `UPLOAD_MAX_MB` | Anhang-Grössenlimit (Default 5) |

Wenn `SMTP_HOST`/`SMTP_USER` leer sind, werden ausgehende Mails nur ins Log
geschrieben (praktisch für Entwicklung). Dasselbe gilt für IMAP: fehlt die
Konfiguration, ist der Poller still deaktiviert.

---

## Projektstruktur

```
Ticketsystem/
├── backend/
│   ├── src/
│   │   ├── server.js               Express-Bootstrap, Routen-Wiring, Poller-Start
│   │   ├── config.js               zentrale .env-Auswertung
│   │   ├── db/{database,migrations,seed}.js
│   │   ├── middleware/{auth,errorHandler}.js
│   │   ├── routes/
│   │   │   ├── auth.js             Login/Logout/Me
│   │   │   ├── publicForm.js       öffentliches Reklamationsformular
│   │   │   ├── tickets.js          List, Detail, Aktionen, Kommentar, Mail
│   │   │   ├── users.js            Admin: User-Verwaltung
│   │   │   ├── bereiche.js         Bereichsverwaltung
│   │   │   └── inbox.js            Admin: unzugeordnete IMAP-Mails
│   │   ├── services/
│   │   │   ├── userService.js
│   │   │   ├── ticketService.js    Ticket-Anlage, Event-Log
│   │   │   ├── ticketQueries.js    Zugriffslogik, Filter, Statistik
│   │   │   ├── mailer.js           nodemailer, Log-Fallback
│   │   │   ├── mailMatcher.js      [Ticket #ID]-Parser
│   │   │   ├── imapPoller.js       imapflow-Loop
│   │   │   └── notifications.js    Assign- und Incoming-Mail-Alerts
│   │   └── util/{uuid,uploads}.js
│   ├── data/                        SQLite-DB und Uploads (im .gitignore)
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html                   SPA-Shell für den Login-Bereich
│   ├── reklamation.html             öffentliches Formular
│   ├── css/{base,components,layout,public-form}.css
│   └── js/
│       ├── ui.js, api.js, router.js, auth.js, app.js
│       ├── dashboard.js
│       ├── ticketDetail.js
│       ├── userAdmin.js, bereichAdmin.js, inbox.js
│       └── reklamationForm.js
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Datenmodell (SQLite)

- `users` — id, name, email, password_hash, ist_admin, aktiv, benachrichtigungen
- `bereiche` — id, name, aktiv
- `user_bereiche` — n:m-Zuordnung
- `tickets` — id, betreff, beschreibung, kategorie, bereich_id, prioritaet,
  status, einreicher_name/email, zugewiesen_an, anhang_pfad, timestamps
- `ticket_events` — id, ticket_id, typ (`kommentar` | `statuswechsel` |
  `zuweisung` | `mail_ausgehend` | `mail_eingehend` | `system`), inhalt,
  erstellt_von, erstellt_am
- `inbox_mails` — nicht zuordenbare eingehende Mails (Absender, Betreff, Body)

---

## Sicherheitshinweise

- Default-Admin-Passwort direkt nach dem ersten Login ändern.
- `SESSION_SECRET` in Produktion durch ein starkes, zufälliges Secret ersetzen.
- Ausserhalb eines HTTPS-Reverse-Proxys sollte das System nicht direkt ins
  Netz gestellt werden (Session-Cookie ist mit `sameSite=lax`, wird bei
  `NODE_ENV=production` zusätzlich `secure`).
- Uploads werden per UUID-Dateiname im Uploads-Verzeichnis abgelegt und nur
  über die geschützte Route `/api/anhang/:id` mit Zugriffsprüfung ausgeliefert.

---

## Nächste sinnvolle Erweiterungen (offene Punkte)

- Firmenlogo austauschen: `frontend/assets/logo.*` einbauen und in
  `frontend/index.html` und `reklamation.html` referenzieren.
- Absenderadresse `MAIL_FROM` auf die echte Reisser-Adresse umstellen.
- Rate-Limiting für das öffentliche Formular (falls das Formular ins Intranet
  hinter einen Proxy soll, dort schon per NGINX/HAProxy limitieren).
- Optional: Anhänge auch bei Nachrichten aus der Ticket-Detailansicht.

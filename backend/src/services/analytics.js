const db = require('../db/database');
const { accessibleTicketFilter } = require('./ticketQueries');

function parseDate(s, fallback) {
  if (!s) return fallback;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return fallback;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseList(s) {
  if (!s) return [];
  return String(s)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildTicketFilter(user, opts) {
  const acc = accessibleTicketFilter(user);
  const parts = [acc.where];
  const params = [...acc.params];

  const bereichIds = parseList(opts.bereich_ids);
  if (bereichIds.length) {
    parts.push(`t.bereich_id IN (${bereichIds.map(() => '?').join(',')})`);
    params.push(...bereichIds);
  }
  const bearbeiterIds = parseList(opts.bearbeiter_ids);
  if (bearbeiterIds.length) {
    parts.push(`t.zugewiesen_an IN (${bearbeiterIds.map(() => '?').join(',')})`);
    params.push(...bearbeiterIds);
  }
  const prios = parseList(opts.prioritaeten);
  if (prios.length) {
    parts.push(`t.prioritaet IN (${prios.map(() => '?').join(',')})`);
    params.push(...prios);
  }
  const kats = parseList(opts.kategorien);
  if (kats.length) {
    parts.push(`t.kategorie IN (${kats.map(() => '?').join(',')})`);
    params.push(...kats);
  }
  return { where: parts.join(' AND '), params };
}

function bucketExpr(dateCol, granularitaet) {
  if (granularitaet === 'monat') {
    return `strftime('%Y-%m', ${dateCol})`;
  }
  return `strftime('%Y-%W', ${dateCol})`;
}

function labelForBucket(bucket, granularitaet) {
  if (granularitaet === 'monat') {
    return bucket;
  }
  const [y, w] = bucket.split('-');
  return `KW ${parseInt(w, 10)}/${y.slice(2)}`;
}

function iterateBuckets(von, bis, granularitaet) {
  const results = [];
  const start = new Date(von + 'T00:00:00Z');
  const end = new Date(bis + 'T00:00:00Z');
  if (granularitaet === 'monat') {
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cur <= end) {
      const key = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0');
      results.push(key);
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  } else {
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const week = String(sqliteWeek(cur)).padStart(2, '0');
      const key = `${y}-${week}`;
      if (results[results.length - 1] !== key) results.push(key);
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
    const lastKey = `${end.getUTCFullYear()}-${String(sqliteWeek(end)).padStart(2, '0')}`;
    if (results[results.length - 1] !== lastKey) results.push(lastKey);
  }
  return results;
}

function sqliteWeek(d) {
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((d - jan1) / 86400000);
  const jan1Dow = jan1.getUTCDay();
  return Math.floor((diffDays + jan1Dow) / 7);
}

function computeAnalytics(user, opts) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultVon = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  })();
  const von = parseDate(opts.von, defaultVon);
  const bis = parseDate(opts.bis, today);
  const granularitaet = opts.granularitaet === 'monat' ? 'monat' : 'woche';

  const filter = buildTicketFilter(user, opts);
  const bereichNameJoin =
    'LEFT JOIN bereiche b ON b.id = t.bereich_id';
  const userJoin = 'LEFT JOIN users u ON u.id = t.zugewiesen_an';

  // --- KPIs ---
  const kpiNeu = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where} AND date(t.erstellt_am) BETWEEN ? AND ?`
    )
    .get(...filter.params, von, bis).n;

  const kpiGeloest = db
    .prepare(
      `SELECT COUNT(DISTINCT t.id) AS n
         FROM tickets t ${bereichNameJoin} ${userJoin}
         JOIN ticket_events e ON e.ticket_id = t.id
        WHERE ${filter.where}
          AND e.typ = 'statuswechsel'
          AND e.inhalt LIKE '%"nach":"geloest"%'
          AND date(e.erstellt_am) BETWEEN ? AND ?`
    )
    .get(...filter.params, von, bis).n;

  const kpiOffen = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where} AND t.status IN ('offen','in_bearbeitung','warte_rueckmeldung')`
    )
    .get(...filter.params).n;

  const kpiDringend = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where}
          AND t.status IN ('offen','in_bearbeitung','warte_rueckmeldung')
          AND t.prioritaet IN ('hoch','dringend')`
    )
    .get(...filter.params).n;

  // Durchschnittliche Bearbeitungszeit (Stunden) fuer im Zeitraum geloeste Tickets
  const kpiZeitRow = db
    .prepare(
      `SELECT AVG((julianday(min_e.erstellt_am) - julianday(t.erstellt_am)) * 24.0) AS avg_h,
              COUNT(*) AS n
         FROM tickets t ${bereichNameJoin} ${userJoin}
         JOIN (
           SELECT ticket_id, MIN(erstellt_am) AS erstellt_am
             FROM ticket_events
            WHERE typ = 'statuswechsel' AND inhalt LIKE '%"nach":"geloest"%'
            GROUP BY ticket_id
         ) min_e ON min_e.ticket_id = t.id
        WHERE ${filter.where}
          AND date(min_e.erstellt_am) BETWEEN ? AND ?`
    )
    .get(...filter.params, von, bis);

  // --- Zeitverlauf ---
  const bucketNeu = bucketExpr('t.erstellt_am', granularitaet);
  const rowsNeu = db
    .prepare(
      `SELECT ${bucketNeu} AS bucket, COUNT(*) AS n
         FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where} AND date(t.erstellt_am) BETWEEN ? AND ?
        GROUP BY bucket`
    )
    .all(...filter.params, von, bis);

  const bucketGel = bucketExpr('e.erstellt_am', granularitaet);
  const rowsGel = db
    .prepare(
      `SELECT ${bucketGel} AS bucket, COUNT(DISTINCT t.id) AS n
         FROM tickets t ${bereichNameJoin} ${userJoin}
         JOIN ticket_events e ON e.ticket_id = t.id
        WHERE ${filter.where}
          AND e.typ = 'statuswechsel'
          AND e.inhalt LIKE '%"nach":"geloest"%'
          AND date(e.erstellt_am) BETWEEN ? AND ?
        GROUP BY bucket`
    )
    .all(...filter.params, von, bis);

  const buckets = iterateBuckets(von, bis, granularitaet);
  const mapNeu = Object.fromEntries(rowsNeu.map((r) => [r.bucket, r.n]));
  const mapGel = Object.fromEntries(rowsGel.map((r) => [r.bucket, r.n]));
  const zeitverlauf = buckets.map((b) => ({
    bucket: b,
    label: labelForBucket(b, granularitaet),
    neu: mapNeu[b] || 0,
    geloest: mapGel[b] || 0,
  }));

  // --- Verteilungen ---
  const nachBereich = db
    .prepare(
      `SELECT COALESCE(b.name, 'Kein Bereich') AS name,
              SUM(CASE WHEN date(t.erstellt_am) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS neu,
              SUM(CASE WHEN t.status IN ('offen','in_bearbeitung','warte_rueckmeldung') THEN 1 ELSE 0 END) AS offen,
              COUNT(*) AS gesamt
         FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where}
        GROUP BY COALESCE(b.name, 'Kein Bereich')
        ORDER BY gesamt DESC`
    )
    .all(von, bis, ...filter.params);

  // gelöst pro Bereich im Zeitraum
  const geloestNachBereich = db
    .prepare(
      `SELECT COALESCE(b.name, 'Kein Bereich') AS name, COUNT(DISTINCT t.id) AS geloest
         FROM tickets t ${bereichNameJoin} ${userJoin}
         JOIN ticket_events e ON e.ticket_id = t.id
        WHERE ${filter.where}
          AND e.typ = 'statuswechsel' AND e.inhalt LIKE '%"nach":"geloest"%'
          AND date(e.erstellt_am) BETWEEN ? AND ?
        GROUP BY COALESCE(b.name, 'Kein Bereich')`
    )
    .all(...filter.params, von, bis);
  const geloestMap = Object.fromEntries(geloestNachBereich.map((r) => [r.name, r.geloest]));
  for (const r of nachBereich) r.geloest = geloestMap[r.name] || 0;

  const nachPrioritaet = db
    .prepare(
      `SELECT t.prioritaet AS name, COUNT(*) AS n
         FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where} AND date(t.erstellt_am) BETWEEN ? AND ?
        GROUP BY t.prioritaet`
    )
    .all(...filter.params, von, bis);

  const nachStatus = db
    .prepare(
      `SELECT t.status AS name, COUNT(*) AS n
         FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where}
        GROUP BY t.status`
    )
    .all(...filter.params);

  const nachKategorie = db
    .prepare(
      `SELECT t.kategorie AS name, COUNT(*) AS n
         FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where} AND date(t.erstellt_am) BETWEEN ? AND ?
        GROUP BY t.kategorie
        ORDER BY n DESC`
    )
    .all(...filter.params, von, bis);

  const nachBearbeiter = db
    .prepare(
      `SELECT COALESCE(u.name, 'Nicht zugewiesen') AS name, COUNT(*) AS n
         FROM tickets t ${bereichNameJoin} ${userJoin}
        WHERE ${filter.where} AND date(t.erstellt_am) BETWEEN ? AND ?
        GROUP BY COALESCE(u.name, 'Nicht zugewiesen')
        ORDER BY n DESC
        LIMIT 10`
    )
    .all(...filter.params, von, bis);

  // Meta fuer die Filter-UI
  const bereicheAll = db.prepare('SELECT id, name FROM bereiche ORDER BY name').all();
  const usersAll = db
    .prepare('SELECT id, name FROM users WHERE aktiv = 1 ORDER BY name')
    .all();

  return {
    zeitraum: { von, bis, granularitaet },
    kpi: {
      neu: kpiNeu,
      geloest: kpiGeloest,
      offen_aktuell: kpiOffen,
      hoch_dringend_offen: kpiDringend,
      avg_bearbeitungszeit_stunden: kpiZeitRow.avg_h ? Math.round(kpiZeitRow.avg_h * 10) / 10 : null,
      geloest_mit_zeit: kpiZeitRow.n,
    },
    zeitverlauf,
    nach_bereich: nachBereich,
    nach_prioritaet: nachPrioritaet,
    nach_status: nachStatus,
    nach_kategorie: nachKategorie,
    nach_bearbeiter: nachBearbeiter,
    meta: { bereiche: bereicheAll, bearbeiter: usersAll },
  };
}

module.exports = { computeAnalytics };

const ExcelJS = require('exceljs');
const { computeAnalytics } = require('./analytics');
const { listTickets } = require('./ticketQueries');
const { shortId } = require('../util/uuid');
const config = require('../config');

const STATUS_LABELS = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  warte_rueckmeldung: 'Warte auf Rückmeldung',
  geloest: 'Gelöst',
  geschlossen: 'Geschlossen',
};
const PRIO_LABELS = { normal: 'Normal', hoch: 'Hoch', dringend: 'Dringend' };
const KATEGORIE_LABELS = {
  lieferung_versand: 'Lieferung / Versand',
  rechnung_zahlung: 'Rechnung / Zahlung',
  falsche_ware_lieferant: 'Falsche Ware / Lieferant',
  sonstiges: 'Sonstiges',
};

const HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF009F4D' } },
  alignment: { vertical: 'middle', horizontal: 'left' },
  border: {
    bottom: { style: 'thin', color: { argb: 'FF007A3A' } },
  },
};
const TOTAL_STYLE = {
  font: { bold: true },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF5EE' } },
};

function styleHeaderRow(row) {
  row.eachCell({ includeEmpty: false }, (cell) => Object.assign(cell, HEADER_STYLE));
  row.height = 22;
}

function autoWidth(sheet) {
  sheet.columns.forEach((col) => {
    let max = col.header ? String(col.header).length : 8;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value == null ? '' : String(cell.value);
      const len = v.length;
      if (len > max) max = len;
    });
    col.width = Math.min(60, Math.max(10, max + 2));
  });
}

function meta(sheet, title, opts) {
  sheet.mergeCells('A1:F1');
  const t = sheet.getCell('A1');
  t.value = `${config.firmaName} — ${title}`;
  t.font = { bold: true, size: 14, color: { argb: 'FF009F4D' } };
  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value =
    'Erstellt am ' + new Date().toLocaleString('de-DE') + (opts ? ' · ' + opts : '');
  sheet.getCell('A2').font = { color: { argb: 'FF57606A' }, italic: true };
  sheet.addRow([]);
}

async function analyticsWorkbook(user, opts) {
  const data = computeAnalytics(user, opts);
  const wb = new ExcelJS.Workbook();
  wb.creator = config.firmaName;
  wb.created = new Date();

  const z = data.zeitraum;
  const zeitraumTxt = `Zeitraum ${z.von} bis ${z.bis}, Granularität ${z.granularitaet === 'monat' ? 'Monat' : 'Kalenderwoche'}`;

  // Sheet 1: KPIs
  {
    const s = wb.addWorksheet('Kennzahlen', { views: [{ showGridLines: false }] });
    meta(s, 'Kennzahlen — Übersicht', zeitraumTxt);
    s.columns = [
      { header: 'Kennzahl', key: 'k', width: 40 },
      { header: 'Wert', key: 'v', width: 20 },
      { header: 'Erläuterung', key: 'e', width: 50 },
    ];
    styleHeaderRow(s.getRow(4));
    s.addRow({ k: 'Neue Tickets im Zeitraum', v: data.kpi.neu, e: 'Erstellt zwischen ' + z.von + ' und ' + z.bis });
    s.addRow({ k: 'Gelöste Tickets im Zeitraum', v: data.kpi.geloest, e: 'Erster Statuswechsel auf "gelöst" im Zeitraum' });
    s.addRow({ k: 'Offen aktuell', v: data.kpi.offen_aktuell, e: 'Status: offen, in Bearbeitung oder warte auf Rückmeldung' });
    s.addRow({ k: 'Hoch/Dringend offen', v: data.kpi.hoch_dringend_offen, e: 'Priorität hoch oder dringend, nicht abgeschlossen' });
    s.addRow({
      k: 'Ø Bearbeitungszeit (Stunden)',
      v: data.kpi.avg_bearbeitungszeit_stunden != null ? data.kpi.avg_bearbeitungszeit_stunden : '—',
      e: data.kpi.geloest_mit_zeit
        ? `Berechnet aus ${data.kpi.geloest_mit_zeit} Tickets`
        : 'Noch keine gelösten Tickets im Zeitraum',
    });
  }

  // Sheet 2: Zeitverlauf
  {
    const s = wb.addWorksheet('Zeitverlauf', { views: [{ showGridLines: false }] });
    meta(s, 'Zeitverlauf', zeitraumTxt);
    s.columns = [
      { header: 'Periode', key: 'label', width: 20 },
      { header: 'Bucket', key: 'bucket', width: 15 },
      { header: 'Neue Tickets', key: 'neu', width: 15 },
      { header: 'Gelöste Tickets', key: 'geloest', width: 18 },
    ];
    styleHeaderRow(s.getRow(4));
    for (const b of data.zeitverlauf) s.addRow(b);
    const totalRow = s.addRow({
      label: 'Summe',
      bucket: '',
      neu: data.zeitverlauf.reduce((sum, b) => sum + b.neu, 0),
      geloest: data.zeitverlauf.reduce((sum, b) => sum + b.geloest, 0),
    });
    totalRow.eachCell((c) => Object.assign(c, TOTAL_STYLE));
  }

  // Sheet 3: Nach Bereich
  {
    const s = wb.addWorksheet('Nach Bereich', { views: [{ showGridLines: false }] });
    meta(s, 'Aufschlüsselung nach Bereich', zeitraumTxt);
    s.columns = [
      { header: 'Bereich', key: 'name', width: 24 },
      { header: 'Neu im Zeitraum', key: 'neu', width: 18 },
      { header: 'Gelöst im Zeitraum', key: 'geloest', width: 20 },
      { header: 'Offen aktuell', key: 'offen', width: 16 },
      { header: 'Gesamt', key: 'gesamt', width: 12 },
    ];
    styleHeaderRow(s.getRow(4));
    for (const r of data.nach_bereich) s.addRow(r);
    const totalRow = s.addRow({
      name: 'Summe',
      neu: data.nach_bereich.reduce((sum, r) => sum + (r.neu || 0), 0),
      geloest: data.nach_bereich.reduce((sum, r) => sum + (r.geloest || 0), 0),
      offen: data.nach_bereich.reduce((sum, r) => sum + (r.offen || 0), 0),
      gesamt: data.nach_bereich.reduce((sum, r) => sum + (r.gesamt || 0), 0),
    });
    totalRow.eachCell((c) => Object.assign(c, TOTAL_STYLE));
  }

  // Sheet 4: Nach Priorität
  {
    const s = wb.addWorksheet('Nach Priorität', { views: [{ showGridLines: false }] });
    meta(s, 'Verteilung nach Priorität', zeitraumTxt);
    s.columns = [
      { header: 'Priorität', key: 'name', width: 18 },
      { header: 'Anzahl', key: 'n', width: 12 },
    ];
    styleHeaderRow(s.getRow(4));
    for (const r of data.nach_prioritaet) s.addRow({ name: PRIO_LABELS[r.name] || r.name, n: r.n });
  }

  // Sheet 5: Nach Status
  {
    const s = wb.addWorksheet('Nach Status', { views: [{ showGridLines: false }] });
    meta(s, 'Aktueller Bestand nach Status', '');
    s.columns = [
      { header: 'Status', key: 'name', width: 24 },
      { header: 'Anzahl', key: 'n', width: 12 },
    ];
    styleHeaderRow(s.getRow(4));
    for (const r of data.nach_status) s.addRow({ name: STATUS_LABELS[r.name] || r.name, n: r.n });
  }

  // Sheet 6: Nach Kategorie
  {
    const s = wb.addWorksheet('Nach Kategorie', { views: [{ showGridLines: false }] });
    meta(s, 'Verteilung nach Kategorie', zeitraumTxt);
    s.columns = [
      { header: 'Kategorie', key: 'name', width: 34 },
      { header: 'Anzahl', key: 'n', width: 12 },
    ];
    styleHeaderRow(s.getRow(4));
    for (const r of data.nach_kategorie) s.addRow({ name: KATEGORIE_LABELS[r.name] || r.name, n: r.n });
  }

  // Sheet 7: Top-Bearbeiter
  {
    const s = wb.addWorksheet('Top-Bearbeiter', { views: [{ showGridLines: false }] });
    meta(s, 'Top-Bearbeiter im Zeitraum', zeitraumTxt);
    s.columns = [
      { header: 'Bearbeiter', key: 'name', width: 30 },
      { header: 'Zugewiesene Tickets', key: 'n', width: 22 },
    ];
    styleHeaderRow(s.getRow(4));
    for (const r of data.nach_bearbeiter) s.addRow(r);
  }

  return { workbook: wb, filename: buildFilename('Kennzahlen', z.von, z.bis) };
}

async function ticketListWorkbook(user, opts) {
  const tickets = listTickets(user, opts);
  const wb = new ExcelJS.Workbook();
  wb.creator = config.firmaName;
  wb.created = new Date();

  const s = wb.addWorksheet('Tickets', { views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }] });
  meta(s, 'Ticket-Liste', filterSummary(opts));

  s.columns = [
    { header: 'Ticket-Nr.', key: 'kurz', width: 12 },
    { header: 'Betreff', key: 'betreff', width: 40 },
    { header: 'Bereich', key: 'bereich', width: 16 },
    { header: 'Status', key: 'status', width: 22 },
    { header: 'Priorität', key: 'prio', width: 12 },
    { header: 'Kategorie', key: 'kategorie', width: 26 },
    { header: 'Zugewiesen an', key: 'zug', width: 24 },
    { header: 'Einreicher (Name)', key: 'ein_name', width: 22 },
    { header: 'Einreicher (E-Mail)', key: 'ein_email', width: 28 },
    { header: 'Niederlassung', key: 'niederlassung', width: 22 },
    { header: 'Erstellt am', key: 'erstellt', width: 18 },
    { header: 'Aktualisiert am', key: 'aktualisiert', width: 18 },
  ];
  styleHeaderRow(s.getRow(4));

  for (const t of tickets) {
    s.addRow({
      kurz: shortId(t.id),
      betreff: t.betreff,
      bereich: t.bereich_name || '—',
      status: STATUS_LABELS[t.status] || t.status,
      prio: PRIO_LABELS[t.prioritaet] || t.prioritaet,
      kategorie: KATEGORIE_LABELS[t.kategorie] || t.kategorie,
      zug: t.zugewiesen_name || '—',
      ein_name: t.einreicher_name || '',
      ein_email: t.einreicher_email || '',
      niederlassung: t.niederlassung || '',
      erstellt: new Date((t.erstellt_am || '').replace(' ', 'T') + 'Z'),
      aktualisiert: new Date((t.aktualisiert_am || '').replace(' ', 'T') + 'Z'),
    });
  }
  s.getColumn('erstellt').numFmt = 'dd.mm.yyyy hh:mm';
  s.getColumn('aktualisiert').numFmt = 'dd.mm.yyyy hh:mm';

  const summary = s.addRow({ kurz: `Summe: ${tickets.length} Tickets` });
  summary.eachCell((c) => Object.assign(c, TOTAL_STYLE));

  return { workbook: wb, filename: buildFilename('Tickets') };
}

function filterSummary(opts) {
  const parts = [];
  if (opts.status) parts.push(`Status=${opts.status}`);
  if (opts.prioritaet) parts.push(`Priorität=${opts.prioritaet}`);
  if (opts.mine === 'true' || opts.mine === '1' || opts.mine === true) parts.push('Nur mir zugewiesen');
  if (opts.q) parts.push(`Suche="${opts.q}"`);
  return parts.length ? 'Filter: ' + parts.join(', ') : 'Alle sichtbaren Tickets';
}

function buildFilename(name, von, bis) {
  const d = new Date().toISOString().slice(0, 10);
  const suffix = von && bis ? `_${von}_bis_${bis}` : '';
  return `${config.firmaName.replace(/\s+/g, '_')}_${name}${suffix}_${d}.xlsx`;
}

module.exports = { analyticsWorkbook, ticketListWorkbook };

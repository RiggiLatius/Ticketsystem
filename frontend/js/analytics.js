(function (global) {
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
  const STATUS_COLORS = {
    offen: '#9ca3af',
    in_bearbeitung: '#0f6cbd',
    warte_rueckmeldung: '#b76b00',
    geloest: '#1a7f37',
    geschlossen: '#4b5563',
  };
  const PRIO_COLORS = {
    normal: '#6e7781',
    hoch: '#b76b00',
    dringend: '#c8321f',
  };

  const state = {
    filter: defaultFilter(),
    meta: { bereiche: [], bearbeiter: [] },
  };

  function defaultFilter() {
    const bis = new Date();
    const von = new Date();
    von.setDate(bis.getDate() - 90);
    return {
      von: iso(von),
      bis: iso(bis),
      granularitaet: 'woche',
      bereich_ids: [],
      bearbeiter_ids: [],
      prioritaeten: [],
    };
  }

  function iso(d) {
    return d.toISOString().slice(0, 10);
  }

  function applyPreset(preset) {
    const bis = new Date();
    const von = new Date();
    if (preset === 'aktuelle_woche') {
      const dow = (bis.getDay() + 6) % 7;
      von.setDate(bis.getDate() - dow);
      state.filter.granularitaet = 'woche';
    } else if (preset === 'letzte_4_wochen') {
      von.setDate(bis.getDate() - 27);
      state.filter.granularitaet = 'woche';
    } else if (preset === 'aktueller_monat') {
      von.setDate(1);
      state.filter.granularitaet = 'monat';
    } else if (preset === 'letzte_3_monate') {
      von.setMonth(bis.getMonth() - 2);
      von.setDate(1);
      state.filter.granularitaet = 'monat';
    } else if (preset === 'ytd') {
      von.setMonth(0);
      von.setDate(1);
      state.filter.granularitaet = 'monat';
    }
    state.filter.von = iso(von);
    state.filter.bis = iso(bis);
  }

  function queryString() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state.filter)) {
      if (Array.isArray(v)) {
        if (v.length) params.set(k, v.join(','));
      } else if (v != null && v !== '') {
        params.set(k, v);
      }
    }
    return params.toString();
  }

  const Analytics = {};

  Analytics.render = function (user) {
    const wrap = UI.el('div', { class: 'stack analytics-page' });
    const heading = UI.el(
      'div',
      { class: 'page-heading' },
      UI.el('h1', { style: 'margin:0' }, 'Kennzahlen'),
      UI.el(
        'div',
        { class: 'muted' },
        user.ist_admin ? 'Alle Bereiche einsehbar' : 'Zahlen basieren auf Ihren Bereichen'
      )
    );

    const filterBar = UI.el('div', { class: 'analytics-filter card' });
    const content = UI.el('div', { class: 'stack' });
    wrap.append(heading, filterBar, content);

    function reload() {
      renderFilterBar(filterBar, reload);
      loadAndRender(content);
    }
    reload();
    return wrap;
  };

  function renderFilterBar(container, onReload) {
    UI.clear(container);
    const presets = [
      ['aktuelle_woche', 'Aktuelle Woche'],
      ['letzte_4_wochen', 'Letzte 4 Wochen'],
      ['aktueller_monat', 'Aktueller Monat'],
      ['letzte_3_monate', 'Letzte 3 Monate'],
      ['ytd', 'Jahr bis heute'],
    ];
    const presetBtns = presets.map(([k, label]) =>
      UI.el(
        'button',
        {
          class: 'btn btn--sm',
          onclick: () => {
            applyPreset(k);
            onReload();
          },
        },
        label
      )
    );

    const von = UI.el('input', {
      type: 'date',
      class: 'form-input',
      value: state.filter.von,
      onchange: (e) => { state.filter.von = e.target.value; onReload(); },
    });
    const bis = UI.el('input', {
      type: 'date',
      class: 'form-input',
      value: state.filter.bis,
      onchange: (e) => { state.filter.bis = e.target.value; onReload(); },
    });
    const gran = UI.el(
      'select',
      {
        class: 'form-select',
        onchange: (e) => { state.filter.granularitaet = e.target.value; onReload(); },
      },
      UI.el('option', { value: 'woche', selected: state.filter.granularitaet === 'woche' }, 'Kalenderwoche'),
      UI.el('option', { value: 'monat', selected: state.filter.granularitaet === 'monat' }, 'Monat')
    );

    const bereichMulti = renderMultiSelect(
      'Bereiche',
      state.meta.bereiche.map((b) => ({ id: b.id, label: b.name })),
      state.filter.bereich_ids,
      (ids) => { state.filter.bereich_ids = ids; onReload(); }
    );
    const bearbeiterMulti = renderMultiSelect(
      'Bearbeiter',
      state.meta.bearbeiter.map((u) => ({ id: u.id, label: u.name })),
      state.filter.bearbeiter_ids,
      (ids) => { state.filter.bearbeiter_ids = ids; onReload(); }
    );
    const prioMulti = renderMultiSelect(
      'Priorität',
      Object.entries(PRIO_LABELS).map(([k, v]) => ({ id: k, label: v })),
      state.filter.prioritaeten,
      (ids) => { state.filter.prioritaeten = ids; onReload(); }
    );

    const reset = UI.el(
      'button',
      {
        class: 'btn btn--sm btn--ghost',
        onclick: () => { state.filter = defaultFilter(); onReload(); },
      },
      'Filter zurücksetzen'
    );

    const exportBtn = UI.el(
      'a',
      {
        class: 'btn btn--sm',
        href: '#',
        onclick: (e) => {
          e.preventDefault();
          window.location = '/api/analytics/export.xlsx?' + queryString();
        },
        title: 'Kennzahlen mit aktuellen Filtern als Excel herunterladen',
      },
      'Excel-Export'
    );

    container.append(
      UI.el('div', { class: 'analytics-filter__row' },
        UI.el('div', { class: 'analytics-filter__group' },
          UI.el('label', { class: 'form-label' }, 'Zeitraum'),
          UI.el('div', { class: 'analytics-filter__presets' }, ...presetBtns)),
        UI.el('div', { class: 'analytics-filter__group analytics-filter__dates' },
          UI.el('label', { class: 'form-label' }, 'Von / Bis'),
          UI.el('div', { class: 'row' }, von, UI.el('span', {}, '–'), bis)),
        UI.el('div', { class: 'analytics-filter__group' },
          UI.el('label', { class: 'form-label' }, 'Granularität'),
          gran)
      ),
      UI.el('div', { class: 'analytics-filter__row' },
        UI.el('div', { class: 'analytics-filter__group' },
          UI.el('label', { class: 'form-label' }, 'Bereich'), bereichMulti),
        UI.el('div', { class: 'analytics-filter__group' },
          UI.el('label', { class: 'form-label' }, 'Bearbeiter'), bearbeiterMulti),
        UI.el('div', { class: 'analytics-filter__group' },
          UI.el('label', { class: 'form-label' }, 'Priorität'), prioMulti),
        UI.el('div', { class: 'analytics-filter__spacer' }),
        reset,
        exportBtn
      )
    );
  }

  function renderMultiSelect(placeholder, options, selectedIds, onChange) {
    const wrapper = UI.el('div', { class: 'multiselect' });
    const trigger = UI.el('button', {
      class: 'multiselect__trigger btn btn--sm',
      onclick: (e) => {
        e.stopPropagation();
        wrapper.classList.toggle('is-open');
      },
    });
    updateTriggerLabel();
    const list = UI.el('div', { class: 'multiselect__list' });
    for (const opt of options) {
      const cb = UI.el('input', {
        type: 'checkbox',
        value: opt.id,
      });
      if (selectedIds.includes(opt.id)) cb.checked = true;
      cb.addEventListener('change', () => {
        const ids = Array.from(list.querySelectorAll('input:checked')).map((c) => c.value);
        selectedIds = ids;
        updateTriggerLabel();
        onChange(ids);
      });
      list.append(UI.el('label', { class: 'multiselect__item' }, cb, UI.el('span', {}, opt.label)));
    }
    if (!options.length) list.append(UI.el('div', { class: 'muted', style: 'padding:8px' }, 'Keine Einträge'));
    wrapper.append(trigger, list);

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) wrapper.classList.remove('is-open');
    });

    function updateTriggerLabel() {
      if (!selectedIds.length) trigger.textContent = 'Alle ' + placeholder + ' ▾';
      else if (selectedIds.length === 1) {
        const o = options.find((x) => x.id === selectedIds[0]);
        trigger.textContent = (o ? o.label : selectedIds[0]) + ' ▾';
      } else trigger.textContent = selectedIds.length + ' ausgewählt ▾';
    }
    return wrapper;
  }

  async function loadAndRender(container) {
    UI.clear(container).append(UI.el('p', { class: 'muted', text: 'Kennzahlen werden geladen…' }));
    try {
      const data = await API.get('/api/analytics?' + queryString());
      state.meta = data.meta;
      renderContent(container, data);
    } catch (e) {
      UI.clear(container).append(UI.el('div', { class: 'alert alert--error', text: e.message }));
    }
  }

  function renderContent(container, data) {
    UI.clear(container);
    container.append(kpiCards(data.kpi));
    container.append(zeitverlaufCard(data.zeitverlauf, data.zeitraum));
    container.append(
      UI.el('div', { class: 'analytics-grid' },
        distributionCard('Verteilung nach Bereich', bereichDonut(data.nach_bereich)),
        distributionCard('Verteilung nach Priorität', prioDonut(data.nach_prioritaet)),
        distributionCard('Aktueller Bestand nach Status', statusDonut(data.nach_status)),
        distributionCard('Top-Bearbeiter (im Zeitraum)', bearbeiterBars(data.nach_bearbeiter)),
        distributionCard('Verteilung nach Kategorie', kategorieBars(data.nach_kategorie))
      )
    );
    container.append(bereichTabelle(data.nach_bereich));
  }

  function kpiCards(kpi) {
    const cards = [
      ['Neue Tickets', kpi.neu, 'im Zeitraum'],
      ['Gelöst', kpi.geloest, 'im Zeitraum'],
      ['Offen (aktuell)', kpi.offen_aktuell, 'nicht abgeschlossen'],
      ['Hoch / Dringend offen', kpi.hoch_dringend_offen, 'brauchen Aufmerksamkeit'],
      [
        'Ø Bearbeitungszeit',
        kpi.avg_bearbeitungszeit_stunden != null
          ? formatDuration(kpi.avg_bearbeitungszeit_stunden)
          : '—',
        kpi.geloest_mit_zeit
          ? `bis "Gelöst" · aus ${kpi.geloest_mit_zeit} Tickets`
          : 'noch keine gelösten Tickets',
      ],
    ];
    return UI.el(
      'div',
      { class: 'kpi-grid' },
      ...cards.map(([label, value, sub]) =>
        UI.el(
          'div',
          { class: 'kpi-card' },
          UI.el('div', { class: 'kpi-card__label' }, label),
          UI.el('div', { class: 'kpi-card__value' }, value),
          UI.el('div', { class: 'kpi-card__sub muted' }, sub)
        )
      )
    );
  }

  function formatDuration(hours) {
    if (hours < 1) return Math.round(hours * 60) + ' Min.';
    if (hours < 24) return hours + ' Std.';
    return (Math.round((hours / 24) * 10) / 10) + ' Tage';
  }

  function zeitverlaufCard(zv, zeitraum) {
    const labels = zv.map((b) => b.label);
    const chart = Charts.groupedBar({
      series: [
        { name: 'Neu', color: Charts.PALETTE.neu, data: zv.map((b) => ({ label: b.label, value: b.neu })) },
        { name: 'Gelöst', color: Charts.PALETTE.geloest, data: zv.map((b) => ({ label: b.label, value: b.geloest })) },
      ],
      height: 280,
    });
    return UI.el('div', { class: 'card' },
      UI.el('div', { class: 'card__header' },
        UI.el('h2', { style: 'margin:0' }, 'Zeitverlauf: neue vs. gelöste Tickets'),
        UI.el('span', { class: 'muted' },
          `${zeitraum.von} bis ${zeitraum.bis} · ${zeitraum.granularitaet === 'monat' ? 'Monatlich' : 'Wöchentlich'}`)),
      UI.el('div', { class: 'card__body' }, chart)
    );
  }

  function distributionCard(title, body) {
    return UI.el('div', { class: 'card' },
      UI.el('div', { class: 'card__header' }, UI.el('h3', { style: 'margin:0' }, title)),
      UI.el('div', { class: 'card__body' }, body));
  }

  function bereichDonut(rows) {
    const palette = ['#1f5aa5', '#1a7f37', '#b76b00', '#7c3aed', '#c8321f', '#9ca3af'];
    return Charts.donut({
      data: rows.map((r, i) => ({
        label: r.name, value: r.gesamt, color: palette[i % palette.length],
      })),
      size: 220,
      centerLabel: 'Tickets',
    });
  }
  function prioDonut(rows) {
    return Charts.donut({
      data: rows.map((r) => ({
        label: PRIO_LABELS[r.name] || r.name,
        value: r.n,
        color: PRIO_COLORS[r.name] || '#9ca3af',
      })),
      size: 220,
      centerLabel: 'im Zeitraum',
    });
  }
  function statusDonut(rows) {
    return Charts.donut({
      data: rows.map((r) => ({
        label: STATUS_LABELS[r.name] || r.name,
        value: r.n,
        color: STATUS_COLORS[r.name] || '#9ca3af',
      })),
      size: 220,
      centerLabel: 'Bestand',
    });
  }
  function bearbeiterBars(rows) {
    return Charts.horizontalBar({
      data: rows.map((r) => ({ label: r.name, value: r.n })),
    });
  }
  function kategorieBars(rows) {
    return Charts.horizontalBar({
      data: rows.map((r) => ({ label: KATEGORIE_LABELS[r.name] || r.name, value: r.n })),
    });
  }

  function bereichTabelle(rows) {
    const gesamtNeu = rows.reduce((s, r) => s + (r.neu || 0), 0);
    const gesamtGel = rows.reduce((s, r) => s + (r.geloest || 0), 0);
    const gesamtOffen = rows.reduce((s, r) => s + (r.offen || 0), 0);
    const gesamtAll = rows.reduce((s, r) => s + (r.gesamt || 0), 0);

    return UI.el('div', { class: 'card' },
      UI.el('div', { class: 'card__header' }, UI.el('h2', { style: 'margin:0' }, 'Aufschlüsselung nach Bereich')),
      UI.el('div', { class: 'card__body' },
        UI.el('table', { class: 'ticket-table' },
          UI.el('thead', {}, UI.el('tr', {},
            UI.el('th', {}, 'Bereich'),
            UI.el('th', { style: 'text-align:right' }, 'Neu im Zeitraum'),
            UI.el('th', { style: 'text-align:right' }, 'Gelöst im Zeitraum'),
            UI.el('th', { style: 'text-align:right' }, 'Offen aktuell'),
            UI.el('th', { style: 'text-align:right' }, 'Gesamt')
          )),
          UI.el('tbody', {},
            ...rows.map((r) => UI.el('tr', {},
              UI.el('td', {}, r.name),
              UI.el('td', { style: 'text-align:right' }, r.neu || 0),
              UI.el('td', { style: 'text-align:right' }, r.geloest || 0),
              UI.el('td', { style: 'text-align:right' }, r.offen || 0),
              UI.el('td', { style: 'text-align:right; font-weight:600' }, r.gesamt || 0)
            )),
            UI.el('tr', { style: 'background: var(--color-surface-alt); font-weight:600' },
              UI.el('td', {}, 'Summe'),
              UI.el('td', { style: 'text-align:right' }, gesamtNeu),
              UI.el('td', { style: 'text-align:right' }, gesamtGel),
              UI.el('td', { style: 'text-align:right' }, gesamtOffen),
              UI.el('td', { style: 'text-align:right' }, gesamtAll)
            )
          )
        )
      )
    );
  }

  global.Analytics = Analytics;
})(window);

(function (global) {
  const STATUS_LABELS = {
    offen: 'Offen',
    in_bearbeitung: 'In Bearbeitung',
    warte_rueckmeldung: 'Warte auf Rückmeldung',
    geloest: 'Gelöst',
    geschlossen: 'Geschlossen',
  };
  const PRIO_LABELS = { normal: 'Normal', hoch: 'Hoch', dringend: 'Dringend' };

  const state = { filter: {} };

  function statusBadge(status) {
    return UI.el('span', { class: `badge badge--${status}`, text: STATUS_LABELS[status] || status });
  }
  function prioBadge(p) {
    return UI.el('span', { class: `badge badge--prio-${p}`, text: PRIO_LABELS[p] || p });
  }

  function filterBar(user, onChange) {
    const status = UI.el(
      'select',
      { class: 'form-select', onchange: (e) => onChange({ status: e.target.value || undefined }) },
      UI.el('option', { value: '' }, 'Alle Status'),
      ...Object.entries(STATUS_LABELS).map(([k, v]) => {
        const attrs = { value: k };
        if (state.filter.status === k) attrs.selected = true;
        return UI.el('option', attrs, v);
      })
    );
    const prio = UI.el(
      'select',
      { class: 'form-select', onchange: (e) => onChange({ prioritaet: e.target.value || undefined }) },
      UI.el('option', { value: '' }, 'Alle Prioritäten'),
      ...Object.entries(PRIO_LABELS).map(([k, v]) => {
        const attrs = { value: k };
        if (state.filter.prioritaet === k) attrs.selected = true;
        return UI.el('option', attrs, v);
      })
    );

    const mineChk = UI.el('input', {
      type: 'checkbox',
      id: 'flt-mine',
      onchange: (e) => onChange({ mine: e.target.checked ? '1' : undefined }),
    });
    if (state.filter.mine) mineChk.checked = true;

    const mineWrap = UI.el(
      'label',
      { class: 'flt-mine', for: 'flt-mine' },
      mineChk,
      UI.el('span', {}, ' Mir zugewiesen')
    );

    const q = UI.el('input', {
      type: 'search',
      class: 'form-input',
      placeholder: 'Suche in Betreff, Beschreibung, Einreicher…',
      value: state.filter.q || '',
    });
    let qTimer = null;
    q.addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => onChange({ q: q.value.trim() || undefined }), 300);
    });

    const sort = UI.el(
      'select',
      { class: 'form-select', onchange: (e) => onChange({ sort: e.target.value }) },
      ...[
        ['aktualisiert', 'Letzte Aktivität'],
        ['erstellt', 'Erstellungsdatum'],
        ['prioritaet', 'Priorität'],
        ['status', 'Status'],
      ].map(([k, v]) => {
        const attrs = { value: k };
        if ((state.filter.sort || 'aktualisiert') === k) attrs.selected = true;
        return UI.el('option', attrs, v);
      })
    );

    return UI.el(
      'div',
      { class: 'filter-bar' },
      UI.el('div', { class: 'filter-bar__row' }, q),
      UI.el(
        'div',
        { class: 'filter-bar__row filter-bar__row--controls' },
        status,
        prio,
        mineWrap,
        UI.el('div', { class: 'filter-bar__spacer' }),
        UI.el('label', { class: 'filter-bar__sort-label' }, 'Sortieren nach:'),
        sort
      )
    );
  }

  function ticketRow(t) {
    const tr = UI.el(
      'tr',
      {
        class: 'ticket-row',
        onclick: () => {
          location.hash = `#/ticket/${t.id}`;
        },
      },
      UI.el('td', { class: 'ticket-row__id' }, '#' + t.kurz_id),
      UI.el(
        'td',
        {},
        UI.el('div', { class: 'ticket-row__betreff' }, t.betreff),
        UI.el(
          'div',
          { class: 'ticket-row__meta muted' },
          t.einreicher_name || t.einreicher_email || 'Anonym'
        )
      ),
      UI.el('td', {}, t.bereich_name || UI.el('span', { class: 'muted' }, 'Kein Bereich')),
      UI.el('td', {}, statusBadge(t.status)),
      UI.el('td', {}, prioBadge(t.prioritaet)),
      UI.el('td', {}, t.zugewiesen_name || UI.el('span', { class: 'muted' }, '—')),
      UI.el('td', { class: 'muted ticket-row__date' }, UI.formatDate(t.aktualisiert_am))
    );
    return tr;
  }

  async function loadAndRender(user, container) {
    const listBox = container.querySelector('#ticket-list');
    UI.clear(listBox);
    listBox.append(UI.el('p', { class: 'muted', text: 'Wird geladen…' }));
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state.filter)) if (v != null) params.set(k, v);
    try {
      const data = await API.get('/api/tickets?' + params.toString());
      UI.clear(listBox);
      if (!data.tickets.length) {
        listBox.append(UI.el('p', { class: 'muted', text: 'Keine Tickets gefunden.' }));
        return;
      }
      const table = UI.el(
        'table',
        { class: 'ticket-table' },
        UI.el(
          'thead',
          {},
          UI.el(
            'tr',
            {},
            UI.el('th', {}, 'Ticket'),
            UI.el('th', {}, 'Betreff / Einreicher'),
            UI.el('th', {}, 'Bereich'),
            UI.el('th', {}, 'Status'),
            UI.el('th', {}, 'Priorität'),
            UI.el('th', {}, 'Zugewiesen'),
            UI.el('th', {}, 'Aktualisiert')
          )
        ),
        UI.el('tbody', {}, ...data.tickets.map(ticketRow))
      );
      listBox.append(
        UI.el('div', { class: 'ticket-list__count muted' }, `${data.count} Ticket(s)`),
        table
      );
    } catch (e) {
      UI.clear(listBox);
      listBox.append(UI.el('div', { class: 'alert alert--error', text: e.message }));
    }
  }

  const Dashboard = {};

  Dashboard.render = function (user) {
    const wrap = UI.el('div', { class: 'stack' });
    const heading = UI.el(
      'div',
      { class: 'page-heading' },
      UI.el('h1', { style: 'margin:0' }, 'Ticket-Dashboard'),
      UI.el('div', { class: 'muted' }, user.ist_admin ? 'Alle Bereiche' : `Bereiche: ${user.bereiche.map((b) => b.name).join(', ') || 'keine'}`)
    );

    const listBox = UI.el('div', { id: 'ticket-list' });

    function onChange(patch) {
      state.filter = { ...state.filter, ...patch };
      for (const k of Object.keys(state.filter)) if (state.filter[k] == null) delete state.filter[k];
      loadAndRender(user, wrap);
    }

    const bar = filterBar(user, onChange);
    wrap.append(heading, bar, listBox);
    loadAndRender(user, wrap);
    return wrap;
  };

  Dashboard.reset = function () {
    state.filter = {};
  };

  global.Dashboard = Dashboard;
})(window);

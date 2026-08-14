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
    rechnung_zahlung: 'Rechnungsfehler / Zahlung',
    falsche_ware_lieferant: 'Falsche Ware / Lieferantenthema',
    sonstiges: 'Sonstiges',
  };

  function badge(cls, txt) {
    return UI.el('span', { class: `badge ${cls}`, text: txt });
  }

  function statusBadge(s) {
    return badge(`badge--${s}`, STATUS_LABELS[s] || s);
  }
  function prioBadge(p) {
    return badge(`badge--prio-${p}`, PRIO_LABELS[p] || p);
  }

  function parseInhalt(inhalt) {
    if (!inhalt) return null;
    try {
      return JSON.parse(inhalt);
    } catch (_e) {
      return null;
    }
  }

  function eventItem(ev) {
    const time = UI.formatDate(ev.erstellt_am);
    const author = ev.erstellt_von_name || (ev.typ === 'mail_eingehend' ? 'Einreicher' : 'System');
    let icon = '·';
    let body;
    switch (ev.typ) {
      case 'kommentar':
        icon = 'K';
        body = UI.el('div', { class: 'event__body event__body--comment' }, ev.inhalt || '');
        break;
      case 'statuswechsel': {
        icon = 'S';
        const p = parseInhalt(ev.inhalt) || {};
        body = UI.el(
          'div',
          { class: 'event__body' },
          `Status geändert: ${STATUS_LABELS[p.von] || p.von || '?'} → ${STATUS_LABELS[p.nach] || p.nach || '?'}`
        );
        break;
      }
      case 'zuweisung': {
        icon = 'Z';
        const p = parseInhalt(ev.inhalt) || {};
        const art = p.art === 'bereich' ? 'Bereich' : 'Person';
        const von = p.von || 'niemand';
        const nach = p.nach || 'niemand';
        body = UI.el('div', { class: 'event__body' }, `${art} geändert: ${von} → ${nach}`);
        break;
      }
      case 'mail_ausgehend': {
        icon = '→';
        const p = parseInhalt(ev.inhalt) || {};
        body = UI.el(
          'div',
          { class: 'event__body' },
          UI.el('div', { class: 'muted' }, `Ausgehende Mail an ${p.empfaenger || '?'}`),
          UI.el('div', {}, p.betreff || ''),
          p.body ? UI.el('div', { class: 'event__mail-body' }, p.body) : null
        );
        break;
      }
      case 'mail_eingehend': {
        icon = '←';
        const p = parseInhalt(ev.inhalt) || {};
        body = UI.el(
          'div',
          { class: 'event__body' },
          UI.el('div', { class: 'muted' }, `Eingehende Mail von ${p.absender || '?'}`),
          UI.el('div', {}, p.betreff || ''),
          p.body ? UI.el('div', { class: 'event__mail-body' }, p.body) : null
        );
        break;
      }
      case 'system': {
        icon = 'i';
        const p = parseInhalt(ev.inhalt) || {};
        let txt = 'Systemereignis';
        if (p.aktion === 'ticket_erstellt') {
          txt = `Ticket erstellt (Kategorie: ${p.kategorie}, Bereich: ${p.bereich || 'kein Bereich'}, Priorität: ${p.prioritaet})`;
        }
        body = UI.el('div', { class: 'event__body muted' }, txt);
        break;
      }
      default:
        body = UI.el('div', { class: 'event__body' }, ev.inhalt || '');
    }

    return UI.el(
      'div',
      { class: `event event--${ev.typ}` },
      UI.el('div', { class: 'event__icon' }, icon),
      UI.el(
        'div',
        { class: 'event__content' },
        UI.el(
          'div',
          { class: 'event__meta' },
          UI.el('span', { class: 'event__author' }, author),
          UI.el('span', { class: 'event__time muted' }, time)
        ),
        body
      )
    );
  }

  function renderDetail(data, container, onReload, currentUser) {
    const t = data.ticket;
    UI.clear(container);

    const header = UI.el(
      'div',
      { class: 'ticket-detail__header' },
      UI.el(
        'div',
        {},
        UI.el(
          'div',
          { class: 'ticket-detail__id' },
          '#' + t.kurz_id,
          UI.el('span', { class: 'muted' }, KATEGORIE_LABELS[t.kategorie] || t.kategorie)
        ),
        UI.el('h1', { class: 'ticket-detail__betreff' }, t.betreff)
      ),
      UI.el(
        'div',
        { class: 'row' },
        statusBadge(t.status),
        prioBadge(t.prioritaet)
      )
    );

    const stamm = UI.el(
      'dl',
      { class: 'stamm-list' },
      UI.el('dt', {}, 'Bereich'),
      UI.el('dd', {}, t.bereich ? t.bereich.name : UI.el('span', { class: 'muted' }, 'kein Bereich')),
      UI.el('dt', {}, 'Zugewiesen an'),
      UI.el('dd', {}, t.zugewiesen ? `${t.zugewiesen.name} (${t.zugewiesen.email})` : UI.el('span', { class: 'muted' }, '—')),
      UI.el('dt', {}, 'Einreicher'),
      UI.el('dd', {}, t.einreicher_name || UI.el('span', { class: 'muted' }, 'anonym')),
      UI.el('dt', {}, 'E-Mail Einreicher'),
      UI.el('dd', {}, t.einreicher_email || UI.el('span', { class: 'muted' }, '—')),
      UI.el('dt', {}, 'Erstellt am'),
      UI.el('dd', {}, UI.formatDate(t.erstellt_am)),
      UI.el('dt', {}, 'Aktualisiert am'),
      UI.el('dd', {}, UI.formatDate(t.aktualisiert_am)),
      UI.el('dt', {}, 'Anhang'),
      UI.el('dd', {}, t.anhang_pfad
        ? UI.el('a', { href: `/api/anhang/${t.id}`, target: '_blank' }, 'Datei öffnen')
        : UI.el('span', { class: 'muted' }, 'kein Anhang'))
    );

    const beschreibung = UI.el(
      'div',
      { class: 'ticket-detail__beschreibung' },
      UI.el('h3', {}, 'Beschreibung'),
      UI.el('div', { class: 'ticket-detail__beschreibung-text' }, t.beschreibung)
    );

    const timeline = UI.el(
      'div',
      { class: 'timeline' },
      UI.el('h3', {}, 'Verlauf'),
      UI.el('div', { class: 'timeline__items' }, ...data.events.map(eventItem))
    );

    const komForm = renderKommentarForm(t, onReload);
    const mailForm = renderMailCompose(t, onReload);
    const actions = renderActionsPanel(t, onReload);

    container.append(
      UI.el(
        'div',
        { class: 'card ticket-detail' },
        UI.el('div', { class: 'card__header' },
          UI.el('a', { class: 'btn btn--sm btn--ghost', href: '#/dashboard' }, '← Dashboard')
        ),
        UI.el(
          'div',
          { class: 'card__body' },
          header,
          UI.el(
            'div',
            { class: 'ticket-detail__grid' },
            UI.el(
              'div',
              { class: 'ticket-detail__main' },
              beschreibung,
              timeline,
              komForm,
              mailForm
            ),
            UI.el('aside', { class: 'ticket-detail__side' }, actions, stamm)
          )
        )
      )
    );
  }

  function renderKommentarForm(ticket, onReload) {
    const ta = UI.el('textarea', {
      class: 'form-textarea',
      placeholder: 'Interner Kommentar (nicht für Einreicher sichtbar)…',
    });
    const btn = UI.el(
      'button',
      {
        class: 'btn btn--primary',
        onclick: async () => {
          const text = ta.value.trim();
          if (!text) return;
          btn.disabled = true;
          try {
            await API.post(`/api/tickets/${ticket.id}/kommentar`, { text });
            ta.value = '';
            UI.toast('Kommentar hinzugefügt', 'success');
            onReload();
          } catch (e) {
            UI.toast(e.message, 'error');
            btn.disabled = false;
          }
        },
      },
      'Kommentar speichern'
    );
    return UI.el(
      'div',
      { class: 'compose' },
      UI.el('h3', {}, 'Interner Kommentar'),
      ta,
      UI.el('div', { class: 'compose__actions' }, btn)
    );
  }

  function renderMailCompose(ticket, onReload) {
    const to = UI.el('input', {
      type: 'email',
      class: 'form-input',
      value: ticket.einreicher_email || '',
      placeholder: 'empfaenger@…',
    });
    const subject = UI.el('input', {
      type: 'text',
      class: 'form-input',
      value: `[Ticket #${ticket.kurz_id}] ${ticket.betreff}`,
    });
    const body = UI.el('textarea', {
      class: 'form-textarea',
      placeholder: 'Nachrichtentext…',
    });
    const btn = UI.el(
      'button',
      {
        class: 'btn btn--primary',
        onclick: async () => {
          if (!to.value.trim() || !body.value.trim()) {
            UI.toast('Empfänger und Nachricht erforderlich', 'error');
            return;
          }
          btn.disabled = true;
          try {
            await API.post(`/api/tickets/${ticket.id}/mail`, {
              to: to.value.trim(),
              subject: subject.value.trim(),
              body: body.value,
            });
            body.value = '';
            UI.toast('Mail gesendet', 'success');
            onReload();
          } catch (e) {
            UI.toast(e.message, 'error');
          } finally {
            btn.disabled = false;
          }
        },
      },
      'Mail senden'
    );
    return UI.el(
      'div',
      { class: 'compose' },
      UI.el('h3', {}, 'E-Mail an Einreicher / Dritte'),
      UI.el('div', { class: 'form-group' },
        UI.el('label', { class: 'form-label' }, 'Empfänger'), to),
      UI.el('div', { class: 'form-group' },
        UI.el('label', { class: 'form-label' }, 'Betreff'), subject),
      UI.el('div', { class: 'form-group' },
        UI.el('label', { class: 'form-label' }, 'Nachricht'), body),
      UI.el('div', { class: 'compose__actions' }, btn)
    );
  }

  function renderActionsPanel(ticket, onReload) {
    const statusSel = UI.el(
      'select',
      {
        class: 'form-select',
        onchange: async (e) => {
          try {
            await API.patch(`/api/tickets/${ticket.id}`, { status: e.target.value });
            UI.toast('Status aktualisiert', 'success');
            onReload();
          } catch (err) {
            UI.toast(err.message, 'error');
          }
        },
      },
      ...Object.entries(STATUS_LABELS).map(([k, v]) => {
        const attrs = { value: k };
        if (ticket.status === k) attrs.selected = true;
        return UI.el('option', attrs, v);
      })
    );

    const bereichBox = UI.el('div', {}, UI.el('span', { class: 'muted' }, 'wird geladen…'));
    const assignBox = UI.el('div', {}, UI.el('span', { class: 'muted' }, 'wird geladen…'));

    Promise.all([
      API.get('/api/tickets/meta/bereiche'),
      API.get('/api/tickets/meta/zuweisbare-benutzer'),
    ]).then(([b, u]) => {
      const bereichSel = UI.el(
        'select',
        {
          class: 'form-select',
          onchange: async (e) => {
            try {
              await API.patch(`/api/tickets/${ticket.id}`, { bereich_id: e.target.value || null });
              UI.toast('Bereich aktualisiert', 'success');
              onReload();
            } catch (err) {
              UI.toast(err.message, 'error');
            }
          },
        },
        UI.el('option', { value: '' }, 'Kein Bereich'),
        ...b.bereiche.map((x) => {
          const attrs = { value: x.id };
          if (ticket.bereich && ticket.bereich.id === x.id) attrs.selected = true;
          return UI.el('option', attrs, x.name);
        })
      );
      UI.clear(bereichBox).append(bereichSel);

      const userSel = UI.el(
        'select',
        {
          class: 'form-select',
          onchange: async (e) => {
            try {
              await API.patch(`/api/tickets/${ticket.id}`, { zugewiesen_an: e.target.value || null });
              UI.toast('Zuweisung aktualisiert', 'success');
              onReload();
            } catch (err) {
              UI.toast(err.message, 'error');
            }
          },
        },
        UI.el('option', { value: '' }, 'Niemand zugewiesen'),
        ...u.users.map((x) => {
          const attrs = { value: x.id };
          if (ticket.zugewiesen && ticket.zugewiesen.id === x.id) attrs.selected = true;
          const label = `${x.name}${x.bereiche ? ' (' + x.bereiche + ')' : x.ist_admin ? ' (Admin)' : ''}`;
          return UI.el('option', attrs, label);
        })
      );
      UI.clear(assignBox).append(userSel);
    }).catch((err) => {
      UI.clear(bereichBox).append(UI.el('div', { class: 'alert alert--error', text: err.message }));
    });

    return UI.el(
      'div',
      { class: 'ticket-actions' },
      UI.el('h3', {}, 'Aktionen'),
      UI.el('div', { class: 'form-group' },
        UI.el('label', { class: 'form-label' }, 'Status'), statusSel),
      UI.el('div', { class: 'form-group' },
        UI.el('label', { class: 'form-label' }, 'Bereich'), bereichBox),
      UI.el('div', { class: 'form-group' },
        UI.el('label', { class: 'form-label' }, 'Zugewiesen an'), assignBox)
    );
  }

  const TicketDetail = {};

  TicketDetail.render = function (user, id) {
    const container = UI.el('div', {}, UI.el('p', { class: 'muted', text: 'Wird geladen…' }));

    async function load() {
      try {
        const data = await API.get(`/api/tickets/${id}`);
        renderDetail(data, container, load, user);
      } catch (e) {
        UI.clear(container).append(
          UI.el('div', { class: 'alert alert--error', text: e.message }),
          UI.el('p', {}, UI.el('a', { href: '#/dashboard' }, '← Zurück zum Dashboard'))
        );
      }
    }
    load();
    return container;
  };

  global.TicketDetail = TicketDetail;
})(window);

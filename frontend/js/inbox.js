(function (global) {
  const Inbox = {};

  Inbox.render = function (user) {
    if (!user.ist_admin) {
      return UI.el('div', { class: 'alert alert--error', text: 'Nur für Administratoren.' });
    }
    const wrap = UI.el('div', { class: 'stack' });
    const heading = UI.el(
      'div',
      { class: 'page-heading' },
      UI.el('h1', { style: 'margin:0' }, 'Posteingang (nicht zugeordnet)'),
      UI.el(
        'div',
        { class: 'row' },
        UI.el(
          'button',
          {
            class: 'btn btn--sm',
            onclick: async () => {
              try {
                const r = await API.post('/api/inbox/poll', {});
                if (r.skipped) UI.toast('IMAP nicht konfiguriert', 'info');
                else UI.toast(`Poll ausgeführt (${r.processed || 0} Mails, ${r.matched || 0} zugeordnet, ${r.inbox || 0} in Posteingang)`, 'success');
                load();
              } catch (e) {
                UI.toast(e.message, 'error');
              }
            },
          },
          'IMAP jetzt abrufen'
        )
      )
    );
    const list = UI.el('div', { id: 'inbox-list' });
    wrap.append(heading, list);

    async function load() {
      UI.clear(list).append(UI.el('p', { class: 'muted', text: 'Wird geladen…' }));
      try {
        const data = await API.get('/api/inbox');
        UI.clear(list);
        if (!data.imap_konfiguriert) {
          list.append(
            UI.el(
              'div',
              { class: 'alert alert--info' },
              'IMAP ist derzeit nicht konfiguriert. Bitte SMTP/IMAP-Zugangsdaten in der .env eintragen.'
            )
          );
        }
        if (!data.mails.length) {
          list.append(UI.el('p', { class: 'muted', text: 'Keine unzugeordneten Mails.' }));
          return;
        }
        for (const m of data.mails) {
          list.append(mailCard(m, load));
        }
      } catch (e) {
        UI.clear(list).append(UI.el('div', { class: 'alert alert--error', text: e.message }));
      }
    }
    load();
    return wrap;
  };

  function mailCard(m, onReload) {
    const body = UI.el('pre', { class: 'inbox-mail__body' }, m.body || '(kein Text)');
    return UI.el(
      'div',
      { class: 'card inbox-mail ' + (m.verarbeitet ? 'inbox-mail--done' : '') },
      UI.el(
        'div',
        { class: 'card__body' },
        UI.el(
          'div',
          { class: 'inbox-mail__meta' },
          UI.el('strong', {}, m.betreff || '(kein Betreff)'),
          UI.el('span', { class: 'muted' }, m.absender || 'unbekannt'),
          UI.el('span', { class: 'muted' }, UI.formatDate(m.erhalten_am))
        ),
        body,
        UI.el(
          'div',
          { class: 'row', style: 'margin-top:8px' },
          !m.verarbeitet
            ? UI.el(
                'button',
                {
                  class: 'btn btn--sm',
                  onclick: async () => {
                    await API.post(`/api/inbox/${m.id}/verarbeitet`, {});
                    onReload();
                  },
                },
                'Als erledigt markieren'
              )
            : UI.el('span', { class: 'muted' }, 'Erledigt'),
          UI.el(
            'button',
            {
              class: 'btn btn--sm btn--danger',
              onclick: async () => {
                if (!confirm('Diese Mail wirklich löschen?')) return;
                await API.del(`/api/inbox/${m.id}`);
                onReload();
              },
            },
            'Löschen'
          )
        )
      )
    );
  }

  global.Inbox = Inbox;
})(window);

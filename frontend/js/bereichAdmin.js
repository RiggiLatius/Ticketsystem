(function (global) {
  const BereichAdmin = {};

  BereichAdmin.render = function (currentUser) {
    if (!currentUser.ist_admin) {
      return UI.el('div', { class: 'alert alert--error', text: 'Nur für Administratoren.' });
    }
    const wrap = UI.el('div', { class: 'stack' });
    const nameIn = UI.el('input', { class: 'form-input', placeholder: 'Neuer Bereich…' });
    const addBtn = UI.el('button', {
      class: 'btn btn--primary',
      onclick: async () => {
        const nm = nameIn.value.trim();
        if (!nm) return;
        try {
          await API.post('/api/bereiche', { name: nm });
          UI.toast('Bereich angelegt', 'success');
          nameIn.value = '';
          load();
        } catch (e) {
          UI.toast(e.message, 'error');
        }
      }
    }, 'Anlegen');

    const heading = UI.el('div', { class: 'page-heading' },
      UI.el('h1', { style: 'margin:0' }, 'Bereichsverwaltung'),
      UI.el('div', { class: 'row' }, nameIn, addBtn)
    );

    const list = UI.el('div', { id: 'bereich-list' });
    wrap.append(heading, list);

    async function load() {
      UI.clear(list).append(UI.el('p', { class: 'muted', text: 'Wird geladen…' }));
      try {
        const data = await API.get('/api/bereiche');
        UI.clear(list);
        const rows = data.bereiche.map((b) => UI.el('tr', {},
          UI.el('td', {}, b.name),
          UI.el('td', {}, b.aktiv ? 'Aktiv' : UI.el('span', { class: 'muted' }, 'Deaktiviert')),
          UI.el('td', {}, `${b.ticket_count} Tickets · ${b.user_count} Nutzer`),
          UI.el('td', {},
            UI.el('button', {
              class: 'btn btn--sm',
              onclick: async () => {
                const nm = prompt('Neuer Name:', b.name);
                if (nm == null) return;
                try {
                  await API.patch(`/api/bereiche/${b.id}`, { name: nm });
                  UI.toast('Umbenannt', 'success');
                  load();
                } catch (e) { UI.toast(e.message, 'error'); }
              }
            }, 'Umbenennen'),
            ' ',
            UI.el('button', {
              class: 'btn btn--sm',
              onclick: async () => {
                try {
                  await API.patch(`/api/bereiche/${b.id}`, { aktiv: !b.aktiv });
                  load();
                } catch (e) { UI.toast(e.message, 'error'); }
              }
            }, b.aktiv ? 'Deaktivieren' : 'Aktivieren')
          )
        ));
        const table = UI.el('table', { class: 'ticket-table' },
          UI.el('thead', {}, UI.el('tr', {},
            UI.el('th', {}, 'Name'),
            UI.el('th', {}, 'Status'),
            UI.el('th', {}, 'Belegung'),
            UI.el('th', {}, 'Aktionen'))),
          UI.el('tbody', {}, ...rows)
        );
        list.append(table);
      } catch (e) {
        UI.clear(list).append(UI.el('div', { class: 'alert alert--error', text: e.message }));
      }
    }
    load();
    return wrap;
  };

  global.BereichAdmin = BereichAdmin;
})(window);

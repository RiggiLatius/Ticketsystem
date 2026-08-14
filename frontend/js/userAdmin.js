(function (global) {
  const UserAdmin = {};

  UserAdmin.render = function (currentUser) {
    if (!currentUser.ist_admin) {
      return UI.el('div', { class: 'alert alert--error', text: 'Nur für Administratoren.' });
    }
    const wrap = UI.el('div', { class: 'stack' });
    const heading = UI.el(
      'div',
      { class: 'page-heading' },
      UI.el('h1', { style: 'margin:0' }, 'Benutzerverwaltung'),
      UI.el(
        'button',
        { class: 'btn btn--primary', onclick: () => openUserForm(null, load) },
        'Neuen Benutzer anlegen'
      )
    );
    const container = UI.el('div', { id: 'user-list' });
    wrap.append(heading, container);

    async function load() {
      UI.clear(container).append(UI.el('p', { class: 'muted', text: 'Wird geladen…' }));
      try {
        const [u, b] = await Promise.all([API.get('/api/users'), API.get('/api/bereiche')]);
        UI.clear(container);
        const rows = u.users.map((usr) => userRow(usr, b.bereiche, load, currentUser));
        const table = UI.el(
          'table',
          { class: 'ticket-table' },
          UI.el('thead', {}, UI.el('tr', {},
            UI.el('th', {}, 'Name'),
            UI.el('th', {}, 'E-Mail'),
            UI.el('th', {}, 'Rolle'),
            UI.el('th', {}, 'Bereiche'),
            UI.el('th', {}, 'Status'),
            UI.el('th', {}, 'Aktionen')
          )),
          UI.el('tbody', {}, ...rows)
        );
        container.append(table);
      } catch (e) {
        UI.clear(container).append(UI.el('div', { class: 'alert alert--error', text: e.message }));
      }
    }
    load();
    return wrap;
  };

  function userRow(u, bereiche, onReload, currentUser) {
    const bereichNames = u.bereiche.map((b) => b.name).join(', ') || '—';
    const actions = UI.el('div', { class: 'row', style: 'gap:6px' },
      UI.el('button', {
        class: 'btn btn--sm',
        onclick: () => openUserForm(u, onReload, bereiche),
      }, 'Bearbeiten'),
      UI.el('button', {
        class: 'btn btn--sm',
        onclick: () => openPasswordReset(u, onReload),
      }, 'PW zurücksetzen'),
      currentUser.id !== u.id
        ? UI.el('button', {
            class: 'btn btn--sm ' + (u.aktiv ? 'btn--danger' : ''),
            onclick: async () => {
              try {
                await API.patch(`/api/users/${u.id}`, { aktiv: !u.aktiv });
                UI.toast(u.aktiv ? 'Benutzer deaktiviert' : 'Benutzer aktiviert', 'success');
                onReload();
              } catch (e) {
                UI.toast(e.message, 'error');
              }
            },
          }, u.aktiv ? 'Deaktivieren' : 'Aktivieren')
        : null
    );
    return UI.el('tr', {},
      UI.el('td', {}, u.name),
      UI.el('td', {}, u.email),
      UI.el('td', {}, u.ist_admin ? 'Administrator' : 'Bereichs-Benutzer'),
      UI.el('td', {}, bereichNames),
      UI.el('td', {}, u.aktiv ? 'Aktiv' : UI.el('span', { class: 'muted' }, 'Deaktiviert')),
      UI.el('td', {}, actions)
    );
  }

  async function openUserForm(existing, onReload, bereicheCache) {
    let bereiche = bereicheCache;
    if (!bereiche) {
      try { bereiche = (await API.get('/api/bereiche')).bereiche; }
      catch (e) { UI.toast(e.message, 'error'); return; }
    }

    const name = UI.el('input', { class: 'form-input', value: existing?.name || '' });
    const email = UI.el('input', { type: 'email', class: 'form-input', value: existing?.email || '' });
    const password = UI.el('input', { type: 'password', class: 'form-input',
      placeholder: existing ? 'Nur ausfüllen zum Ändern' : 'mind. 8 Zeichen' });
    const istAdmin = UI.el('input', { type: 'checkbox' });
    if (existing?.ist_admin) istAdmin.checked = true;
    const benachr = UI.el('input', { type: 'checkbox' });
    if (existing == null || existing.benachrichtigungen) benachr.checked = true;

    const bereichChecks = bereiche.map((b) => {
      const cb = UI.el('input', { type: 'checkbox', value: b.id });
      if (existing?.bereiche?.some((x) => x.id === b.id)) cb.checked = true;
      return UI.el('label', { class: 'row', style: 'gap:6px; padding: 2px 0' }, cb, UI.el('span', {}, b.name));
    });

    const errBox = UI.el('div', { class: 'alert alert--error', style: 'display:none' });

    const dialog = UI.el('div', { class: 'modal' },
      UI.el('div', { class: 'modal__backdrop', onclick: closeModal }),
      UI.el('div', { class: 'modal__panel' },
        UI.el('h2', {}, existing ? `Benutzer bearbeiten: ${existing.name}` : 'Neuen Benutzer anlegen'),
        errBox,
        UI.el('div', { class: 'form-group' }, UI.el('label', { class: 'form-label' }, 'Name'), name),
        UI.el('div', { class: 'form-group' }, UI.el('label', { class: 'form-label' }, 'E-Mail'), email),
        UI.el('div', { class: 'form-group' }, UI.el('label', { class: 'form-label' }, existing ? 'Neues Passwort (optional)' : 'Passwort'), password),
        UI.el('div', { class: 'form-group' },
          UI.el('label', { class: 'row', style: 'gap:6px' }, istAdmin, UI.el('span', {}, 'Administrator')),
          UI.el('label', { class: 'row', style: 'gap:6px' }, benachr, UI.el('span', {}, 'Benachrichtigungen aktiviert'))
        ),
        UI.el('div', { class: 'form-group' },
          UI.el('label', { class: 'form-label' }, 'Bereiche'),
          UI.el('div', { style: 'display:flex; flex-direction:column' }, ...bereichChecks)
        ),
        UI.el('div', { class: 'modal__actions' },
          UI.el('button', { class: 'btn', onclick: closeModal }, 'Abbrechen'),
          UI.el('button', {
            class: 'btn btn--primary',
            onclick: async () => {
              const bereichIds = bereichChecks
                .map((lbl) => lbl.querySelector('input'))
                .filter((cb) => cb.checked).map((cb) => cb.value);
              const body = {
                name: name.value.trim(),
                email: email.value.trim(),
                ist_admin: istAdmin.checked,
                benachrichtigungen: benachr.checked,
                bereich_ids: bereichIds,
              };
              if (password.value) body.password = password.value;
              try {
                if (existing) await API.patch(`/api/users/${existing.id}`, body);
                else await API.post('/api/users', body);
                UI.toast(existing ? 'Benutzer aktualisiert' : 'Benutzer angelegt', 'success');
                closeModal();
                onReload();
              } catch (e) {
                errBox.textContent = e.message;
                errBox.style.display = '';
              }
            }
          }, 'Speichern')
        )
      )
    );
    document.body.append(dialog);
  }

  function openPasswordReset(user, onReload) {
    const pw = UI.el('input', { type: 'password', class: 'form-input', placeholder: 'mind. 8 Zeichen' });
    const err = UI.el('div', { class: 'alert alert--error', style: 'display:none' });
    const dialog = UI.el('div', { class: 'modal' },
      UI.el('div', { class: 'modal__backdrop', onclick: closeModal }),
      UI.el('div', { class: 'modal__panel' },
        UI.el('h2', {}, `Passwort zurücksetzen: ${user.name}`),
        err,
        UI.el('div', { class: 'form-group' }, UI.el('label', { class: 'form-label' }, 'Neues Passwort'), pw),
        UI.el('div', { class: 'modal__actions' },
          UI.el('button', { class: 'btn', onclick: closeModal }, 'Abbrechen'),
          UI.el('button', {
            class: 'btn btn--primary',
            onclick: async () => {
              try {
                await API.patch(`/api/users/${user.id}`, { password: pw.value });
                UI.toast('Passwort geändert', 'success');
                closeModal();
                onReload();
              } catch (e) {
                err.textContent = e.message;
                err.style.display = '';
              }
            }
          }, 'Speichern')
        )
      )
    );
    document.body.append(dialog);
  }

  function closeModal() {
    document.querySelectorAll('.modal').forEach((m) => m.remove());
  }

  global.UserAdmin = UserAdmin;
})(window);

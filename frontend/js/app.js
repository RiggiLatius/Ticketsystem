(function () {
  const state = { user: null };
  let mainEl = null;

  function renderShell() {
    const nav = [
      UI.el('a', { class: 'app-header__nav-link', href: '#/dashboard' }, 'Dashboard'),
      UI.el('a', { class: 'app-header__nav-link', href: '#/kennzahlen' }, 'Kennzahlen'),
    ];
    if (state.user.ist_admin) {
      nav.push(
        UI.el('a', { class: 'app-header__nav-link', href: '#/admin/users' }, 'Benutzer'),
        UI.el('a', { class: 'app-header__nav-link', href: '#/admin/bereiche' }, 'Bereiche'),
        UI.el('a', { class: 'app-header__nav-link', href: '#/admin/inbox' }, 'Posteingang')
      );
    }

    const header = UI.el(
      'header',
      { class: 'app-header' },
      UI.el(
        'div',
        { class: 'app-header__brand-wrap' },
        UI.el(
          'a',
          { class: 'app-header__brand', href: '#/dashboard' },
          'Reisser AG',
          UI.el('span', { text: 'Reklamations-Ticketsystem' })
        ),
        UI.el('nav', { class: 'app-header__nav' }, ...nav)
      ),
      UI.el(
        'div',
        { class: 'app-header__user' },
        UI.el('span', { text: `${state.user.name} (${state.user.email})` }),
        UI.el(
          'button',
          {
            class: 'btn btn--sm',
            onclick: async () => {
              await Auth.logout();
              state.user = null;
              start();
            },
          },
          'Abmelden'
        )
      )
    );

    mainEl = UI.el('main', { class: 'app-main' });
    const shell = UI.el('div', { class: 'app-shell' }, header, mainEl);
    UI.mount(shell);
    Router.onNavigate = highlightActiveNav;
    highlightActiveNav();
  }

  function highlightActiveNav() {
    const cur = location.hash || '#/dashboard';
    document.querySelectorAll('.app-header__nav-link').forEach((a) => {
      const isActive = cur === a.getAttribute('href') || cur.startsWith(a.getAttribute('href') + '/');
      a.classList.toggle('is-active', isActive);
    });
  }

  function setPage(node) {
    if (!mainEl) return;
    UI.clear(mainEl);
    mainEl.append(node);
  }

  function registerRoutes() {
    Router.routes = [];
    Router.add('/dashboard', () => setPage(Dashboard.render(state.user)));
    Router.add('/kennzahlen', () => setPage(Analytics.render(state.user)));
    Router.add(/^\/ticket\/([\w-]+)$/, (params) => {
      const id = params[0];
      if (global.TicketDetail) setPage(TicketDetail.render(state.user, id));
      else setPage(UI.el('div', { class: 'alert alert--info', text: 'Ticket-Detailansicht folgt.' }));
    });
    Router.add('/admin/users', () => {
      if (global.UserAdmin) setPage(UserAdmin.render(state.user));
      else setPage(UI.el('div', { class: 'alert alert--info', text: 'Benutzerverwaltung folgt.' }));
    });
    Router.add('/admin/bereiche', () => {
      if (global.BereichAdmin) setPage(BereichAdmin.render(state.user));
      else setPage(UI.el('div', { class: 'alert alert--info', text: 'Bereichsverwaltung folgt.' }));
    });
    Router.add('/admin/inbox', () => {
      if (global.Inbox) setPage(Inbox.render(state.user));
      else setPage(UI.el('div', { class: 'alert alert--info', text: 'Posteingang folgt.' }));
    });
  }

  const global = window;

  function showLogin() {
    Auth.renderLogin((user) => {
      state.user = user;
      renderShell();
      registerRoutes();
      Router.start();
      UI.toast(`Angemeldet als ${user.name}`, 'success');
    });
  }

  API.onUnauthorized = () => {
    state.user = null;
    showLogin();
  };

  async function start() {
    try {
      const res = await API.get('/api/auth/me', { suppressAuthRedirect: true });
      state.user = res.user;
      renderShell();
      registerRoutes();
      if (!location.hash) location.hash = '#/dashboard';
      Router.start();
    } catch (_e) {
      showLogin();
    }
  }

  start();
})();

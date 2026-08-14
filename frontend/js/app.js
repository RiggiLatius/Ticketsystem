(function () {
  const state = { user: null };

  function renderApp() {
    const header = UI.el(
      'header',
      { class: 'app-header' },
      UI.el(
        'div',
        { class: 'app-header__brand' },
        'Reisser AG',
        UI.el('span', { text: 'Reklamations-Ticketsystem' })
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

    const main = UI.el('main', { class: 'app-main' }, Dashboard.render(state.user));

    const shell = UI.el('div', { class: 'app-shell' }, header, main);
    UI.mount(shell);
  }

  function showLogin() {
    Auth.renderLogin((user) => {
      state.user = user;
      renderApp();
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
      renderApp();
    } catch (_e) {
      showLogin();
    }
  }

  start();
})();

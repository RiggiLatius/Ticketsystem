(function (global) {
  const Dashboard = {};

  Dashboard.render = function (user) {
    const body = UI.el(
      'div',
      { class: 'card__body stack' },
      UI.el('p', {}, `Willkommen, ${user.name}.`),
      UI.el(
        'p',
        { class: 'muted' },
        user.ist_admin
          ? 'Sie sind als Administrator angemeldet und sehen alle Bereiche.'
          : `Ihre Bereiche: ${
              user.bereiche.length ? user.bereiche.map((b) => b.name).join(', ') : 'keine zugewiesen'
            }.`
      ),
      UI.el(
        'p',
        { class: 'muted' },
        'Das Ticket-Dashboard folgt in Meilenstein 4. Das öffentliche Reklamationsformular kommt in Meilenstein 3.'
      )
    );

    return UI.el(
      'div',
      { class: 'card' },
      UI.el('div', { class: 'card__header' }, UI.el('h1', { style: 'margin:0' }, 'Dashboard')),
      body
    );
  };

  global.Dashboard = Dashboard;
})(window);

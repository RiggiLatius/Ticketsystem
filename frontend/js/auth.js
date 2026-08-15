(function (global) {
  const Auth = {};

  Auth.renderLogin = function (onSuccess) {
    const errorBox = UI.el('div', { class: 'alert alert--error', style: 'display:none' });
    const email = UI.el('input', {
      type: 'email',
      id: 'login-email',
      class: 'form-input',
      required: true,
      autocomplete: 'username',
    });
    const password = UI.el('input', {
      type: 'password',
      id: 'login-password',
      class: 'form-input',
      required: true,
      autocomplete: 'current-password',
    });
    const submit = UI.el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Anmelden');

    const form = UI.el(
      'form',
      {
        class: 'stack',
        onsubmit: async (e) => {
          e.preventDefault();
          errorBox.style.display = 'none';
          submit.disabled = true;
          submit.textContent = 'Wird geprüft…';
          try {
            const res = await API.post(
              '/api/auth/login',
              { email: email.value.trim(), password: password.value },
              { suppressAuthRedirect: true }
            );
            onSuccess(res.user);
          } catch (err) {
            errorBox.textContent = err.message || 'Anmeldung fehlgeschlagen';
            errorBox.style.display = '';
            submit.disabled = false;
            submit.textContent = 'Anmelden';
          }
        },
      },
      errorBox,
      UI.el(
        'div',
        { class: 'form-group' },
        UI.el('label', { class: 'form-label form-label--required', for: 'login-email' }, 'E-Mail'),
        email
      ),
      UI.el(
        'div',
        { class: 'form-group' },
        UI.el('label', { class: 'form-label form-label--required', for: 'login-password' }, 'Passwort'),
        password
      ),
      submit
    );

    const screen = UI.el(
      'div',
      { class: 'login-screen' },
      UI.el(
        'div',
        { class: 'login-card' },
        UI.el(
          'div',
          { class: 'login-brand' },
          UI.el('img', { class: 'login-brand__logo', src: '/assets/logo.png', alt: 'Reisser Gruppe' }),
          UI.el('div', { class: 'login-brand__sub', text: 'Reklamations-Ticketsystem' })
        ),
        form
      )
    );

    UI.mount(screen);
    setTimeout(() => email.focus(), 50);
  };

  Auth.logout = async function () {
    try {
      await API.post('/api/auth/logout');
    } catch (_e) {
      /* ignore */
    }
  };

  global.Auth = Auth;
})(window);

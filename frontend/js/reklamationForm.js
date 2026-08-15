(function () {
  const form = document.getElementById('rekla-form');
  const errorBox = document.getElementById('form-error');
  const kategorieSel = document.getElementById('kategorie');
  const bereichHint = document.getElementById('bereich-hinweis');
  const niederlassungSel = document.getElementById('niederlassung');
  const submitBtn = document.getElementById('submit-btn');
  const formContainer = document.getElementById('form-container');
  const successContainer = document.getElementById('success-container');
  const successTicketId = document.getElementById('success-ticket-id');
  const successMailHint = document.getElementById('success-mail-hint');

  let kategorieMap = {};

  async function loadKategorien() {
    try {
      const data = await API.get('/api/reklamation/kategorien');
      for (const k of data.kategorien) {
        kategorieMap[k.key] = k;
        const opt = document.createElement('option');
        opt.value = k.key;
        opt.textContent = k.label;
        kategorieSel.append(opt);
      }
      for (const n of data.niederlassungen || []) {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        niederlassungSel.append(opt);
      }
    } catch (e) {
      showError('Kategorien konnten nicht geladen werden. Bitte Seite neu laden.');
    }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = '';
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function clearError() {
    errorBox.textContent = '';
    errorBox.style.display = 'none';
  }

  kategorieSel.addEventListener('change', () => {
    const kat = kategorieMap[kategorieSel.value];
    if (!kat) {
      bereichHint.textContent = '';
      return;
    }
    bereichHint.textContent = kat.bereich
      ? `Wird automatisch dem Bereich ${kat.bereich} zugewiesen.`
      : 'Wird von einem Administrator manuell zugewiesen.';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    if (!form.reportValidity()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gesendet…';

    const fd = new FormData(form);

    try {
      const res = await API.post('/api/reklamation', fd, { suppressAuthRedirect: true });
      successTicketId.textContent = '#' + res.ticket_kurz_id;
      const email = form.einreicher_email.value.trim();
      successMailHint.textContent = email
        ? `Eine Bestätigung wurde an ${email} gesendet.`
        : 'Es wurde keine E-Mail-Adresse angegeben, daher erhalten Sie keine automatische Bestätigung.';
      formContainer.style.display = 'none';
      successContainer.style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showError(err.message || 'Beim Absenden ist ein Fehler aufgetreten.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reklamation absenden';
    }
  });

  loadKategorien();
})();

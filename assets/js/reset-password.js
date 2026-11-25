(() => {
  const $ = selector => document.querySelector(selector);

  function showMessage(text, className = 'form-error') {
    const message = $('#reset-message');
    message.className = className;
    message.textContent = text;
    message.hidden = false;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const form = $('#gate-form');
    const submit = $('#save-password');

    try {
      await HLY.init();
      if (!HLY.isConfigured()) throw new Error(HLY.getError() || 'Le service de connexion n’est pas disponible.');
      if (!await HLY.hasRecoverySession()) {
        form.hidden = true;
        showMessage('Ce lien est expiré ou déjà utilisé. Retourne à la connexion et demande un nouveau courriel.');
        return;
      }
    } catch (error) {
      form.hidden = true;
      showMessage(error.message || 'Impossible de vérifier le lien. Demande un nouveau courriel de réinitialisation.');
      return;
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = $('#reset-password').value;
      const confirmation = $('#reset-confirm').value;
      if (password !== confirmation) {
        showMessage('Les deux mots de passe ne correspondent pas.');
        return;
      }

      submit.disabled = true;
      try {
        await HLY.updateAdminPassword(password);
        form.hidden = true;
        showMessage('C’est fait. Ton nouveau mot de passe est enregistré. Tu peux te connecter.', 'save-ok');
        setTimeout(() => window.location.replace('admin.html'), 1800);
      } catch (error) {
        showMessage(error.message || 'Le mot de passe n’a pas pu être modifié. Réessaie.');
        submit.disabled = false;
      }
    });
  });
})();

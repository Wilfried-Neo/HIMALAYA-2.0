(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  let tab = 'orders';

  function renderGate() {
    $('#admin-root').innerHTML = `
      <div class="gate">
        <img src="images/logo.jpg" alt="Logo Himalaya" class="gate-logo">
        <h1>Espace boutique</h1>
        <p>Connectez-vous avec votre compte administrateur pour gérer la boutique.</p>
        <form id="gate-form">
          <input type="email" id="gate-email" placeholder="Adresse e-mail" autocomplete="username" required>
          <input type="password" id="gate-pass" placeholder="Mot de passe" autocomplete="current-password" required>
          <button class="btn btn-primary" type="submit">Se connecter</button>
        </form>
        <p class="form-error" id="gate-error" hidden></p>
        <a class="back-link" href="index.html">← Retour à la boutique</a>
      </div>`;
    const submit = $('#gate-form button[type=submit]');
    if (!HLY.isConfigured()) {
      $('#gate-error').textContent = HLY.getError() || 'La connexion à la base n’est pas configurée.';
      $('#gate-error').hidden = false;
      submit.disabled = true;
    }
    $('#gate-form').addEventListener('submit', async e => {
      e.preventDefault();
      const error = $('#gate-error');
      error.hidden = true;
      submit.disabled = true;
      try {
        await HLY.signInAdmin($('#gate-email').value.trim(), $('#gate-pass').value);
        await renderApp();
      } catch (err) {
        error.textContent = err.message || 'Connexion impossible.';
        error.hidden = false;
      } finally { submit.disabled = false; }
    });
  }

  async function renderApp() {
    await Promise.all([HLY.refreshCatalog(), HLY.refreshOrders()]);
    $('#admin-root').innerHTML = `
      <header class="admin-header">
        <div class="admin-brand"><img src="images/logo.jpg" alt="Himalaya"><span>Espace boutique</span></div>
        <nav class="admin-tabs" role="tablist">
          <button class="tab ${tab === 'orders' ? 'active' : ''}" data-tab="orders">Commandes</button>
          <button class="tab ${tab === 'products' ? 'active' : ''}" data-tab="products">Produits</button>
          <button class="tab ${tab === 'zones' ? 'active' : ''}" data-tab="zones">Livraison</button>
          <button class="tab ${tab === 'settings' ? 'active' : ''}" data-tab="settings">Paramètres</button>
        </nav>
        <div class="admin-actions">
          <a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">Voir le site</a>
          <button class="btn btn-ghost btn-sm" id="logout">Quitter</button>
        </div>
      </header>
      <main class="admin-main" id="admin-main"></main>`;
    $$('.tab').forEach(t => t.addEventListener('click', () => { tab = t.dataset.tab; renderApp(); }));
    $('#logout').addEventListener('click', async () => { await HLY.signOutAdmin(); renderGate(); });
    renderMain();
  }

  function renderMain() {
    if (tab === 'orders') renderOrders();
    else if (tab === 'products') renderProducts();
    else if (tab === 'zones') renderZones();
    else renderSettings();
  }

  function statsBar() {
    const orders = HLY.getOrders();
    const today = HLY.todayStr();
    const todayOrders = orders.filter(o => o.createdAt?.slice(0, 10) === today);
    const pending = orders.filter(o => ['attente', 'preparation', 'livraison', 'prete'].includes(o.status));
    const revenue = orders.filter(o => o.status === 'terminee').reduce((sum, o) => sum + o.total, 0);
    return `<div class="stats">
      <div class="stat"><span class="stat-num">${todayOrders.length}</span><span class="stat-label">Commandes aujourd'hui</span></div>
      <div class="stat"><span class="stat-num">${pending.length}</span><span class="stat-label">En cours</span></div>
      <div class="stat"><span class="stat-num">${HLY.fmt(revenue)}</span><span class="stat-label">Ventes terminées</span></div>
    </div>`;
  }

  function renderOrders() {
    const orders = HLY.getOrders();
    const main = $('#admin-main');
    main.innerHTML = statsBar() + `
      <div class="panel">
        <div class="panel-head"><h2>Commandes (${orders.length})</h2><button class="btn btn-ghost btn-sm" id="export-orders">Exporter (JSON)</button></div>
        ${!orders.length ? '<p class="empty">Aucune commande pour le moment. Les nouvelles commandes apparaîtront ici.</p>' : `
        <div class="table-wrap"><table class="admin-table">
          <thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Mode</th><th>Total</th><th>Statut</th><th></th></tr></thead>
          <tbody>${orders.map(o => `<tr>
            <td><strong>${HLY.esc(o.id)}</strong></td>
            <td>${new Date(o.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <td>${HLY.esc(o.customer.name)}<br><small>${HLY.esc(o.customer.phone)}</small></td>
            <td>${o.mode === 'livraison' ? 'Livraison' : 'Retrait'}</td>
            <td>${HLY.fmt(o.total)}</td>
            <td><select class="status-select" data-id="${HLY.esc(o.id)}" ${o.status === 'annulee' ? 'disabled' : ''}>
              ${Object.entries(HLY.STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select></td>
            <td><button class="btn btn-ghost btn-sm" data-detail="${HLY.esc(o.id)}">Détails</button></td>
          </tr>`).join('')}</tbody>
        </table></div>`}
      </div>
      <div class="modal" id="order-modal" hidden><div class="modal-box">
        <button class="modal-close" id="order-modal-close" aria-label="Fermer">×</button><div id="order-modal-body"></div>
      </div></div>`;

    $('#export-orders').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(orders, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `himalaya-commandes-${HLY.todayStr()}.json`; a.click();
      URL.revokeObjectURL(a.href);
    });
    $$('.status-select').forEach(sel => sel.addEventListener('change', async () => {
      sel.disabled = true;
      try { await HLY.setOrderStatus(sel.dataset.id, sel.value); renderMain(); }
      catch (error) { alert(error.message || 'Impossible de modifier la commande.'); await renderApp(); }
    }));
    const modal = $('#order-modal');
    $$('[data-detail]').forEach(btn => btn.addEventListener('click', () => {
      const o = HLY.getOrders().find(x => x.id === btn.dataset.detail);
      if (!o) return;
      $('#order-modal-body').innerHTML = `
        <h3>Commande ${HLY.esc(o.id)}</h3><p class="muted">${new Date(o.createdAt).toLocaleString('fr-FR')}</p>
        <h4>Client</h4><p>${HLY.esc(o.customer.name)} — ${HLY.esc(o.customer.phone)}<br>
        ${o.mode === 'livraison' ? `Livraison : ${HLY.esc(o.customer.address)}<br>Zone : ${HLY.esc(o.customer.zone)}` : 'Retrait en boutique'}<br>
        Créneau : ${HLY.esc(o.customer.date)} — ${HLY.esc(o.customer.slot)}<br>Paiement : Espèces</p>
        <h4>Articles</h4><table class="admin-table"><tbody>
          ${o.items.map(i => `<tr><td>${i.qty} × ${HLY.esc(i.name)}</td><td>${HLY.fmt(i.price * i.qty)}</td></tr>`).join('')}
          ${o.deliveryFee ? `<tr><td>Livraison</td><td>${HLY.fmt(o.deliveryFee)}</td></tr>` : ''}
          <tr class="total-row"><td><strong>Total</strong></td><td><strong>${HLY.fmt(o.total)}</strong></td></tr>
        </tbody></table><a class="btn btn-wa" target="_blank" rel="noopener" href="${HLY.waLink(HLY.orderSummary(o))}">Envoyer le récapitulatif sur WhatsApp</a>`;
      modal.hidden = false;
    }));
    $('#order-modal-close').addEventListener('click', () => modal.hidden = true);
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  }

  function renderProducts() {
    const prods = HLY.getProducts();
    $('#admin-main').innerHTML = `
      <div class="panel"><div class="panel-head"><h2>Produits (${prods.length})</h2><button class="btn btn-primary btn-sm" id="add-product">+ Ajouter un produit</button></div>
        <div class="table-wrap"><table class="admin-table">
          <thead><tr><th></th><th>Nom</th><th>Prix</th><th>Stock</th><th>Visible</th><th></th></tr></thead>
          <tbody>${prods.map(p => `<tr data-id="${HLY.esc(p.id)}">
            <td><img class="thumb" src="${HLY.esc(p.img)}" alt=""></td>
            <td><input class="cell-input" data-field="name" value="${HLY.esc(p.name)}"></td>
            <td><input class="cell-input cell-price" type="number" min="0" step="50" data-field="price" value="${p.price}"></td>
            <td><input class="cell-input cell-stock" type="number" min="0" data-field="stock" value="${p.stock}"></td>
            <td><input type="checkbox" data-field="available" ${p.available ? 'checked' : ''}></td>
            <td><button class="btn btn-ghost btn-sm" data-del="${HLY.esc(p.id)}">Suppr.</button></td>
          </tr>`).join('')}</tbody>
        </table></div><p class="muted">Les modifications sont enregistrées dans la base partagée.</p>
      </div>
      <div class="modal" id="product-modal" hidden><div class="modal-box">
        <button class="modal-close" id="product-modal-close" aria-label="Fermer">×</button><h3>Nouveau produit</h3>
        <form id="product-form">
          <label>Nom *<input name="name" required placeholder="Ex : Bonbonne 18,9L"></label>
          <label>Format<input name="format" placeholder="Ex : 18,9 L"></label>
          <label>Prix (FCFA) *<input name="price" type="number" min="0" step="50" required placeholder="Ex : 6500"></label>
          <label>Stock *<input name="stock" type="number" min="0" required placeholder="Ex : 10"></label>
          <label>Image (fichier dans le dossier <code>images/</code>)<input name="img" placeholder="Ex : images/bonbonne-19l.jpg"></label>
          <p class="muted">Ajoutez d'abord l'image au dossier <code>images/</code>, puis indiquez son chemin.</p>
          <button class="btn btn-primary" type="submit">Créer le produit</button>
        </form>
      </div></div>`;

    const save = async () => {
      const list = $$('#admin-main tbody tr').map(tr => {
        const old = prods.find(p => p.id === tr.dataset.id);
        return { ...old, name: tr.querySelector('[data-field=name]').value.trim(),
          price: Math.max(0, +tr.querySelector('[data-field=price]').value || 0),
          stock: Math.max(0, +tr.querySelector('[data-field=stock]').value || 0),
          available: tr.querySelector('[data-field=available]').checked };
      });
      try { await HLY.saveProducts(list); }
      catch (error) { alert(error.message || 'Impossible d’enregistrer les produits.'); }
    };
    $$('#admin-main tbody input').forEach(i => i.addEventListener('change', save));
    $$('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce produit du catalogue ?')) return;
      try { await HLY.deleteProduct(btn.dataset.del); renderMain(); }
      catch (error) { alert(error.message || 'Impossible de supprimer le produit.'); }
    }));
    const modal = $('#product-modal');
    $('#add-product').addEventListener('click', () => modal.hidden = false);
    $('#product-modal-close').addEventListener('click', () => modal.hidden = true);
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
    $('#product-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const list = HLY.getProducts();
      list.push({ id: 'p' + crypto.randomUUID().replaceAll('-', '').slice(0, 12),
        name: String(fd.get('name') || '').trim(), format: String(fd.get('format') || '').trim(),
        price: Math.max(0, +fd.get('price') || 0), stock: Math.max(0, +fd.get('stock') || 0),
        available: true, img: String(fd.get('img') || '').trim() || 'images/marque-eau.jpg', desc: '' });
      try { await HLY.saveProducts(list); modal.hidden = true; renderMain(); }
      catch (error) { alert(error.message || 'Impossible de créer le produit.'); }
    });
  }

  function renderZones() {
    const s = HLY.getSettings();
    $('#admin-main').innerHTML = `
      <div class="panel"><div class="panel-head"><h2>Livraison</h2></div>
        <label class="switch-row"><input type="checkbox" id="delivery-toggle" ${s.deliveryEnabled ? 'checked' : ''}>Activer la livraison à domicile</label>
        <h3>Zones et frais</h3><div id="zones-list">
          ${s.zones.map((z, i) => `<div class="zone-row" data-i="${i}">
            <input class="cell-input" data-field="name" value="${HLY.esc(z.name)}" aria-label="Nom de la zone">
            <input class="cell-input cell-price" type="number" min="0" step="100" data-field="fee" value="${z.fee}" aria-label="Frais">
            <button class="btn btn-ghost btn-sm" data-del-zone="${i}">×</button>
          </div>`).join('')}
        </div><button class="btn btn-ghost btn-sm" id="add-zone">+ Ajouter une zone</button>
        <p class="muted">Les modifications sont enregistrées dans la base partagée.</p>
      </div>`;
    const save = async () => {
      const zones = $$('#zones-list .zone-row').map(row => ({
        name: row.querySelector('[data-field=name]').value.trim(),
        fee: Math.max(0, +row.querySelector('[data-field=fee]').value || 0),
      }));
      try { await HLY.saveSettings({ ...HLY.getSettings(), zones }); }
      catch (error) { alert(error.message || 'Impossible d’enregistrer les zones.'); }
    };
    $('#delivery-toggle').addEventListener('change', async e => {
      try { await HLY.saveSettings({ ...HLY.getSettings(), deliveryEnabled: e.target.checked }); }
      catch (error) { alert(error.message || 'Impossible d’enregistrer le réglage.'); }
    });
    $('#zones-list').addEventListener('change', save);
    $$('[data-del-zone]').forEach(b => b.addEventListener('click', async () => {
      const st = HLY.getSettings(); st.zones.splice(+b.dataset.delZone, 1);
      try { await HLY.saveSettings(st); renderMain(); }
      catch (error) { alert(error.message || 'Impossible de supprimer la zone.'); }
    }));
    $('#add-zone').addEventListener('click', async () => {
      const st = HLY.getSettings(); st.zones.push({ name: 'Nouvelle zone', fee: 1000 });
      try { await HLY.saveSettings(st); renderMain(); }
      catch (error) { alert(error.message || 'Impossible d’ajouter la zone.'); }
    });
  }

  function renderSettings() {
    const s = HLY.getSettings();
    $('#admin-main').innerHTML = `
      <div class="panel"><div class="panel-head"><h2>Paramètres</h2></div>
        <form id="settings-form" class="settings-form">
          <label>Numéro WhatsApp (pour recevoir les commandes)<input name="whatsapp" value="${HLY.esc(s.whatsapp)}" placeholder="2250709607381"></label>
          <label>Adresse du point de vente<input name="address" value="${HLY.esc(s.address)}"></label>
          <p class="muted">Les comptes administrateurs et leurs mots de passe sont gérés de manière sécurisée dans Supabase ; aucun mot de passe n’est stocké dans le code du site.</p>
          <button class="btn btn-primary" type="submit">Enregistrer</button>
        </form>
        <hr class="dotted"><h3>Données</h3>
        <p class="muted">Commandes, produits et réglages sont centralisés dans la base sécurisée. Exportez les commandes depuis l’onglet Commandes pour en conserver une copie.</p>
      </div>`;
    $('#settings-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await HLY.saveSettings({ ...HLY.getSettings(), whatsapp: fd.get('whatsapp'), address: fd.get('address') });
        e.target.insertAdjacentHTML('beforeend', '<p class="save-ok">Enregistré ✓</p>');
        setTimeout(() => $('.save-ok')?.remove(), 2000);
      } catch (error) { alert(error.message || 'Impossible d’enregistrer les paramètres.'); }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await HLY.init();
    if (await HLY.hasAdminSession()) {
      try { await renderApp(); }
      catch (error) { renderGate(); alert(error.message || 'Impossible de charger la boutique.'); }
    } else renderGate();
  });
})();

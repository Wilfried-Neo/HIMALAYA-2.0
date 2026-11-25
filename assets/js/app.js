
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const ICONS = {
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 8h13v9H1zM14 11h4l3 3v3h-7z"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  };

  const productGrid = $('#product-grid');
  const cartDrawer = $('#cart-drawer');
  const cartBackdrop = $('#cart-backdrop');
  const checkoutModal = $('#checkout-modal');
  const toast = $('#toast');

  
  function renderProducts() {
    const products = HLY.getProducts().filter(p => p.available);
    productGrid.innerHTML = products.map(p => {
      const out = p.stock <= 0;
      const low = !out && p.stock <= 5;
      return `
      <article class="product-card reveal" data-id="${HLY.esc(p.id)}">
        <div class="product-disc">
          <img src="${HLY.esc(p.img)}" alt="${HLY.esc(p.name)}" loading="lazy">
          ${out ? '<span class="badge badge-out">Épuisé</span>'
                : low ? `<span class="badge badge-low">Plus que ${p.stock}</span>` : ''}
        </div>
        <h3>${HLY.esc(p.name)}</h3>
        <p class="product-desc">${HLY.esc(p.desc)}</p>
        <div class="product-foot">
          <span class="price">${HLY.fmt(p.price)}</span>
          ${out
            ? '<button class="btn btn-disabled" disabled>Indisponible</button>'
            : `<button class="btn btn-primary btn-add" data-id="${HLY.esc(p.id)}">Ajouter</button>`}
        </div>
      </article>`;
    }).join('');

      $$('.btn-add', productGrid).forEach(btn =>
        btn.addEventListener('click', () => {
        if (!HLY.addToCart(btn.dataset.id, 1)) return showToast('Ce produit n’est plus disponible.');
        updateCartUI();
        openCart();
      }));
  }

  /* ---------------- Panier ---------------- */
  function updateCartUI() {
    $('#cart-count').textContent = HLY.cartCount();
    $('#cart-count').hidden = HLY.cartCount() === 0;

    const cart = HLY.getCart();
    const prods = HLY.getProducts();
    const list = $('#cart-items');

    if (!cart.length) {
      list.innerHTML = `<div class="cart-empty">
        <p>Votre panier est vide.</p>
        <button class="btn btn-primary" id="cart-empty-cta">Voir les produits</button>
      </div>`;
      $('#cart-empty-cta').addEventListener('click', () => {
        closeCart();
        $('#produits').scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      list.innerHTML = cart.map(line => {
        const p = prods.find(p => p.id === line.id);
        if (!p) return '';
        return `
        <div class="cart-line" data-id="${HLY.esc(p.id)}">
          <img src="${HLY.esc(p.img)}" alt="${HLY.esc(p.name)}">
          <div class="cart-line-info">
            <strong>${HLY.esc(p.name)}</strong>
            <span>${HLY.fmt(p.price)}</span>
          </div>
          <div class="qty" role="group" aria-label="Quantité">
            <button class="qty-btn" data-act="minus" aria-label="Réduire">−</button>
            <span class="qty-val">${line.qty}</span>
            <button class="qty-btn" data-act="plus" aria-label="Augmenter">+</button>
          </div>
          <span class="cart-line-total">${HLY.fmt(p.price * line.qty)}</span>
        </div>`;
      }).join('');

      $$('.cart-line').forEach(lineEl => {
        const id = lineEl.dataset.id;
        const line = cart.find(i => i.id === id);
        $$('.qty-btn', lineEl).forEach(b => b.addEventListener('click', () => {
          HLY.setQty(id, line.qty + (b.dataset.act === 'plus' ? 1 : -1));
          updateCartUI();
        }));
      });
    }

    $('#cart-subtotal').textContent = HLY.fmt(HLY.cartSubtotal());
    $('#checkout-btn').disabled = !cart.length;
  }

  function openCart() {
    cartDrawer.classList.add('open');
    cartBackdrop.classList.add('open');
    cartBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    cartDrawer.classList.remove('open');
    cartBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => cartBackdrop.hidden = true, 250);
  }

  /* ---------------- Commande (checkout) ---------------- */
  let checkoutStep = 1;
  let chosenMode = 'livraison';

  function openCheckout() {
    if (!HLY.getCart().length) return;
    if (!HLY.isConfigured() || !HLY.isConnected()) {
      showToast(HLY.getError() || 'La boutique en ligne est temporairement indisponible.');
      return;
    }
    closeCart();
    checkoutStep = 1;
    chosenMode = HLY.getSettings().deliveryEnabled ? 'livraison' : 'retrait';
    renderCheckout();
    checkoutModal.classList.add('open');
    checkoutModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeCheckout() {
    checkoutModal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => checkoutModal.hidden = true, 250);
  }

  function renderCheckout() {
    const wrap = $('#checkout-body');
    const steps = $('#checkout-steps');
    steps.innerHTML = [1, 2, 3].map(n =>
      `<span class="step ${n === checkoutStep ? 'active' : n < checkoutStep ? 'done' : ''}">${n}</span>`
    ).join('');

    if (checkoutStep === 1) {
      const delivery = HLY.getSettings().deliveryEnabled;
      wrap.innerHTML = `
        <h3>Comment souhaitez-vous recevoir votre eau ?</h3>
        <div class="mode-cards">
          ${delivery ? `
          <button class="mode-card ${chosenMode === 'livraison' ? 'selected' : ''}" data-mode="livraison">
            <span class="mode-icon">${ICONS.truck}</span>
            <strong>Livraison à domicile</strong>
            <span>On vous livre où vous voulez, dans le créneau choisi. Frais selon la zone.</span>
          </button>` : ''}
          <button class="mode-card ${chosenMode === 'retrait' ? 'selected' : ''}" data-mode="retrait">
            <span class="mode-icon">${ICONS.store}</span>
            <strong>Retrait en boutique</strong>
            <span>Réservez en ligne, payez et récupérez en boutique. Sans frais.</span>
          </button>
        </div>
        <div class="checkout-nav">
          <span></span>
          <button class="btn btn-primary" id="ck-next">Continuer</button>
        </div>`;
      $$('.mode-card', wrap).forEach(c => c.addEventListener('click', () => {
        chosenMode = c.dataset.mode;
        $$('.mode-card', wrap).forEach(x => x.classList.toggle('selected', x === c));
      }));
      $('#ck-next').addEventListener('click', () => { checkoutStep = 2; renderCheckout(); });

    } else if (checkoutStep === 2) {
      const s = HLY.getSettings();
      const cart = HLY.getCart();
      const subtotal = HLY.cartSubtotal();
      const isDelivery = chosenMode === 'livraison';
      const zones = s.zones.map((z, i) => `<option value="${i}">${HLY.esc(z.name)} — ${HLY.fmt(z.fee)}</option>`).join('');
      const dates = [0, 1, 2].map(d => {
        const dt = new Date(); dt.setDate(dt.getDate() + d);
        const label = d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain' : dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        return `<option value="${label}">${label}</option>`;
      }).join('');
      const slots = HLY.SLOTS.map(sl => `<option>${sl}</option>`).join('');

      wrap.innerHTML = `
        <h3>Vos informations</h3>
        <form id="ck-form" novalidate>
          <div class="field-row">
            <label>Nom complet *
              <input type="text" name="name" required placeholder="Ex : Awa Koné">
            </label>
            <label>Téléphone *
              <input type="tel" name="phone" required placeholder="Ex : 07 09 60 73 81">
            </label>
          </div>
          ${isDelivery ? `
          <label>Adresse de livraison *
            <input type="text" name="address" required placeholder="Quartier, rue, repère...">
          </label>
          <label>Zone / Commune *
            <select name="zone" required>
              <option value="">Choisissez votre zone...</option>
              ${zones}
            </select>
          </label>` : `
          <p class="pickup-note"><span class="inline-icon">${ICONS.pin}</span> Retrait au point de vente : ${HLY.esc(s.address)}. Présentez votre numéro de commande au comptoir.</p>`}
          <div class="field-row">
            <label>Date souhaitée *
              <select name="date" required>${dates}</select>
            </label>
            <label>Créneau horaire *
              <select name="slot" required>${slots}</select>
            </label>
          </div>
          <div class="ck-recap">
            <div><span>${cart.reduce((n, i) => n + i.qty, 0)} article(s)</span><span>${HLY.fmt(subtotal)}</span></div>
            <div><span>${isDelivery ? 'Livraison' : 'Retrait boutique'}</span><span id="ck-fee">${isDelivery ? HLY.fmt(s.zones[0]?.fee || 0) : 'Gratuit'}</span></div>
            <div class="ck-total"><span>Total à payer</span><span id="ck-total">${HLY.fmt(subtotal + (isDelivery ? (s.zones[0]?.fee || 0) : 0))}</span></div>
          </div>
          <p class="form-error" id="ck-error" hidden></p>
          <div class="checkout-nav">
            <button type="button" class="btn btn-ghost" id="ck-back">Retour</button>
            <button type="submit" class="btn btn-primary">Continuer</button>
          </div>
        </form>`;

      const form = $('#ck-form');
      const zoneSel = form.querySelector('[name=zone]');
      const refreshTotals = () => {
        const fee = isDelivery ? (s.zones[+zoneSel.value]?.fee || 0) : 0;
        $('#ck-fee').textContent = isDelivery ? HLY.fmt(fee) : 'Gratuit';
        $('#ck-total').textContent = HLY.fmt(subtotal + fee);
      };
      if (zoneSel) zoneSel.addEventListener('change', refreshTotals);
      $('#ck-back').addEventListener('click', () => { checkoutStep = 1; renderCheckout(); });

      form.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(form);
        const err = $('#ck-error');
        const showErr = (msg) => { err.textContent = msg; err.hidden = false; };

        const name = (fd.get('name') || '').trim();
        const phone = (fd.get('phone') || '').trim().replace(/[\s.-]/g, '');
        if (name.length < 2) return showErr('Veuillez entrer votre nom complet.');
        if (!/^(\+225)?0\d{9}$/.test(phone)) return showErr('Numéro de téléphone invalide (ex : 07 09 60 73 81).');
        if (isDelivery && !(fd.get('address') || '').trim()) return showErr('Veuillez indiquer l’adresse de livraison.');
        if (isDelivery && fd.get('zone') === '') return showErr('Veuillez choisir votre zone.');

        checkoutData.customer = {
          name,
          phone,
          address: (fd.get('address') || '').trim(),
          zone: isDelivery ? s.zones[+fd.get('zone')].name : '',
          date: fd.get('date'),
          slot: fd.get('slot'),
        };
        checkoutData.deliveryFee = isDelivery ? s.zones[+fd.get('zone')].fee : 0;
        checkoutStep = 3;
        renderCheckout();
      });

    } else {
      const isDelivery = chosenMode === 'livraison';
      if (turnstileWidgetId !== null && window.turnstile) window.turnstile.remove(turnstileWidgetId);
      turnstileWidgetId = null;
      pendingOrderChallenge = false;
      wrap.innerHTML = `
        <h3>Mode de paiement</h3>
        <div class="pay-options">
          <label class="pay-card">
            <input type="radio" name="pay" value="especes" checked>
            <strong>Espèces ${isDelivery ? 'à la livraison' : 'au retrait'}</strong>
            <span>Vous payez le livreur${isDelivery ? '' : ' au comptoir'} en espèces. Simple et sécurisé.</span>
          </label>
          <label class="pay-card">
            <input type="radio" name="pay" value="mobile">
            <strong>Mobile Money</strong>
            <span>Orange Money, MTN MoMo, Wave ou Moov Money. Vous recevrez une demande de paiement sur votre numéro.</span>
            <em class="pay-soon">Activation en cours — pour cette démo, la commande reste en attente de confirmation.</em>
          </label>
          <label class="pay-card pay-disabled">
            <input type="radio" name="pay" value="carte" disabled>
            <strong>Carte bancaire</strong>
            <span>Bientôt disponible.</span>
          </label>
        </div>
        <div id="turnstile-container" aria-hidden="true"></div>
        <p class="form-error" id="ck-error" hidden></p>
        <div class="checkout-nav">
          <button class="btn btn-ghost" id="ck-back">Retour</button>
          <button class="btn btn-primary" id="ck-confirm">Confirmer la commande</button>
        </div>`;
      $('#ck-back').addEventListener('click', () => { checkoutStep = 2; renderCheckout(); });
      const siteKey = HLY.getTurnstileSiteKey();
      let attempts = 0;
      const mountTurnstile = () => {
        if (!$('#turnstile-container')) return;
        if (window.turnstile && siteKey) {
          turnstileWidgetId = window.turnstile.render('#turnstile-container', {
            sitekey: siteKey,
            callback: token => { if (pendingOrderChallenge) submitSecureOrder(token); },
            'expired-callback': () => { pendingOrderChallenge = false; showCheckoutError('La vérification a expiré. Veuillez réessayer.'); resetConfirmButton(); },
            'error-callback': () => { pendingOrderChallenge = false; showCheckoutError('La vérification de sécurité est indisponible. Réessayez dans un instant.'); resetConfirmButton(); },
          });
        } else if (attempts++ < 50) setTimeout(mountTurnstile, 100);
      };
      mountTurnstile();
      $('#ck-confirm').addEventListener('click', () => {
        const pay = wrap.querySelector('[name=pay]:checked')?.value || 'especes';
        if (pay === 'mobile') {
          showCheckoutError('Le paiement Mobile Money sera activé très bientôt. Choisissez « Espèces » pour valider votre commande maintenant.');
          return;
        }
        if (turnstileWidgetId === null || !window.turnstile) {
          showCheckoutError('La protection de commande n’est pas configurée. Veuillez réessayer plus tard.');
          return;
        }
        pendingOrderChallenge = true;
        const button = $('#ck-confirm');
        button.disabled = true;
        button.textContent = 'Vérification…';
        window.turnstile.execute(turnstileWidgetId);
      });
    }
  }

  const checkoutData = { customer: null, deliveryFee: 0 };
  let turnstileWidgetId = null;
  let pendingOrderChallenge = false;

  function showCheckoutError(message) {
    const err = $('#ck-error');
    if (err) { err.textContent = message; err.hidden = false; }
  }
  function resetConfirmButton() {
    const button = $('#ck-confirm');
    if (button) { button.disabled = false; button.textContent = 'Confirmer la commande'; }
  }
  async function submitSecureOrder(turnstileToken) {
    pendingOrderChallenge = false;
    const button = $('#ck-confirm');
    if (!button) return;
    button.textContent = 'Enregistrement…';
    try {
      const order = await HLY.placeOrder({
        customer: checkoutData.customer, mode: chosenMode,
        items: HLY.getCart(), turnstileToken,
      });
      renderConfirmation(order);
    } catch (error) {
      showCheckoutError(error.message || 'La commande n’a pas pu être enregistrée.');
      resetConfirmButton();
      if (turnstileWidgetId !== null && window.turnstile) window.turnstile.reset(turnstileWidgetId);
      await HLY.refreshCatalog().catch(() => {});
      renderProducts();
      updateCartUI();
    }
  }

  function renderConfirmation(order) {
    updateCartUI();
    renderProducts();
    const wrap = $('#checkout-body');
    $('#checkout-steps').innerHTML = '';
    wrap.innerHTML = `
      <div class="confirm">
        <div class="confirm-check" aria-hidden="true">
          <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M14 27l8 8 16-16"/></svg>
        </div>
        <h3>Commande ${order.id} enregistrée !</h3>
        <p>Merci <strong>${HLY.esc(order.customer.name)}</strong>. Votre commande est <strong>en attente de confirmation</strong> — nous vous appellerons au <strong>${HLY.esc(order.customer.phone)}</strong> très vite.</p>
        <div class="ck-recap">
          ${order.items.map(i => `<div><span>${i.qty} × ${HLY.esc(i.name)}</span><span>${HLY.fmt(i.price * i.qty)}</span></div>`).join('')}
          ${order.deliveryFee ? `<div><span>Livraison</span><span>${HLY.fmt(order.deliveryFee)}</span></div>` : ''}
          <div class="ck-total"><span>Total</span><span>${HLY.fmt(order.total)}</span></div>
        </div>
        <p class="pickup-note">${order.mode === 'livraison'
          ? `Livraison le <strong>${HLY.esc(order.customer.date)}</strong> entre <strong>${HLY.esc(order.customer.slot)}</strong>.`
          : `Retrait en boutique le <strong>${HLY.esc(order.customer.date)}</strong> entre <strong>${HLY.esc(order.customer.slot)}</strong>. Présentez le numéro <strong>${order.id}</strong> au comptoir.`}
        </p>
        <a class="btn btn-wa" href="${HLY.waLink(HLY.orderSummary(order))}" target="_blank" rel="noopener">Recevoir la confirmation sur WhatsApp</a>
        <button class="btn btn-ghost" id="ck-finish">Fermer</button>
      </div>`;
    $('#ck-finish').addEventListener('click', () => { closeCheckout(); });
  }

 
  function initTracking() {
    const form = $('#track-form');
    const result = $('#track-result');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const id = $('#track-input').value.trim().toUpperCase();
      let order;
      try { order = await HLY.trackOrder(id); }
      catch (error) {
        result.innerHTML = `<p class="form-error">${HLY.esc(error.message || 'Le suivi est indisponible.')}</p>`;
        return;
      }
      if (!order) {
        result.innerHTML = `<p class="form-error">Aucune commande trouvée avec le numéro <strong>${HLY.esc(id)}</strong>. Vérifiez le numéro reçu après votre commande.</p>`;
        return;
      }
      const statusClass = { attente: 'st-warn', preparation: 'st-info', livraison: 'st-info', prete: 'st-info', terminee: 'st-ok', annulee: 'st-danger' }[order.status];
      result.innerHTML = `
        <div class="track-card">
          <div class="track-head">
            <strong>${order.id}</strong>
            <span class="status-pill ${statusClass}">${HLY.STATUS[order.status]}</span>
          </div>
          <p>${order.mode === 'livraison' ? 'Livraison' : 'Retrait en boutique'} — ${HLY.esc(order.customer.date)}, ${HLY.esc(order.customer.slot)} · ${order.items.reduce((n, i) => n + i.qty, 0)} article(s) — <strong>${HLY.fmt(order.total)}</strong></p>
        </div>`;
    });
  }

  /* ---------------- Divers ---------------- */
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function initNav() {
    const burger = $('#burger');
    const mobileMenu = $('#mobile-menu');
    burger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('#mobile-menu a').forEach(a => a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    }));
  }

  function initContact() {
    const s = HLY.getSettings();
    $('#wa-contact').href = HLY.waLink('Bonjour Himalaya ! Je souhaite des informations sur vos produits.');
    $('#tel-contact').href = 'tel:+2250709607381';
  }

  /* ---------------- Démarrage ---------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await HLY.init();
    renderProducts();
    updateCartUI();
    initTracking();
    initNav();
    initContact();

    $('#cart-btn').addEventListener('click', openCart);
    $('#cart-close').addEventListener('click', closeCart);
    cartBackdrop.addEventListener('click', closeCart);
    $('#checkout-btn').addEventListener('click', openCheckout);
    $('#checkout-close').addEventListener('click', closeCheckout);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeCart(); closeCheckout(); }
    });

    
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    $$('.reveal').forEach(el => io.observe(el));

    showToast(HLY.isConnected()
      ? 'Bienvenue chez Himalaya — la pureté des sommets'
      : (HLY.getError() || 'Bienvenue chez Himalaya — commandes en ligne indisponibles'));
  });
})();

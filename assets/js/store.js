/* ============================================================
   HIMALAYA — Eau Minérale Naturelle
   store.js : logique partagée (données, stockage, commandes)
   Site statique : les données sont stockées dans le navigateur
   (localStorage) — voir README.md
   ============================================================ */

const HLY = (() => {

  const KEYS = {
    products: 'himalaya_products_v1',
    cart: 'himalaya_cart_v1',
    orders: 'himalaya_orders_v1',
    settings: 'himalaya_settings_v1',
  };

  /* ---------- Produits par défaut (votre catalogue actuel) ---------- */
  const DEFAULT_PRODUCTS = [
    {
      id: 'p50cl', name: "Bouteille 50cl", format: "50 cl",
      price: 500, stock: 50, available: true,
      img: 'images/bouteille-50cl.jpg',
      desc: "Format individuel, idéal pour les déplacements."
    },
    {
      id: 'p15l', name: "Bouteille 1,5L", format: "1,5 L",
      price: 800, stock: 50, available: true,
      img: 'images/bouteille-15l.jpg',
      desc: "Le format familial pour tous les jours."
    },
    {
      id: 'p6x15l', name: "Pack 6 × 1,5L", format: "6 × 1,5 L",
      price: 4000, stock: 30, available: true,
      img: 'images/pack-6x15l.jpg',
      desc: "L'économique : une semaine d'eau pour la famille."
    },
    {
      id: 'p5l', name: "Bonbonne 5L", format: "5 L",
      price: 3500, stock: 20, available: true,
      img: 'images/bonbonne-5l.jpg',
      desc: "Avec robinet : parfaite pour la maison et le bureau."
    },
  ];

  /* ---------- Paramètres par défaut ---------- */
  const DEFAULT_SETTINGS = {
    shopName: 'Himalaya — Eau Minérale Naturelle',
    whatsapp: '2250709607381',           // notifications commandes
    adminPassword: 'himalaya2026',       // à changer dans l'admin
    address: 'Abidjan, Côte d’Ivoire',
    deliveryEnabled: true,
    zones: [
      { name: 'Plateau – Adjamé – Attécoubé', fee: 1000 },
      { name: 'Cocody – Riviera', fee: 1000 },
      { name: 'Marcory – Treichville – Koumassi', fee: 1000 },
      { name: 'Yopougon', fee: 1500 },
      { name: 'Abobo – Anyama', fee: 1500 },
      { name: 'Port-Bouët – Vridi', fee: 1500 },
      { name: 'Bingerville – Grand Abidjan', fee: 2000 },
    ],
  };

  /* ---------- Petits utilitaires ---------- */
  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const todayStr = () => new Date().toISOString().slice(0, 10);

  const newOrderId = () => {
    const n = Math.floor(1000 + Math.random() * 9000);
    return 'HLY-' + n;
  };

  /* ---------- API publique ---------- */
  return {
    KEYS, DEFAULT_PRODUCTS, DEFAULT_SETTINGS, fmt, esc, todayStr, newOrderId,

    getProducts() { return read(KEYS.products, null) || this.seedProducts(); },
    seedProducts() { write(KEYS.products, DEFAULT_PRODUCTS); return [...DEFAULT_PRODUCTS]; },
    saveProducts(list) { write(KEYS.products, list); },

    getSettings() { return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {})); },
    saveSettings(s) { write(KEYS.settings, s); },

    getCart() { return read(KEYS.cart, []); },
    saveCart(c) { write(KEYS.cart, c); },

    getOrders() { return read(KEYS.orders, []); },
    saveOrders(o) { write(KEYS.orders, o); },

    cartCount() { return this.getCart().reduce((s, i) => s + i.qty, 0); },
    cartSubtotal() {
      const prods = this.getProducts();
      return this.getCart().reduce((s, i) => {
        const p = prods.find(p => p.id === i.id);
        return p ? s + p.price * i.qty : s;
      }, 0);
    },

    addToCart(id, qty = 1) {
      const cart = this.getCart();
      const line = cart.find(i => i.id === id);
      if (line) line.qty += qty; else cart.push({ id, qty });
      this.saveCart(cart);
    },
    setQty(id, qty) {
      let cart = this.getCart();
      if (qty <= 0) cart = cart.filter(i => i.id !== id);
      else cart = cart.map(i => i.id === id ? { ...i, qty } : i);
      this.saveCart(cart);
    },
    clearCart() { this.saveCart([]); },

    /* Crée une commande, décrémente le stock, retourne la commande */
    placeOrder({ customer, mode, payment, items, deliveryFee }) {
      const prods = this.getProducts();
      const order = {
        id: this.newOrderId(),
        createdAt: new Date().toISOString(),
        status: 'attente',
        mode,                        // 'livraison' | 'retrait'
        payment,                     // 'especes' | 'mobile'
        customer,
        deliveryFee: mode === 'livraison' ? (deliveryFee || 0) : 0,
        items: items.map(i => {
          const p = prods.find(p => p.id === i.id);
          return { id: i.id, name: p.name, format: p.format, price: p.price, qty: i.qty };
        }),
      };
      order.total = order.items.reduce((s, i) => s + i.price * i.qty, 0) + order.deliveryFee;

      // décrémenter le stock
      const updated = prods.map(p => {
        const line = items.find(i => i.id === p.id);
        return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
      });
      this.saveProducts(updated);

      const orders = this.getOrders();
      orders.unshift(order);
      this.saveOrders(orders);
      this.clearCart();
      return order;
    },

    setOrderStatus(id, status) {
      const orders = this.getOrders().map(o => o.id === id ? { ...o, status } : o);
      this.saveOrders(orders);
      // annulation → remettre le stock
      if (status === 'annulee') this.restoreStock(id);
    },

    restoreStock(id) {
      const order = this.getOrders().find(o => o.id === id);
      if (!order) return;
      const prods = this.getProducts().map(p => {
        const line = order.items.find(i => i.id === p.id);
        return line ? { ...p, stock: p.stock + line.qty } : p;
      });
      this.saveProducts(prods);
    },

    STATUS: {
      attente: 'En attente',
      preparation: 'En préparation',
      livraison: 'En cours de livraison',
      prete: 'Prête au retrait',
      terminee: 'Terminée',
      annulee: 'Annulée',
    },

    SLOTS: ['09h – 12h', '12h – 15h', '15h – 18h', '18h – 20h'],

    /* Résumé texte d'une commande (pour WhatsApp) */
    orderSummary(order) {
      const s = this.getSettings();
      const lines = order.items.map(i => `• ${i.qty} × ${i.name} — ${this.fmt(i.price * i.qty)}`);
      const txt = [
        `Nouvelle commande ${order.id} (Himalaya)`,
        ``,
        `Client : ${order.customer.name}`,
        `Tél : ${order.customer.phone}`,
        order.mode === 'livraison'
          ? `Livraison : ${order.customer.address} (${order.customer.zone})`
          : `Retrait en boutique`,
        `Créneau : ${order.customer.date} — ${order.customer.slot}`,
        `Paiement : ${order.payment === 'especes' ? 'Espèces' : 'Mobile Money'}`,
        ``,
        ...lines,
        ``,
        order.deliveryFee ? `Livraison : ${this.fmt(order.deliveryFee)}` : null,
        `TOTAL : ${this.fmt(order.total)}`,
      ].filter(x => x !== null).join('\n');
      return txt;
    },

    waLink(text) {
      const s = this.getSettings();
      return `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(text)}`;
    },
  };
})();

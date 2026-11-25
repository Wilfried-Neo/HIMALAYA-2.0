const HLY = (() => {
  const KEYS = { cart: 'himalaya_cart_v1' };
  const DEFAULT_PRODUCTS = [
    { id: 'p50cl', name: 'Bouteille 50cl', format: '50 cl', price: 100, stock: 50, available: true, img: 'images/bouteille-50cl.jpg', desc: 'Format individuel, idéal pour les déplacements.' },
    { id: 'p15l', name: 'Bouteille 1,5L', format: '1,5 L', price: 800, stock: 50, available: true, img: 'images/bouteille-15l.jpg', desc: 'Le format familial pour tous les jours.' },
    { id: 'p6x15l', name: 'Pack 6 × 1,5L', format: '6 × 1,5 L', price: 4000, stock: 30, available: true, img: 'images/pack-6x15l.jpg', desc: 'L’économique : une semaine d’eau pour la famille.' },
    { id: 'p5l', name: 'Bonbonne 5L', format: '5 L', price: 3500, stock: 20, available: true, img: 'images/bonbonne-5l.jpg', desc: 'Avec robinet : parfaite pour la maison et le bureau.' },
  ];
  const DEFAULT_SETTINGS = {
    shopName: 'Himalaya — Eau Minérale Naturelle', whatsapp: '2250709607381',
    address: 'Abidjan, Côte d’Ivoire', deliveryEnabled: true,
    zones: [
      { name: 'Plateau – Adjamé – Attécoubé', fee: 1000 },
      { name: 'Cocody – Riviera', fee: 1000 },
      { name: 'Marcory – Treichville – Koumassi', fee: 1000 },
      { name: 'Yopougon', fee: 1500 }, { name: 'Abobo – Anyama', fee: 1500 },
      { name: 'Port-Bouët – Vridi', fee: 1500 }, { name: 'Bingerville – Grand Abidjan', fee: 2000 },
    ],
  };
  const STATUS = {
    attente: 'En attente', preparation: 'En préparation', livraison: 'En cours de livraison',
    prete: 'Prête au retrait', terminee: 'Terminée', annulee: 'Annulée',
  };
  const SLOTS = ['09h – 12h', '12h – 15h', '15h – 18h', '18h – 20h'];

  let client = null;
  let configured = false;
  let connected = false;
  let products = [...DEFAULT_PRODUCTS];
  let settings = { ...DEFAULT_SETTINGS, zones: [...DEFAULT_SETTINGS.zones] };
  let orders = [];
  let lastError = '';

  const fmt = n => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const readCart = () => {
    try { return JSON.parse(localStorage.getItem(KEYS.cart) || '[]'); } catch { return []; }
  };
  const writeCart = cart => localStorage.setItem(KEYS.cart, JSON.stringify(cart));
  const fail = error => { throw new Error(error?.message || 'Une erreur est survenue. Réessayez.'); };
  const mapProduct = p => ({
    id: p.id, name: p.name, format: p.format || '', price: Number(p.price), stock: Number(p.stock),
    available: Boolean(p.available), img: p.img || 'images/marque-eau.jpg', desc: p.description || '',
  });
  const mapOrder = o => ({
    uuid: o.id, id: o.code, code: o.code, createdAt: o.created_at, status: o.status,
    mode: o.mode, payment: o.payment, customer: o.customer, deliveryFee: Number(o.delivery_fee || 0),
    items: o.items || [], total: Number(o.total || 0),
  });

  async function init() {
    const cfg = window.HLY_CONFIG || {};
    configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase?.createClient);
    if (!configured) { lastError = 'La boutique en ligne doit être configurée avant de recevoir des commandes.'; return; }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
    try {
      await refreshCatalog();
      connected = true;
      lastError = '';
    } catch (e) {
      connected = false;
      lastError = e.message || 'Connexion à la boutique impossible.';
    }
  }

  async function refreshCatalog() {
    if (!client) throw new Error('La base de données n’est pas configurée.');
    const [pRes, sRes] = await Promise.all([
      client.from('products').select('*').order('id'),
      client.from('shop_settings').select('*').eq('id', true).single(),
    ]);
    if (pRes.error) fail(pRes.error);
    if (sRes.error) fail(sRes.error);
    products = (pRes.data || []).map(mapProduct).sort((a, b) => {
      const priority = id => id === 'p50cl' ? 0 : id === 'p15l' ? 1 : 2;
      return priority(a.id) - priority(b.id) || a.id.localeCompare(b.id);
    });
    const s = sRes.data;
    settings = {
      shopName: s.shop_name, whatsapp: s.whatsapp, address: s.address,
      deliveryEnabled: s.delivery_enabled, zones: Array.isArray(s.zones) ? s.zones : [],
    };
    connected = true;
  }

  async function refreshOrders() {
    if (!client) throw new Error('La base de données n’est pas configurée.');
    const { data, error } = await client.from('orders').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    orders = (data || []).map(mapOrder);
    return orders;
  }

  async function signInAdmin(email, password) {
    if (!client) throw new Error('La connexion à la base n’est pas configurée.');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Connexion refusée. Vérifiez votre e-mail et votre mot de passe.');
    const { data, error: roleError } = await client.rpc('is_himalaya_admin');
    if (roleError || data !== true) {
      await client.auth.signOut();
      throw new Error('Ce compte n’est pas autorisé à administrer la boutique.');
    }
    await refreshCatalog();
  }

  async function hasAdminSession() {
    if (!client) return false;
    const { data: userData } = await client.auth.getUser();
    if (!userData?.user) return false;
    const { data, error } = await client.rpc('is_himalaya_admin');
    if (error || data !== true) { await client.auth.signOut(); return false; }
    return true;
  }

  async function signOutAdmin() { if (client) await client.auth.signOut(); }

  async function sendPasswordRecovery(email) {
    if (!client) throw new Error('La connexion à la base n’est pas configurée.');
    const redirectTo = new URL('reset-password.html', window.location.href).toString();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      if (/redirect|url/i.test(error.message || '')) {
        throw new Error('Supabase doit autoriser le lien de réinitialisation. Je vais t’aider à régler cela.');
      }
      throw new Error('Le courriel n’a pas pu être demandé. Réessaie dans quelques minutes.');
    }
  }

  async function hasRecoverySession() {
    if (!client) return false;
    const { data, error } = await client.auth.getSession();
    return !error && Boolean(data?.session);
  }

  async function updateAdminPassword(password) {
    if (!client) throw new Error('La connexion à la base n’est pas configurée.');
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data?.user) throw new Error('Le lien a expiré. Demande un nouveau courriel de réinitialisation.');
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error(error.message || 'Le nouveau mot de passe n’a pas pu être enregistré.');
    await client.auth.signOut();
  }

  async function saveProducts(list) {
    if (!client || !connected) throw new Error(lastError || 'Boutique hors ligne.');
    const rows = list.map(p => ({
      id: p.id, name: String(p.name).trim(), format: String(p.format || ''),
      price: Math.max(0, Math.round(Number(p.price) || 0)), stock: Math.max(0, Math.round(Number(p.stock) || 0)),
      available: Boolean(p.available), img: String(p.img || 'images/marque-eau.jpg'), description: String(p.desc || ''),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client.from('products').upsert(rows);
    if (error) fail(error);
    await refreshCatalog();
  }

  async function deleteProduct(id) {
    if (!client || !connected) throw new Error(lastError || 'Boutique hors ligne.');
    const { error } = await client.from('products').delete().eq('id', id);
    if (error) fail(error);
    await refreshCatalog();
  }

  async function saveSettings(next) {
    if (!client || !connected) throw new Error(lastError || 'Boutique hors ligne.');
    const row = {
      id: true, shop_name: next.shopName || DEFAULT_SETTINGS.shopName,
      whatsapp: String(next.whatsapp || '').replace(/\D/g, ''), address: String(next.address || '').trim(),
      delivery_enabled: Boolean(next.deliveryEnabled), zones: next.zones || [], updated_at: new Date().toISOString(),
    };
    const { error } = await client.from('shop_settings').upsert(row);
    if (error) fail(error);
    await refreshCatalog();
  }

  async function placeOrder({ customer, mode, items, turnstileToken }) {
    if (!client || !connected) throw new Error(lastError || 'La boutique en ligne est temporairement indisponible.');
    if (!turnstileToken) throw new Error('La vérification antispam est requise.');
    const { data, error } = await client.functions.invoke('create-himalaya-order', {
      body: {
        customer, mode, zone: customer.zone || '', date: customer.date, slot: customer.slot,
        items: items.map(i => ({ id: i.id, qty: i.qty })), turnstileToken,
      },
    });
    if (error) throw new Error(data?.error || error.message || 'La commande n’a pas pu être enregistrée.');
    if (data?.error) throw new Error(data.error);
    const createdOrder = mapOrder(data.order);
    writeCart([]);
    await refreshCatalog().catch(e => { lastError = e.message || 'Catalogue temporairement indisponible.'; });
    return createdOrder;
  }

  async function trackOrder(code) {
    if (!client || !connected) throw new Error(lastError || 'Le suivi en ligne est temporairement indisponible.');
    const { data, error } = await client.rpc('track_himalaya_order', { p_code: code });
    if (error) fail(error);
    return data ? mapOrder(data) : null;
  }

  async function setOrderStatus(code, status) {
    const order = orders.find(o => o.id === code);
    if (!order?.uuid) throw new Error('Commande introuvable. Actualisez la page et réessayez.');
    const { error } = await client.rpc('admin_set_himalaya_order_status', { p_order_id: order.uuid, p_status: status });
    if (error) fail(error);
    await Promise.all([refreshOrders(), refreshCatalog()]);
  }

  return {
    KEYS, DEFAULT_PRODUCTS, DEFAULT_SETTINGS, STATUS, SLOTS, fmt, esc, todayStr,
    init, isConfigured: () => configured, isConnected: () => connected,
    getTurnstileSiteKey: () => window.HLY_CONFIG?.turnstileSiteKey || '',
    getError: () => lastError,
    getProducts: () => products,
    refreshCatalog,
    getSettings: () => settings,
    getOrders: () => orders,
    refreshOrders,
    signInAdmin, hasAdminSession, signOutAdmin,
    sendPasswordRecovery, hasRecoverySession, updateAdminPassword,
    saveProducts, deleteProduct, saveSettings, placeOrder, trackOrder, setOrderStatus,
    getCart: readCart,
    saveCart: writeCart,
    cartCount: () => readCart().reduce((sum, item) => sum + item.qty, 0),
    cartSubtotal: () => {
      const current = readCart();
      return current.reduce((sum, item) => {
        const product = products.find(p => p.id === item.id);
        return product ? sum + product.price * item.qty : sum;
      }, 0);
    },
    addToCart(id, qty = 1) {
      const product = products.find(p => p.id === id);
      if (!product || !product.available || product.stock <= 0) return false;
      const cart = readCart();
      const line = cart.find(i => i.id === id);
      if (line) line.qty = Math.min(product.stock, line.qty + qty);
      else cart.push({ id, qty: Math.min(product.stock, qty) });
      writeCart(cart);
      return true;
    },
    setQty(id, qty) {
      const product = products.find(p => p.id === id);
      if (qty <= 0 || !product || product.stock <= 0) writeCart(readCart().filter(i => i.id !== id));
      else writeCart(readCart().map(i => i.id === id ? { ...i, qty: Math.min(product.stock, qty) } : i));
    },
    clearCart: () => writeCart([]),
    orderSummary(order) {
      const lines = order.items.map(i => `• ${i.qty} × ${i.name} — ${fmt(i.price * i.qty)}`);
      return [
        `Nouvelle commande ${order.id} (Himalaya)`, '',
        `Client : ${order.customer.name}`, `Tél : ${order.customer.phone}`,
        order.mode === 'livraison' ? `Livraison : ${order.customer.address} (${order.customer.zone})` : 'Retrait en boutique',
        `Créneau : ${order.customer.date} — ${order.customer.slot}`,
        `Paiement : ${order.payment === 'especes' ? 'Espèces' : 'Mobile Money'}`, '',
        ...lines, '', order.deliveryFee ? `Livraison : ${fmt(order.deliveryFee)}` : null,
        `TOTAL : ${fmt(order.total)}`,
      ].filter(x => x !== null).join('\n');
    },
    waLink(text) { return `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(text)}`; },
  };
})();

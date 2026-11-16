(async function(){
  const response = await fetch('data.json');
  if (!response.ok) {
    throw new Error(`No se pudo cargar data.json: ${response.status} ${response.statusText}`);
  }
  const D = await response.json();
  const items = D.items;
  const fmt = v => v == null ? 'Consultar' : '$' + v.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const q = document.getElementById('q'), sel = document.getElementById('cat-sel');
  const tbody = document.getElementById('rows'), count = document.getElementById('count');
  const loadSentinel = document.getElementById('load-sentinel');
  const btnLoadMore = document.getElementById('btn-load-more');

  // Configuración de las 3 Asesoras de Ventas
  const VENDORS = {
    "1": { name: "Maria Trompetero", phone: "584128963010", displayPhone: "0412-8963010" },
    "2": { name: "Elangel Tiberio", phone: "584220402282", displayPhone: "0422-0402282" },
    "3": { name: "Natalia Lopez", phone: "584144982782", displayPhone: "0414-4982782" }
  };

  // Pre-indexado para búsqueda de alto rendimiento
  const itemMap = new Map();
  items.forEach(it => {
    it._s = (it.k + ' ' + (it.r || '') + ' ' + (it.m || '') + ' ' + (it.b || '')).toLowerCase();
    itemMap.set(it.k, it);
  });

  // Carga de categorías en el select
  D.cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c.charAt(0) + c.slice(1).toLowerCase();
    sel.appendChild(o);
  });

  // Estado del Carrito con persistencia en localStorage
  let cart = {};
  try {
    const saved = localStorage.getItem('wilka_cart');
    if (saved) cart = JSON.parse(saved);
  } catch(e) { cart = {}; }

  function saveCart() {
    try {
      localStorage.setItem('wilka_cart', JSON.stringify(cart));
    } catch(e){}
    updateCartUI();
    updateTableButtons();
  }

  function getCartTotals() {
    let totalQty = 0;
    let baseSubtotal = 0;
    let t1Subtotal = 0;
    let t2Subtotal = 0;

    for (const k in cart) {
      const it = itemMap.get(k);
      const qty = cart[k];
      if (it && qty > 0) {
        totalQty += qty;
        baseSubtotal += (it.p[0] || 0) * qty;
        t1Subtotal += (it.p[1] || it.p[0] || 0) * qty;
        t2Subtotal += (it.p[2] || it.p[0] || 0) * qty;
      }
    }

    // Determinación del tramo según el monto
    let tierIndex = 0;
    let tierName = "Precio base (90$)";
    let finalTotal = baseSubtotal;

    if (baseSubtotal >= 500) {
      tierIndex = 2;
      tierName = "Desde 500$ (7% desc.)";
      finalTotal = t2Subtotal;
    } else if (baseSubtotal >= 100) {
      tierIndex = 1;
      tierName = "Desde 100$ (3% desc.)";
      finalTotal = t1Subtotal;
    }

    return { totalQty, baseSubtotal, finalTotal, tierIndex, tierName };
  }

  function addToCart(k, delta) {
    const current = cart[k] || 0;
    const next = current + delta;
    if (next <= 0) {
      delete cart[k];
    } else {
      cart[k] = Math.min(9999, next);
    }
    saveCart();
  }

  function setCartQty(k, qty) {
    const q = parseInt(qty, 10);
    if (isNaN(q) || q <= 0) {
      delete cart[k];
    } else {
      cart[k] = Math.min(9999, q);
    }
    saveCart();
  }

  function updateCartUI() {
    const totals = getCartTotals();
    const badge = document.getElementById('cart-badge');
    if (badge) badge.textContent = totals.totalQty;

    const totalQtyEl = document.getElementById('cart-total-qty');
    if (totalQtyEl) totalQtyEl.textContent = totals.totalQty + (totals.totalQty === 1 ? ' unid.' : ' unids.');

    const tierNameEl = document.getElementById('cart-tier-name');
    if (tierNameEl) tierNameEl.textContent = totals.tierName;

    const tierBadgeEl = document.getElementById('cart-tier-badge');
    if (tierBadgeEl) {
      if (totals.tierIndex === 2) {
        tierBadgeEl.innerHTML = '<i class="ri-fire-fill" style="color:#ff6b85;margin-right:4px;"></i> Tramo 7% de descuento activo';
      } else if (totals.tierIndex === 1) {
        tierBadgeEl.innerHTML = '<i class="ri-gift-line" style="color:#ff6b85;margin-right:4px;"></i> Tramo 3% de descuento activo';
      } else {
        tierBadgeEl.innerHTML = '<i class="ri-price-tag-3-line" style="color:var(--muted);margin-right:4px;"></i> Precio base (mínimo sugerido 90$)';
      }
    }

    const priceEl = document.getElementById('cart-total-price');
    if (priceEl) priceEl.textContent = fmt(totals.finalTotal);

    // Actualizar indicador de Envío Gratis (Meta: 200$)
    const FREE_SHIPPING_GOAL = 200;
    const shippingBanner = document.getElementById('cart-shipping-banner');
    const shippingText = document.getElementById('shipping-banner-text');
    const shippingIcon = document.getElementById('shipping-banner-icon');
    const shippingBar = document.getElementById('shipping-progress-bar');

    const currentAmount = totals.finalTotal;
    const diff = FREE_SHIPPING_GOAL - currentAmount;
    const pct = Math.min(100, Math.max(0, Math.round((currentAmount / FREE_SHIPPING_GOAL) * 100)));

    if (shippingBar) shippingBar.style.width = pct + '%';

    if (currentAmount >= FREE_SHIPPING_GOAL) {
      if (shippingBanner) shippingBanner.classList.add('qualified');
      if (shippingIcon) shippingIcon.className = 'ri-checkbox-circle-fill shipping-icon';
      if (shippingText) {
        shippingText.innerHTML = '¡Felicidades! Calificas para <strong class="highlight-free">Envío Gratis</strong> a nivel nacional';
      }
    } else {
      if (shippingBanner) shippingBanner.classList.remove('qualified');
      if (shippingIcon) shippingIcon.className = 'ri-truck-line shipping-icon';
      if (shippingText) {
        shippingText.innerHTML = `Te faltan <strong class="highlight-amount">${fmt(diff)}</strong> para tener <strong class="highlight-target">Envío Gratis</strong>`;
      }
    }

    // Renderizar items dentro del Drawer
    const cartBody = document.getElementById('cart-body');
    if (!cartBody) return;

    const keys = Object.keys(cart);
    if (keys.length === 0) {
      cartBody.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon"><i class="ri-shopping-bag-3-line"></i></div>
          <p><strong>Tu pedido está vacío</strong></p>
          <p>Explora el catálogo y agrega productos haciendo clic en <b>Pedir</b>.</p>
        </div>
      `;
      return;
    }

    let html = '<div class="cart-items-list">';
    keys.forEach(k => {
      const it = itemMap.get(k);
      const qty = cart[k];
      if (!it || qty <= 0) return;
      const unitPrice = it.p[totals.tierIndex] || it.p[0] || 0;
      const subtotal = unitPrice * qty;

      html += `
        <div class="cart-item" data-code="${it.k}">
          <div class="cart-item-top">
            <div class="cart-item-tags">
              <span class="cart-tag-code">${it.k}</span>
              ${it.r ? `<span class="cart-tag-ref">Ref: ${it.r}</span>` : ''}
              ${it.b ? `<span class="cart-tag-ref">${it.b}</span>` : ''}
            </div>
            <button type="button" class="cart-item-del" data-del="${it.k}" title="Eliminar del pedido"><i class="ri-delete-bin-line"></i></button>
          </div>
          <div class="cart-item-desc">${it.m || 'Sin descripción'}</div>
          <div class="cart-item-bottom">
            <div class="cart-item-stepper">
              <button type="button" data-op="dec" data-code="${it.k}" aria-label="Disminuir"><i class="ri-subtract-line"></i></button>
              <input type="number" inputmode="numeric" pattern="[0-9]*" class="cart-item-qty-input" value="${qty}" min="1" max="9999" data-code="${it.k}" aria-label="Cantidad">
              <button type="button" data-op="inc" data-code="${it.k}" aria-label="Aumentar"><i class="ri-add-line"></i></button>
            </div>
            <div class="cart-item-prices">
              <div class="cart-item-unit">${fmt(unitPrice)} c/u</div>
              <div class="cart-item-subtot">${fmt(subtotal)}</div>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    cartBody.innerHTML = html;

    // Delegación de eventos en los botones del carrito
    cartBody.querySelectorAll('[data-op]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        const op = btn.getAttribute('data-op');
        addToCart(code, op === 'inc' ? 1 : -1);
      });
    });

    cartBody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-del');
        addToCart(code, -9999);
      });
    });

    cartBody.querySelectorAll('.cart-item-qty-input').forEach(input => {
      input.addEventListener('focus', () => input.select());
      input.addEventListener('change', () => {
        const code = input.getAttribute('data-code');
        setCartQty(code, input.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
      });
    });
  }

  function updateTableButtons() {
    tbody.querySelectorAll('td.act').forEach(td => {
      const code = td.getAttribute('data-code');
      const qty = cart[code] || 0;
      const existingStepperInput = td.querySelector('.row-stepper-qty');

      if (qty > 0) {
        if (existingStepperInput) {
          if (existingStepperInput !== document.activeElement) {
            existingStepperInput.value = qty;
          }
          return;
        }
        td.innerHTML = `
          <div class="row-stepper">
            <button type="button" data-row-op="dec" data-code="${code}" aria-label="Disminuir"><i class="ri-subtract-line"></i></button>
            <input type="number" inputmode="numeric" pattern="[0-9]*" class="row-stepper-qty" value="${qty}" min="0" max="9999" data-code="${code}" aria-label="Cantidad en pedido">
            <button type="button" data-row-op="inc" data-code="${code}" aria-label="Aumentar"><i class="ri-add-line"></i></button>
          </div>
        `;
      } else {
        if (td.querySelector('.card-add-group')) {
          return;
        }
        td.innerHTML = `
          <div class="card-add-group">
            <div class="card-qty-control">
              <span class="card-qty-label">Cant:</span>
              <input type="number" inputmode="numeric" pattern="[0-9]*" class="card-qty-input" value="1" min="1" max="9999" data-code="${code}" aria-label="Cantidad a pedir">
            </div>
            <button type="button" class="btn-row-add" data-row-add="${code}"><i class="ri-shopping-cart-2-line"></i> Pedir</button>
          </div>
        `;
      }
    });
  }

  // Delegación de eventos en la tabla (Agregar / Modificar cantidad)
  tbody.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-row-add]');
    if (addBtn) {
      const code = addBtn.getAttribute('data-row-add');
      const container = addBtn.closest('td.act');
      const qtyInput = container ? container.querySelector('.card-qty-input') : null;
      let qty = 1;
      if (qtyInput) {
        const parsed = parseInt(qtyInput.value, 10);
        if (!isNaN(parsed) && parsed > 0) qty = parsed;
      }
      addToCart(code, qty);
      return;
    }
    const opBtn = e.target.closest('[data-row-op]');
    if (opBtn) {
      const code = opBtn.getAttribute('data-code');
      const op = opBtn.getAttribute('data-row-op');
      addToCart(code, op === 'inc' ? 1 : -1);
      return;
    }
  });

  tbody.addEventListener('change', (e) => {
    const qtyInput = e.target.closest('.row-stepper-qty');
    if (qtyInput) {
      const code = qtyInput.getAttribute('data-code');
      setCartQty(code, qtyInput.value);
    }
  });

  tbody.addEventListener('focusin', (e) => {
    if (e.target.matches('.row-stepper-qty, .card-qty-input')) {
      e.target.select();
    }
  });

  tbody.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.matches('.row-stepper-qty')) {
        e.target.blur();
      } else if (e.target.matches('.card-qty-input')) {
        const container = e.target.closest('td.act');
        const addBtn = container ? container.querySelector('[data-row-add]') : null;
        if (addBtn) addBtn.click();
      }
    }
  });

  // =========================================================================
  // Renderizado Progresivo y Optimización de Rendimiento
  // =========================================================================
  const CHUNK_SIZE = 60;
  let filteredList = [];
  let renderedCount = 0;
  let currentCategory = null;

  function cell(text, cls){
    const td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    return td;
  }

  function renderRow(it) {
    const tr = document.createElement('tr');
    tr.appendChild(cell(it.k || '—', 'code'));
    tr.appendChild(cell(it.r || '—'));
    tr.appendChild(cell((it.m || '—') + (it.n ? '  · NUEVA' : '')));
    tr.appendChild(cell(it.q || '—'));
    tr.appendChild(cell(it.b || '—'));
    tr.appendChild(cell(fmt(it.p[0]), 'num'));
    tr.appendChild(cell(fmt(it.p[1]), 'num best'));
    tr.appendChild(cell(fmt(it.p[2]), 'num'));

    const tdAct = document.createElement('td');
    tdAct.className = 'act';
    tdAct.setAttribute('data-code', it.k);

    const qty = cart[it.k] || 0;
    if (qty > 0) {
      tdAct.innerHTML = `
        <div class="row-stepper">
          <button type="button" data-row-op="dec" data-code="${it.k}" aria-label="Disminuir"><i class="ri-subtract-line"></i></button>
          <input type="number" inputmode="numeric" pattern="[0-9]*" class="row-stepper-qty" value="${qty}" min="0" max="9999" data-code="${it.k}" aria-label="Cantidad en pedido">
          <button type="button" data-row-op="inc" data-code="${it.k}" aria-label="Aumentar"><i class="ri-add-line"></i></button>
        </div>
      `;
    } else {
      tdAct.innerHTML = `
        <div class="card-add-group">
          <div class="card-qty-control">
            <span class="card-qty-label">Cant:</span>
            <input type="number" inputmode="numeric" pattern="[0-9]*" class="card-qty-input" value="1" min="1" max="9999" data-code="${it.k}" aria-label="Cantidad a pedir">
          </div>
          <button type="button" class="btn-row-add" data-row-add="${it.k}"><i class="ri-shopping-cart-2-line"></i> Pedir</button>
        </div>
      `;
    }
    tr.appendChild(tdAct);
    return tr;
  }

  function renderNextBatch() {
    if (renderedCount >= filteredList.length) {
      if (btnLoadMore) btnLoadMore.style.display = 'none';
      return;
    }

    const end = Math.min(renderedCount + CHUNK_SIZE, filteredList.length);
    const frag = document.createDocumentFragment();

    for (let i = renderedCount; i < end; i++) {
      const it = filteredList[i];
      if (it.c !== currentCategory) {
        currentCategory = it.c;
        const n = filteredList.filter(x => x.c === currentCategory).length;
        const hr = document.createElement('tr');
        hr.className = 'catrow';
        const td = document.createElement('td');
        td.colSpan = 9;
        const label = document.createElement('span');
        label.textContent = n + ' producto' + (n === 1 ? '' : 's');
        td.appendChild(label);
        td.appendChild(document.createTextNode(currentCategory));
        hr.appendChild(td);
        frag.appendChild(hr);
      }
      frag.appendChild(renderRow(it));
    }

    renderedCount = end;
    tbody.appendChild(frag);

    if (btnLoadMore) {
      if (renderedCount < filteredList.length) {
        btnLoadMore.style.display = 'inline-block';
        btnLoadMore.textContent = `Cargar más productos (${renderedCount} de ${filteredList.length})`;
      } else {
        btnLoadMore.style.display = 'none';
      }
    }
  }

  function apply() {
    const t = q.value.trim().toLowerCase();
    const c = sel.value;

    filteredList = items.filter(it => (!c || it.c === c) && (!t || it._s.includes(t)));
    tbody.textContent = '';
    renderedCount = 0;
    currentCategory = null;

    count.textContent = filteredList.length + ' producto' + (filteredList.length === 1 ? '' : 's') + ' en ' + new Set(filteredList.map(i => i.c)).size + ' categorías';

    if (!filteredList.length) {
      const tr = document.createElement('tr');
      const td = cell('No encontramos productos con esa búsqueda.', 'empty');
      td.colSpan = 9;
      tr.appendChild(td);
      tbody.appendChild(tr);
      if (btnLoadMore) btnLoadMore.style.display = 'none';
      return;
    }

    renderNextBatch();
  }

  // Debounce para respuesta inmediata al escribir
  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 150);
  });
  sel.addEventListener('change', apply);

  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', renderNextBatch);
  }

  // Scroll infinito progresivo con IntersectionObserver
  if ('IntersectionObserver' in window && loadSentinel) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && renderedCount < filteredList.length) {
          renderNextBatch();
        }
      });
    }, { rootMargin: '300px' });
    observer.observe(loadSentinel);
  }

  // =========================================================================
  // Control de Apertura / Cierre del Carrito Drawer
  // =========================================================================
  const cartDrawer = document.getElementById('cart-drawer');
  const cartBackdrop = document.getElementById('cart-backdrop');
  const cartFloatBtn = document.getElementById('cart-float-btn');
  const cartCloseBtn = document.getElementById('cart-close');

  function openCart() {
    if (cartDrawer) cartDrawer.classList.add('open');
    if (cartBackdrop) cartBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    if (cartDrawer) cartDrawer.classList.remove('open');
    if (cartBackdrop) cartBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (cartFloatBtn) cartFloatBtn.addEventListener('click', openCart);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);

  // =========================================================================
  // Modal de Selección de Asesora y Envío del Pedido a WhatsApp
  // =========================================================================
  const vendorModal = document.getElementById('vendor-modal');
  const vendorModalBackdrop = document.getElementById('vendor-modal-backdrop');
  const vendorModalClose = document.getElementById('vendor-modal-close');
  const btnSendWhatsApp = document.getElementById('btn-send-whatsapp');
  const vendorChoiceButtons = document.querySelectorAll('.btn-vendor-choice');

  function openVendorModal() {
    if (vendorModal) vendorModal.classList.add('open');
    if (vendorModalBackdrop) vendorModalBackdrop.classList.add('open');
  }

  function closeVendorModal() {
    if (vendorModal) vendorModal.classList.remove('open');
    if (vendorModalBackdrop) vendorModalBackdrop.classList.remove('open');
  }

  if (vendorModalClose) vendorModalClose.addEventListener('click', closeVendorModal);
  if (vendorModalBackdrop) vendorModalBackdrop.addEventListener('click', closeVendorModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (vendorModal && vendorModal.classList.contains('open')) {
        closeVendorModal();
      } else if (cartDrawer && cartDrawer.classList.contains('open')) {
        closeCart();
      }
    }
  });

  // Al hacer clic en "Enviar Pedido a WhatsApp", verificar carrito y abrir modal
  if (btnSendWhatsApp) {
    btnSendWhatsApp.addEventListener('click', () => {
      const keys = Object.keys(cart).filter(k => (cart[k] || 0) > 0);
      if (keys.length === 0) {
        alert("Tu carrito está vacío. Agrega productos antes de enviar.");
        return;
      }
      openVendorModal();
    });
  }

  // Enviar el pedido a la asesora seleccionada
  function sendOrderToVendor(vendorId) {
    const keys = Object.keys(cart).filter(k => (cart[k] || 0) > 0);
    if (keys.length === 0) {
      alert("Tu carrito está vacío. Agrega productos antes de enviar.");
      closeVendorModal();
      return;
    }

    const vendor = VENDORS[vendorId] || VENDORS["1"];
    const totals = getCartTotals();
    const today = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Armar mensaje estructurado con código, referencia y cantidad
    let msg = `*PEDIDO WEB - WILKA PARTS INVERSIONES*\n`;
    msg += `📅 *Fecha:* ${today}\n`;
    msg += `👩‍💼 *Atención:* ${vendor.name}\n`;
    msg += `-------------------------------------------\n`;
    msg += `*LISTA DE PRODUCTOS SELECCIONADOS:*\n\n`;

    let itemIndex = 1;
    keys.forEach(k => {
      const it = itemMap.get(k);
      const qty = cart[k];
      if (!it || qty <= 0) return;
      const unitPrice = it.p[totals.tierIndex] || it.p[0] || 0;
      const subtotal = unitPrice * qty;

      msg += `${itemIndex}. *Cód:* ${it.k} | *Ref:* ${it.r || 'N/A'}\n`;
      msg += `   *Desc:* ${it.m || 'S/D'}\n`;
      if (it.b) msg += `   *Marca:* ${it.b}\n`;
      msg += `   *Cantidad:* ${qty} unid(s).\n`;
      msg += `   *Precio Unit:* ${fmt(unitPrice)} | *Subtotal:* ${fmt(subtotal)}\n\n`;
      itemIndex++;
    });

    msg += `-------------------------------------------\n`;
    msg += `*Total de Piezas:* ${totals.totalQty} unids.\n`;
    msg += `*Condición de Compra:* ${totals.tierName}\n`;
    msg += `*Envío Nacional:* ${totals.finalTotal >= 200 ? '¡GRATIS! (Supera 200$)' : `Faltan ${fmt(200 - totals.finalTotal)} para envío gratis`}\n`;
    msg += `*TOTAL ESTIMADO:* ${fmt(totals.finalTotal)}\n\n`;
    msg += `Hola ${vendor.name}, le comparto este pedido generado desde la página web para consultar disponibilidad y coordinar pago/despacho. ¡Muchas gracias!`;

    // Cerrar modal y abrir WhatsApp
    closeVendorModal();
    const waUrl = `https://wa.me/${vendor.phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  }

  vendorChoiceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const vId = btn.getAttribute('data-vendor');
      sendOrderToVendor(vId);
    });
  });

  // Inicializar catálogo y carrito
  apply();
  updateCartUI();

  // =========================================================================
  // Control de Zoom y Densidad Móvil (Acercar / Expandir / Alejar)
  // =========================================================================
  const tableWrap = document.getElementById('table-wrap');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const zoomLevelText = document.getElementById('zoom-level-text');
  const btnToggleView = document.getElementById('btn-toggle-view');
  const viewModeLabel = document.getElementById('view-mode-label');

  const ZOOM_LEVELS = [70, 85, 100, 115, 130];
  let currentZoomIdx = 2; // Por defecto 100%

  function applyZoom(idx) {
    if (idx < 0) idx = 0;
    if (idx >= ZOOM_LEVELS.length) idx = ZOOM_LEVELS.length - 1;
    currentZoomIdx = idx;
    const pct = ZOOM_LEVELS[currentZoomIdx];

    if (tableWrap) {
      tableWrap.style.setProperty('--mobile-zoom', pct / 100);
      tableWrap.classList.remove('zoom-compact', 'zoom-normal', 'zoom-expanded');
      if (pct <= 85) {
        tableWrap.classList.add('zoom-compact');
      } else if (pct >= 115) {
        tableWrap.classList.add('zoom-expanded');
      } else {
        tableWrap.classList.add('zoom-normal');
      }
    }

    if (zoomLevelText) {
      zoomLevelText.textContent = pct + '%';
    }

    try {
      localStorage.setItem('wilka_zoom_idx', currentZoomIdx);
    } catch(e) {}
  }

  // Restaurar zoom previo
  try {
    const savedIdx = localStorage.getItem('wilka_zoom_idx');
    if (savedIdx !== null) {
      applyZoom(parseInt(savedIdx, 10));
    } else {
      applyZoom(2);
    }
  } catch(e) {
    applyZoom(2);
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      applyZoom(currentZoomIdx - 1);
    });
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      applyZoom(currentZoomIdx + 1);
    });
  }

  // Toggle de modo Tarjeta / Tabla en celulares
  if (btnToggleView) {
    btnToggleView.addEventListener('click', () => {
      if (!tableWrap) return;
      const isCard = tableWrap.classList.toggle('mobile-cards-view');
      if (viewModeLabel) {
        viewModeLabel.textContent = isCard ? 'Tabla' : 'Tarjetas';
      }
      btnToggleView.classList.toggle('active', isCard);
      try {
        localStorage.setItem('wilka_card_view', isCard ? '1' : '0');
      } catch(e) {}
    });

    try {
      if (localStorage.getItem('wilka_card_view') === '1' && tableWrap) {
        tableWrap.classList.add('mobile-cards-view');
        if (viewModeLabel) viewModeLabel.textContent = 'Tabla';
        btnToggleView.classList.add('active');
      }
    } catch(e) {}
  }

  // Soporte de gestos táctiles (Pinch to zoom y doble tap en celulares)
  if (tableWrap) {
    let initialDistance = 0;
    let lastTap = 0;

    tableWrap.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 300) {
          // Doble tap: alternar entre alejar (compacto) y normal
          if (currentZoomIdx <= 1) {
            applyZoom(2);
          } else {
            applyZoom(0);
          }
        }
        lastTap = now;
      }
    }, { passive: true });

    tableWrap.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = currentDistance - initialDistance;
        if (Math.abs(diff) > 40) {
          if (diff > 0) {
            applyZoom(currentZoomIdx + 1);
          } else {
            applyZoom(currentZoomIdx - 1);
          }
          initialDistance = currentDistance;
        }
      }
    }, { passive: true });

    tableWrap.addEventListener('touchend', () => {
      initialDistance = 0;
    }, { passive: true });
  }
})();

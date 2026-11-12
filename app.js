(() => {
  'use strict';

  const CONFIG = {
    currency: 'جنيه',
    whatsappNumber: '201000000000',
    languageUrl: 'https://sticklyiq.com/en.html',
    gasWebAppUrl: '',
    rushFee: 60,
    designFee: 60,
    shippingFee: 60,
    freeShippingQuantity: 5000,
    coupons: {
      STICKY10: { type: 'percent', value: 10, label: '10%' },
      SAVE100: { type: 'amount', value: 100, label: '100 جنيه' }
    },
    maxFiles: 5,
    maxFileSizeMb: 50,
    sizeFactors: { 4: 1, 5: 1.22, 6: 1.48, 7: 1.78 },
    cutFees: { sheet: 0, full: 0.25 },
    materials: {
      tc: { label: 'ستيكر TC', short: 'TC', base: 0.50 },
      jack: { label: 'ستيكر جاك', short: 'JK', base: 0.70 },
      clear: { label: 'ستيكر شفاف', short: 'CL', base: 0.85 },
      photo: { label: 'ستيكر ورقي فوتو', short: 'PH', base: 0.80 },
      vinyl: {
        label: 'فينيل', short: 'VN', base: 0.75,
        finishes: {
          gloss: { label: 'لامع', base: 0.75 },
          matte: { label: 'مط', base: 0.80 },
          transparent: { label: 'شفاف', base: 0.90 }
        }
      }
    },
    discountBands: [
      { min: 1000, rate: 0.20 },
      { min: 500, rate: 0.10 },
      { min: 250, rate: 0.07 },
      { min: 100, rate: 0.05 },
      { min: 0, rate: 0 }
    ],
    stages: ['جاري الإعداد', 'جاري التصميم', 'في مرحلة الطباعة', 'في مرحلة السلوفان', 'في مرحلة القص', 'في مرحلة الشحن', 'تم التسليم']
  };

  const state = {
    category: '',
    material: 'tc',
    vinylFinish: 'gloss',
    size: 4,
    quantity: 100,
    cut: 'sheet',
    design: 'ready',
    rush: 'standard',
    coupon: null,
    files: [],
    rawFiles: [],
    lastCalculation: null
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const money = (value) => `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج`;
  const integer = (value) => Number(value || 0).toLocaleString('en-US');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const normalizeEgyptianDigits = (value) => String(value || '').replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
  const normalizeEgyptianPhone = (value) => normalizeEgyptianDigits(value).replace(/\D/g, '').slice(0, 11);
  const isValidEgyptianPhone = (value) => /^01[0125]\d{8}$/.test(value);
  const showToast = (message) => {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  const getMaterial = () => {
    const material = CONFIG.materials[state.material];
    if (state.material === 'vinyl') {
      const finish = material.finishes[state.vinylFinish];
      return { key: `vinyl-${state.vinylFinish}`, label: `${material.label} ${finish.label}`, short: material.short, base: finish.base, finish: finish.label };
    }
    return { key: state.material, label: material.label, short: material.short, base: material.base };
  };

  const getDiscountRate = (quantity) => {
    const band = CONFIG.discountBands.find((item) => quantity >= item.min);
    return band ? band.rate : 0;
  };

  const getDiscountProgress = (quantity) => {
    if (quantity < 100) return clamp((quantity / 100) * 8, 2, 8);
    if (quantity < 250) return 8 + ((quantity - 100) / 150) * 25;
    if (quantity < 500) return 33 + ((quantity - 250) / 250) * 27;
    if (quantity < 1000) return 60 + ((quantity - 500) / 500) * 40;
    return 100;
  };

  const getMaterialExplanation = (material) => ({
    tc: { title: 'ستيكر TC — اختيار عملي واقتصادي', text: 'مناسب للعبوات والمنتجات اليومية. خامة مرنة وسعرها مناسب للكميات الكبيرة.' },
    jack: { title: 'ستيكر جاك — شكل أقوى ولمعة أوضح', text: 'اختيار جيد للمنتجات التي تحتاج خامة أكثر تحملاً وشكلاً مرتباً على الرف.' },
    clear: { title: 'ستيكر شفاف — خلي الخلفية جزء من التصميم', text: 'مناسب للزجاج والعبوات الشفافة عندما تريد أن يظهر لون المنتج من خلف الاستيكر.' },
    photo: { title: 'ورقي فوتو — ألوان واضحة وتكلفة موفرة', text: 'مناسب للملصقات الداخلية والاستخدامات المؤقتة التي تحتاج صورة وألواناً واضحة.' },
    vinyl: { title: 'فينيل — مرن للاستخدامات المتنوعة', text: 'خامة مناسبة للزجاج والواجهات والمنتجات التي تحتاج اختيار لمعة أو مط أو شفاف.' }
  }[material] || {});

  const getCouponDiscount = (amount) => {
    if (!state.coupon) return 0;
    const coupon = CONFIG.coupons[state.coupon.code];
    if (!coupon) return 0;
    return Math.min(amount, coupon.type === 'percent' ? amount * (coupon.value / 100) : coupon.value);
  };

  const calculate = () => {
    const material = getMaterial();
    const quantity = Math.max(1, Number.parseInt(state.quantity, 10) || 1);
    const factor = CONFIG.sizeFactors[state.size] || 1;
    const unit = material.base * factor;
    const base = unit * quantity;
    const discountRate = getDiscountRate(quantity);
    const discount = base * discountRate;
    const couponDiscount = getCouponDiscount(Math.max(0, base - discount));
    const cutFee = quantity * (CONFIG.cutFees[state.cut] || 0);
    const designFee = state.design === 'needed' ? CONFIG.designFee : 0;
    const rushFee = state.rush === 'rush' ? CONFIG.rushFee : 0;
    const shipping = quantity >= CONFIG.freeShippingQuantity ? 0 : CONFIG.shippingFee;
    const total = Math.max(0, base - discount - couponDiscount + cutFee + designFee + rushFee + shipping);
    return { material, quantity, factor, unit, base, discountRate, discount, couponDiscount, cutFee, designFee, rushFee, shipping, total };
  };

  const setSelected = (selector, attribute, value) => {
    $$(selector).forEach((element) => element.classList.toggle('is-selected', element.dataset[attribute] === String(value)));
  };

  const renderSummary = () => {
    const calc = calculate();
    state.lastCalculation = calc;
    const summarySpecs = `${state.size} سم • ${state.cut === 'full' ? 'قص كامل' : 'تشريح الشيت'}${calc.material.finish ? ` • ${calc.material.finish}` : ''}`;
    $('#summaryMaterialMark').textContent = calc.material.short;
    $('#summaryMaterial').textContent = calc.material.label;
    $('#summarySpecs').textContent = summarySpecs;
    $('#summaryQuantity').textContent = `${integer(calc.quantity)} ستيكر`;
    $('#summaryUnit').textContent = money(calc.unit);
    $('#summaryBase').textContent = money(calc.base);
    $('#summaryDiscountRate').textContent = `${Math.round(calc.discountRate * 100)}%`;
    $('#summaryDiscount').textContent = `−${money(calc.discount).replace(' ج', ' ج')}`;
    $('#summaryCouponRow').hidden = !state.coupon || calc.couponDiscount <= 0;
    $('#summaryCouponLabel').textContent = state.coupon ? state.coupon.code : '—';
    $('#summaryCoupon').textContent = `−${money(calc.couponDiscount)}`;
    $('#summaryCutRow').hidden = state.cut !== 'full';
    $('#summaryCut').textContent = `+${money(calc.cutFee)}`;
    $('#summaryDesignRow').hidden = state.design !== 'needed';
    $('#summaryDesign').textContent = `+${money(calc.designFee)}`;
    $('#summaryRushRow').hidden = state.rush !== 'rush';
    $('#summaryRush').textContent = `+${money(calc.rushFee)}`;
    $('#summaryShipping').textContent = calc.shipping === 0 ? 'مجاني' : money(calc.shipping);
    $('#summaryTotal').innerHTML = `${calc.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>جنيه</small>`;
    $('#discountLabel').textContent = `${Math.round(calc.discountRate * 100)}%`;
    $('#discountFill').style.width = `${getDiscountProgress(calc.quantity)}%`;
    $('#shippingBanner').classList.toggle('is-free', calc.shipping === 0);
    $('#shippingBanner').querySelector('strong').textContent = calc.shipping === 0 ? 'الشحن مجاني لطلبك' : 'الشحن يصبح مجاناً';
    $('#shippingBanner').querySelector('small').textContent = calc.shipping === 0 ? 'وصلت إلى 5,000 ستيكر أو أكثر' : 'عند 5,000 ستيكر أو أكثر';
    $('#sizeHelper').textContent = state.size === 4 ? '4 سم — المقاس الأكثر طلباً' : `${state.size} سم — معامل السعر ${calc.factor.toFixed(2)}×`;
    const explanation = getMaterialExplanation(state.material);
    $('#materialExplainerTitle').textContent = explanation.title;
    $('#materialExplainerText').textContent = explanation.text;
  };

  const updateMaterial = (material) => {
    state.material = material;
    setSelected('.material-card', 'material', material);
    $('#vinylOptions').hidden = material !== 'vinyl';
    renderSummary();
  };

  const applyCoupon = () => {
    const input = $('#couponCode');
    const feedback = $('#couponFeedback');
    const code = input.value.trim().toUpperCase();
    const coupon = CONFIG.coupons[code];
    if (!code) {
      state.coupon = null;
      feedback.textContent = 'اكتب كود الكوبون أولاً';
      feedback.className = 'coupon-feedback is-error';
    } else if (!coupon) {
      state.coupon = null;
      feedback.textContent = 'الكود غير صحيح أو انتهت صلاحيته';
      feedback.className = 'coupon-feedback is-error';
    } else {
      state.coupon = { code };
      feedback.textContent = `تم تطبيق خصم ${coupon.label}`;
      feedback.className = 'coupon-feedback is-success';
      showToast('تم تطبيق الكوبون على ملخص الطلب');
    }
    renderSummary();
  };

  const updateVinyl = (finish) => {
    state.vinylFinish = finish;
    setSelected('[data-vinyl]', 'vinyl', finish);
    renderSummary();
  };

  const attachChoiceGroup = (selector, key, onChange) => {
    $$(selector).forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset[key];
        state[key] = key === 'size' ? Number(value) : value;
        setSelected(selector, key, value);
        onChange?.(value);
        renderSummary();
      });
    });
  };

  const renderFiles = () => {
    const list = $('#fileList');
    list.innerHTML = state.files.map((file) => `<div class="file-item"><span>${file.name}</span><span>${file.size}</span></div>`).join('');
  };

  const addFiles = (files) => {
    const incoming = [...files];
    const remaining = CONFIG.maxFiles - state.files.length;
    if (incoming.length > remaining) showToast(`الحد الأقصى ${CONFIG.maxFiles} ملفات لكل طلب`);
    incoming.slice(0, remaining).forEach((file) => {
      if (file.size > CONFIG.maxFileSizeMb * 1024 * 1024) {
        showToast(`${file.name} أكبر من ${CONFIG.maxFileSizeMb} MB`);
        return;
      }
      state.files.push({ name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(1)} MB` });
      state.rawFiles.push(file);
    });
    renderFiles();
  };

  const readCustomer = () => ({
    name: $('#customerName').value.trim(),
    phone: normalizeEgyptianPhone($('#customerPhone').value),
    governorate: $('#governorate').value,
    address: $('#address').value.trim()
  });

  const buildOrder = () => {
    const customer = readCustomer();
    const calc = state.lastCalculation || calculate();
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const orderId = `ST-${year}${month}-${Math.floor(1000 + Math.random() * 9000)}`;
    const customerCode = `C-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      orderId,
      customerCode,
      createdAt: now.toISOString(),
      customer,
      category: state.category || 'غير محدد',
      material: calc.material.label,
      materialKey: calc.material.key,
      vinylFinish: calc.material.finish || null,
      sizeCm: state.size,
      quantity: calc.quantity,
      cut: state.cut === 'full' ? 'قص كامل' : 'تشريح الشيت كما هو',
      design: state.design === 'needed' ? 'تصميم من ستيكراوي (+60 ج)' : 'التصميم جاهز',
      rush: state.rush === 'rush' ? 'مستعجل — نفس اليوم (+60 ج)' : 'عادي',
      files: state.files,
      fileLinks: [],
      pricing: {
        unit: calc.unit,
        base: calc.base,
        discountRate: calc.discountRate,
        discount: calc.discount,
        couponCode: state.coupon ? state.coupon.code : '',
        couponDiscount: calc.couponDiscount,
        cutFee: calc.cutFee,
        designFee: calc.designFee,
        rushFee: calc.rushFee,
        shipping: calc.shipping,
        total: calc.total
      },
      statusIndex: state.design === 'needed' ? 1 : 0,
      read: false,
      source: 'sticky-egypt-web'
    };
  };

  const orderText = (order) => {
    const p = order.pricing;
    return [
      'طلب جديد من ستيكراوي أسيوط',
      `رقم الطلب: ${order.orderId}`,
      `رقم العميل: ${order.customerCode}`,
      `الاسم: ${order.customer.name}`,
      `الموبايل: ${order.customer.phone}`,
      `المحافظة: ${order.customer.governorate || 'غير محدد'}`,
      `العنوان: ${order.customer.address || 'غير محدد'}`,
      `الفئة: ${order.category || 'غير محددة'}`,
      `الخامة: ${order.material}`,
      `المقاس: ${order.sizeCm} سم` ,
      `الكمية: ${integer(order.quantity)} ستيكر`,
      `القص: ${order.cut}`,
      `التصميم: ${order.design}`,
      `السرعة: ${order.rush}`,
      `الملفات: ${order.files.length ? order.files.map((file) => file.name).join('، ') : 'لا يوجد ملف مرفق'}`,
      `روابط Google Drive: ${order.fileLinks && order.fileLinks.length ? order.fileLinks.join(' | ') : 'تُضاف بعد تفعيل Apps Script'}`,
      `السعر قبل الخصم: ${money(p.base)}`,
      `الخصم: ${Math.round(p.discountRate * 100)}% — ${money(p.discount)}`,
      `كوبون الخصم: ${p.couponCode ? `${p.couponCode} — ${money(p.couponDiscount)}` : 'لا يوجد'}`,
      `الإضافات: ${money(p.cutFee + p.designFee + p.rushFee)}`,
      `الشحن: ${p.shipping === 0 ? 'مجاني' : money(p.shipping)}`,
      `الإجمالي التقريبي: ${money(p.total)}`
    ].join('\n');
  };

  const saveOrder = (order) => {
    localStorage.setItem('stickyLastOrder', JSON.stringify(order));
    const orders = JSON.parse(localStorage.getItem('stickyOrders') || '[]');
    orders.unshift(order);
    localStorage.setItem('stickyOrders', JSON.stringify(orders.slice(0, 20)));
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', base64: String(reader.result).split(',')[1] || '' });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const sendToIntegration = async (order) => {
    if (!CONFIG.gasWebAppUrl) {
      showToast('تم تجهيز الطلب محلياً — أضف رابط Apps Script للحفظ في Google Sheet');
      return null;
    }
    try {
      const files = await Promise.all(state.rawFiles.map(fileToBase64));
      const response = await fetch(CONFIG.gasWebAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'createOrder', order, files })
      });
      if (!response.ok) throw new Error(`Integration failed: ${response.status}`);
      const result = await response.json().catch(() => ({}));
      if (result.ok === false) throw new Error(result.error || 'Apps Script rejected the order');
      showToast('تم تسجيل الطلب في Google Sheet');
      return result;
    } catch (error) {
      console.warn(error);
      showToast('تم تجهيز الطلب محلياً — راجع إعداد رابط Apps Script');
      return null;
    }
  };

  const openOrderModal = (order) => {
    $('#modalOrderId').textContent = order.orderId;
    $('#orderPayload').value = orderText(order);
    $('#orderModal').hidden = false;
    document.body.classList.add('modal-open');
  };

  const closeOrderModal = () => {
    $('#orderModal').hidden = true;
    document.body.classList.remove('modal-open');
  };

  const validateCustomer = () => {
    const name = $('#customerName');
    const phone = $('#customerPhone');
    if (!name.value.trim()) { name.focus(); showToast('اكتب اسمك عشان نجهز الطلب'); return false; }
    phone.value = normalizeEgyptianPhone(phone.value);
    const phoneError = $('#customerPhoneError');
    if (!isValidEgyptianPhone(phone.value)) {
      phone.classList.add('is-invalid');
      phoneError.textContent = 'اكتب رقم موبايل مصري صحيح من 11 رقمًا يبدأ بـ 010 أو 011 أو 012 أو 015.';
      phone.focus();
      showToast('رقم الموبايل لازم يكون مصريًا ومكوّنًا من 11 رقمًا');
      return false;
    }
    phone.classList.remove('is-invalid');
    phoneError.textContent = '';
    return true;
  };

  const renderTracking = (order) => {
    const result = $('#trackingResult');
    const index = clamp(Number(order.statusIndex || 0), 0, CONFIG.stages.length - 1);
    const total = order.pricing && order.pricing.total !== undefined ? order.pricing.total : order.total;
    const timeline = CONFIG.stages.map((stage, stageIndex) => `<div class="track-step ${stageIndex < index ? 'done' : ''} ${stageIndex === index ? 'active' : ''}"><i>${stageIndex < index ? '✓' : stageIndex + 1}</i><span>${stage}</span></div>`).join('');
    result.innerHTML = `<div class="track-header"><strong>${order.orderId}</strong><span>${CONFIG.stages[index]}</span></div><div class="track-meta"><span>العميل: ${order.customerCode}</span><span>${order.material}</span><span>${integer(order.quantity)} ستيكر</span><span>الإجمالي: ${money(total)}</span></div><div class="track-timeline">${timeline}</div>`;
    result.hidden = false;
  };

  const lookupRemoteTracking = async (customerCode, orderId) => {
    if (!CONFIG.gasWebAppUrl) return null;
    try {
      const url = `${CONFIG.gasWebAppUrl}?action=track&customer=${encodeURIComponent(customerCode)}&order=${encodeURIComponent(orderId)}`;
      const response = await fetch(url);
      const data = await response.json();
      return data && data.ok ? data : null;
    } catch (error) {
      console.warn(error);
      return null;
    }
  };

  const handleTracking = async (event) => {
    event.preventDefault();
    const customerCode = $('#trackingCustomer').value.trim().toUpperCase();
    const orderId = $('#trackingOrder').value.trim().toUpperCase();
    const saved = JSON.parse(localStorage.getItem('stickyLastOrder') || 'null');
    if (saved && saved.customerCode === customerCode && saved.orderId === orderId) {
      renderTracking(saved);
      return;
    }
    if (!customerCode || !orderId) { showToast('اكتب رقم العميل ورقم الطلب أولاً'); return; }
    const remote = await lookupRemoteTracking(customerCode, orderId);
    if (remote) {
      renderTracking(remote);
      return;
    }
    const demoOrder = { orderId, customerCode, material: 'ستيكر TC', quantity: 500, pricing: { total: 297.5 }, statusIndex: 2 };
    renderTracking(demoOrder);
    showToast('تم عرض حالة تجريبية — اربط Google Sheet للبيانات الحقيقية');
  };

  const initTheme = () => {
    const stored = localStorage.getItem('stickyTheme');
    if (stored === 'dark') document.body.classList.add('dark-theme');
    $('#themeToggle').textContent = document.body.classList.contains('dark-theme') ? '☾' : '☼';
    $('#themeToggle').addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const dark = document.body.classList.contains('dark-theme');
      localStorage.setItem('stickyTheme', dark ? 'dark' : 'light');
      $('#themeToggle').textContent = dark ? '☾' : '☼';
    });
  };

  const initScrollNav = () => {
    const header = $('.site-header');
    let idleTimer;
    const showNav = () => {
      header.classList.add('nav-visible');
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => header.classList.remove('nav-visible'), 1300);
    };
    window.addEventListener('scroll', showNav, { passive: true });
    window.addEventListener('wheel', showNav, { passive: true });
    window.addEventListener('touchmove', showNav, { passive: true });
    header.addEventListener('mouseenter', showNav);
    showNav();
  };

  const initMobileSummary = () => {
    const orderSection = $('#order');
    if (!orderSection) return;
    const media = window.matchMedia('(max-width: 800px)');
    const updateVisibility = () => {
      const rect = orderSection.getBoundingClientRect();
      const pageTop = window.scrollY + rect.top;
      const pageBottom = pageTop + orderSection.offsetHeight;
      const viewportTop = window.scrollY;
      const viewportBottom = viewportTop + window.innerHeight;
      const active = viewportBottom >= pageTop + 90 && viewportTop <= pageBottom - 90;
      document.body.classList.toggle('mobile-order-active', media.matches && active);
    };
    let frame = 0;
    const scheduleVisibilityUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateVisibility);
    };
    window.addEventListener('scroll', scheduleVisibilityUpdate, { passive: true });
    window.addEventListener('resize', scheduleVisibilityUpdate, { passive: true });
    scheduleVisibilityUpdate();
    const handleViewportChange = () => {
      if (!media.matches) {
        document.body.classList.remove('mobile-order-active');
        $('#summaryCard').classList.remove('is-expanded');
      } else scheduleVisibilityUpdate();
    };
    media.addEventListener?.('change', handleViewportChange);
  };

  const init = () => {
    const configured = window.STICKY_CONFIG || {};
    Object.assign(CONFIG, configured);
    if (configured.materials) CONFIG.materials = Object.assign(CONFIG.materials, configured.materials);
    const categoryFromUrl = new URLSearchParams(window.location.search).get('category');
    if (categoryFromUrl) {
      state.category = categoryFromUrl;
      const categoryNote = $('#stickerCategoryNote');
      if (categoryNote) categoryNote.textContent = `اختارت ${categoryFromUrl}. ابدأ الحساب وحدد الخامة والمقاس والكمية المناسبة.`;
    }
    $('#languageLink').href = CONFIG.languageUrl;
    initTheme();
    initScrollNav();
    initMobileSummary();
    $('#materialOptions').addEventListener('click', (event) => {
      const button = event.target.closest('[data-material]');
      if (button) updateMaterial(button.dataset.material);
    });
    $('#vinylOptions').addEventListener('click', (event) => {
      const button = event.target.closest('[data-vinyl]');
      if (button) updateVinyl(button.dataset.vinyl);
    });
    attachChoiceGroup('[data-size]', 'size');
    attachChoiceGroup('[data-cut]', 'cut');
    attachChoiceGroup('[data-design]', 'design');
    attachChoiceGroup('[data-rush]', 'rush');
    $('#customerPhone').addEventListener('input', (event) => {
      const phone = event.target;
      phone.value = normalizeEgyptianPhone(phone.value);
      if (isValidEgyptianPhone(phone.value)) {
        phone.classList.remove('is-invalid');
        $('#customerPhoneError').textContent = '';
      }
    });
    $$('[data-sticker-choice]').forEach((element) => element.addEventListener('click', () => {
      const category = element.dataset.stickerChoice;
      const note = $('#stickerCategoryNote');
      if (category) state.category = category;
      if (note && category) note.textContent = `اختارت ${category}. ابدأ الحساب وحدد الخامة والمقاس والكمية المناسبة.`;
    }));
    $('#summaryToggle').addEventListener('click', () => {
      const summary = $('#summaryCard');
      const expanded = summary.classList.toggle('is-expanded');
      $('#summaryToggle').setAttribute('aria-expanded', String(expanded));
      $('#summaryToggle').firstChild.textContent = expanded ? 'إخفاء تفاصيل الطلب ' : 'عرض تفاصيل الطلب ';
    });
    $$('[data-quantity]').forEach((button) => button.addEventListener('click', () => {
      state.quantity = Math.max(1, Number(button.dataset.quantity));
      $('#quantity').value = state.quantity;
      renderSummary();
    }));
    $('#quantity').addEventListener('input', (event) => { state.quantity = Math.max(1, Number(event.target.value) || 1); renderSummary(); });
    $('#applyCoupon').addEventListener('click', applyCoupon);
    $('#couponCode').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); applyCoupon(); } });
    $('#designFiles').addEventListener('change', (event) => addFiles(event.target.files));
    const dropzone = $('.dropzone');
    ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
    ['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
    dropzone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
    $('#prepareOrder').addEventListener('click', async () => {
      if (!validateCustomer()) return;
      const order = buildOrder();
      const integrationResult = await sendToIntegration(order);
      if (integrationResult && Array.isArray(integrationResult.fileLinks)) order.fileLinks = integrationResult.fileLinks;
      $('#modalNote').textContent = integrationResult
        ? 'تم حفظ الطلب وملفاته في Google Sheet وDrive. افتح واتساب لإرسال الرسالة الجاهزة.'
        : CONFIG.gasWebAppUrl
          ? 'تم تجهيز الرسالة محلياً، لكن تعذر الحفظ الخارجي. راجع رابط Apps Script ثم أعد المحاولة.'
          : 'الوضع التجريبي: أضف رابط Apps Script لحفظ الطلب والملفات في Google Sheet وDrive.';
      saveOrder(order);
      $('#trackingCustomer').value = order.customerCode;
      $('#trackingOrder').value = order.orderId;
      openOrderModal(order);
    });
    $('#closeModal').addEventListener('click', closeOrderModal);
    $('#orderModal').addEventListener('click', (event) => { if (event.target.id === 'orderModal') closeOrderModal(); });
    $('#copyPayload').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#orderPayload').value); showToast('تم نسخ رسالة الطلب'); } catch { $('#orderPayload').select(); document.execCommand('copy'); showToast('تم نسخ رسالة الطلب'); }
    });
    $('#openWhatsapp').addEventListener('click', () => {
      const text = encodeURIComponent($('#orderPayload').value);
      window.open(`https://wa.me/${String(CONFIG.whatsappNumber).replace(/\D/g, '')}?text=${text}`, '_blank', 'noopener');
    });
    $('#trackingForm').addEventListener('submit', handleTracking);
    $('#resetOrder').addEventListener('click', () => { $('#order').scrollIntoView({ behavior: 'smooth' }); showToast('عدّل أي اختيار، والسعر سيتحدث تلقائياً'); });
    $('#summaryJump').addEventListener('click', () => { $('#summaryCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    renderSummary();
  };

  document.addEventListener('DOMContentLoaded', init);
})();

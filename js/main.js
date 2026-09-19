/**
 * الجدار الآمن للأنظمة الإلكترونية
 * Main Website JavaScript Logic with Live Database Sync
 */
// XSS Protection Helper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
  // Load dynamic data from Backend API (if available) or fallback to SITE_CONFIG
  await initDynamicData();

  // Sticky Header Scroll Effect
  initHeaderScroll();

  // Mobile Menu Toggle
  initMobileMenu();

  // Lightbox
  initLightbox();

  // Smart Quote Form with DB Persistence & WhatsApp Dispatch
  initQuoteForm();

  // FAQ Accordion
  initFaqAccordion();

  // ScrollSpy
  initScrollSpy();

  // Dynamic Year
  const yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});

// ==========================================================================
// 1. DATA SYNC (BACKEND API OR SITE_CONFIG)
// ==========================================================================

async function initDynamicData() {
  let masterData = null;

  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        masterData = json.data;
      }
    }
  } catch (err) {
    // Backend not running; fallback gracefully
  }

  // Populate Company Info
  const company = masterData?.companyInfo || (typeof SITE_CONFIG !== 'undefined' ? {
    companyName: SITE_CONFIG.companyName,
    companyShortName: SITE_CONFIG.companyShortName,
    phone: SITE_CONFIG.phoneFormatted,
    phoneRaw: SITE_CONFIG.phoneRaw,
    whatsapp: SITE_CONFIG.whatsappDisplay,
    whatsappNumber: SITE_CONFIG.whatsappNumber,
    address: SITE_CONFIG.address,
    workingHours: SITE_CONFIG.workingHours,
    socialLinks: SITE_CONFIG.socialLinks
  } : null);

  if (company) {
    // Phone
    document.querySelectorAll('[data-config="phone"]').forEach(el => {
      el.textContent = company.phone || company.phoneDisplay;
      if (el.tagName === 'A') el.href = `tel:${company.phoneRaw || company.phone}`;
    });

    // WhatsApp
    document.querySelectorAll('[data-config="whatsapp"]').forEach(el => {
      el.textContent = company.whatsapp || company.whatsappDisplay || company.phone;
      if (el.tagName === 'A') {
        const num = company.whatsappNumber || '962790000000';
        el.href = `https://wa.me/${num}?text=${encodeURIComponent('السلام عليكم، أود الاستفسار عن خدمات الجدار الآمن للأنظمة الإلكترونية')}`;
      }
    });

    // Company Logo
    const logoUrl = company.logo || company.logoUrl;
    if (logoUrl) {
      document.querySelectorAll('.brand-icon-wrap').forEach(wrap => {
        wrap.innerHTML = `<img src="${logoUrl}" alt="${company.companyName || 'شعار المؤسسة'}" style="max-height: 38px; max-width: 44px; object-fit: contain;">`;
      });
    }

    // Working Hours
    document.querySelectorAll('[data-config="hours"]').forEach(el => {
      el.textContent = company.workingHours;
    });

    // Address
    document.querySelectorAll('[data-config="address"]').forEach(el => {
      el.textContent = company.address;
    });

    // Social Links
    if (company.socialLinks) {
      document.querySelectorAll('[data-social="twitter"]').forEach(el => el.href = company.socialLinks.twitter || '#');
      document.querySelectorAll('[data-social="linkedin"]').forEach(el => el.href = company.socialLinks.linkedin || '#');
      document.querySelectorAll('[data-social="instagram"]').forEach(el => el.href = company.socialLinks.instagram || '#');
      document.querySelectorAll('[data-social="facebook"]').forEach(el => el.href = company.socialLinks.facebook || '#');
    }
  }

  // Populate Hero Texts (if returned from database)
  if (masterData?.hero) {
    const h = masterData.hero;
    const heroTitle = document.querySelector('.hero-title');
    const heroDesc = document.querySelector('.hero-description');
    const heroBadge = document.querySelector('.hero-company-tag span');

    if (h.title && heroTitle) heroTitle.innerHTML = escapeHtml(h.title).replace(/\n/g, '<br>');
    if (h.description && heroDesc) heroDesc.textContent = h.description;
    if (h.badge && heroBadge) heroBadge.textContent = h.badge;
  }

  // Render Projects Grid (filtered by visibility)
  const projects = masterData?.projects || (typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG.portfolioProjects : []);
  renderPortfolioProjects(projects);

  // Render FAQs
  const faqs = masterData?.faqs || [
    {
      question: 'هل تقدمون خدمات المعاينة الميدانية قبل تقديم عرض السعر؟',
      answer: 'نعم، نوفر زيارات ميدانية لمعاينة الموقع بدقة، وتحديد زوايا الكاميرات والنقاط الحيوية ودراسة شبكة التمديدات لتقديم عرض سعر دقيق ومفصل.'
    },
    {
      question: 'هل الأجهزة والأنظمة لديكم معتمدة ومطابقة لاشتراطات الدفاع المدني؟',
      answer: 'كافة أنظمة ومعدات إنذار ومكافحة الحريق التي نقوم بتوريدها وتركيبها معتمدة ومطابقة لأعلى المواصفات القياسية واشتراطات الدفاع المدني الرسمية.'
    },
    {
      question: 'هل يمكنني متابعة كاميرات المراقبة عن بُعد من الهاتف الذكي؟',
      answer: 'بالتأكيد، نقوم بتهيئة وتفعيل تطبيقات الجوال الرسمية لأنظمة المراقبة (iOS و Android) لمتابعة البث المباشر والتسجيلات من أي مكان في العالم مجاناً.'
    },
    {
      question: 'ما هي فترات الضمان وخدمات ما بعد البيع المتوفرة؟',
      answer: 'نقدم ضماناً شاملاً على الأجهزة والتركيبات، بالإضافة إلى خيارات عقود الصيانة الدورية والدعم الفني السريع لضمان عمل كافة الأنظمة بأقصى كفاءة.'
    }
  ];
  renderFaqAccordion(faqs);
}

// ==========================================================================
// 2. PORTFOLIO RENDERING & FILTERING
// ==========================================================================

function renderPortfolioProjects(projects) {
  const portfolioGrid = document.getElementById('portfolioGrid');
  if (!portfolioGrid) return;

  portfolioGrid.innerHTML = '';
  const visibleProjects = projects.filter(p => p.visible !== false);

  visibleProjects.forEach(item => {
    const article = document.createElement('div');
    article.className = 'portfolio-item';
    article.setAttribute('data-category', item.category);
    const safeTitle = escapeHtml(item.title);
    const safeDesc = escapeHtml(item.desc || item.description || '');
    const safeCat = escapeHtml(item.service || item.categoryName || item.category || '');
    const safeImg = encodeURI(item.image || '');
    const safeAlt = escapeHtml(item.altText || item.title || '');

    article.innerHTML = `
      <div class="portfolio-image-wrap">
        <img src="${safeImg}" alt="${safeAlt}" loading="lazy">
        <div class="portfolio-overlay">
          <span class="portfolio-category-tag">${safeCat}</span>
          <h3 class="portfolio-title">${safeTitle}</h3>
          <p class="portfolio-desc">${safeDesc}</p>
        </div>
        <div class="portfolio-zoom-btn" aria-label="عرض الصورة بحجم أكبر">
          <i class="fa-solid fa-expand"></i>
        </div>
      </div>
    `;

    article.addEventListener('click', () => {
      openLightbox(item.image, item.title, item.service || item.categoryName || item.category);
    });

    portfolioGrid.appendChild(article);
  });

  initPortfolioFilters();
}

function initPortfolioFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.onclick = () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');
      const items = document.querySelectorAll('.portfolio-item');

      items.forEach(item => {
        const category = item.getAttribute('data-category');
        if (filterValue === 'all' || category === filterValue) {
          item.style.display = 'block';
          setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
          }, 50);
        } else {
          item.style.opacity = '0';
          item.style.transform = 'translateY(15px)';
          setTimeout(() => {
            item.style.display = 'none';
          }, 250);
        }
      });
    };
  });
}

// ==========================================================================
// 3. FAQS ACCORDION
// ==========================================================================

function renderFaqAccordion(faqs) {
  const container = document.getElementById('faqAccordionContainer');
  if (!container) return;

  container.innerHTML = '';
  faqs.forEach((faq, index) => {
    const item = document.createElement('div');
    item.className = `faq-item ${index === 0 ? 'open' : ''}`;
    const safeQ = escapeHtml(faq.question);
    const safeA = escapeHtml(faq.answer);
    item.innerHTML = `
      <button class="faq-question" type="button" aria-expanded="${index === 0}">
        <span>${safeQ}</span>
        <span class="faq-icon-toggle"><i class="fa-solid fa-chevron-down"></i></span>
      </button>
      <div class="faq-answer">
        <p>${safeA}</p>
      </div>
    `;

    const questionBtn = item.querySelector('.faq-question');
    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(el => {
        el.classList.remove('open');
        el.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('open');
        questionBtn.setAttribute('aria-expanded', 'true');
      }
    });

    container.appendChild(item);
  });
}

function initFaqAccordion() {
  // Handled dynamically by renderFaqAccordion
}

// ==========================================================================
// 4. SMART QUOTE FORM (SAVES TO DATABASE & SENDS TO WHATSAPP)
// ==========================================================================

function initQuoteForm() {
  const quoteForm = document.getElementById('quoteForm');
  const toastNotice = document.getElementById('toastNotice');

  if (!quoteForm) return;

  quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('quoteName')?.value.trim();
    const phone = document.getElementById('quotePhone')?.value.trim();
    const service = document.getElementById('quoteService')?.value;
    const location = document.getElementById('quoteLocation')?.value.trim();
    const details = document.getElementById('quoteDetails')?.value.trim();
    const inspectionEl = document.querySelector('input[name="inspection"]:checked');
    const inspection = inspectionEl ? inspectionEl.value : 'نعم';

    if (!name || !phone || !service) {
      alert('يرجى ملء الحقول الإلزامية (الاسم الكريم، رقم الهاتف، والخدمة المطلوبة).');
      return;
    }

    const quoteData = {
      name,
      phone,
      service,
      location: location || 'غير محدد',
      inspection,
      details: details || ''
    };

    // 1. Send asynchronously to Backend Database so it appears in Admin Dashboard
    try {
      fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData)
      }).catch(() => {});
    } catch (err) {}

    // 2. Also save to local storage so admin can see it even offline
    try {
      const cached = localStorage.getItem('cachedAdminData');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.quotes = parsed.quotes || [];
        parsed.quotes.unshift({
          id: 'quote-' + Date.now(),
          ...quoteData,
          status: 'جديد',
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('cachedAdminData', JSON.stringify(parsed));
      }
    } catch (e) {}

    // 3. Format structured message for WhatsApp
    const waMessage = 
      `*طلب عرض سعر جديد - الجدار الآمن للأنظمة الإلكترونية*\n\n` +
      `• *الاسم الكريم:* ${name}\n` +
      `• *رقم الهاتف:* ${phone}\n` +
      `• *الخدمة المطلوبة:* ${service}\n` +
      `• *طلب معاينة للموقع:* ${inspection}\n` +
      (location ? `• *موقع المشروع:* ${location}\n` : '') +
      (details ? `• *تفاصيل الطلب:* ${details}\n` : '');

    // Show Toast
    if (toastNotice) {
      toastNotice.classList.add('show');
      setTimeout(() => { toastNotice.classList.remove('show'); }, 5000);
    }

    quoteForm.reset();

    // 4. Open WhatsApp directly with the filled quote details
    const targetPhone = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.whatsappNumber) 
      ? SITE_CONFIG.whatsappNumber 
      : '966500000000';

    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(waMessage)}`;
    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 700);
  });
}

// ==========================================================================
// 5. LIGHTBOX & MODALS
// ==========================================================================

const lightboxModal = document.getElementById('lightboxModal');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxCategory = document.getElementById('lightboxCategory');

function openLightbox(src, title, category) {
  if (!lightboxModal || !lightboxImg) return;
  lightboxImg.src = src;
  lightboxImg.alt = title;
  if (lightboxTitle) lightboxTitle.textContent = title;
  if (lightboxCategory) lightboxCategory.textContent = category;

  lightboxModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  if (!lightboxModal) return;
  lightboxModal.classList.remove('active');
  document.body.style.overflow = '';
}

function initLightbox() {
  if (lightboxClose && lightboxModal) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

// ==========================================================================
// 6. UI UTILITIES
// ==========================================================================

function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (window.scrollY > 30) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initMobileMenu() {
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu.classList.toggle('open');
      mobileToggle.innerHTML = isOpen 
        ? '<i class="fa-solid fa-xmark"></i>' 
        : '<i class="fa-solid fa-bars"></i>';
      mobileToggle.setAttribute('aria-expanded', isOpen);
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        navMenu.classList.remove('open');
        mobileToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const scrollSpy = () => {
    const scrollY = window.pageYOffset;
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 140;
      const sectionId = current.getAttribute('id');
      const matchingLink = document.querySelector(`.nav-link[href*="${sectionId}"]`);

      if (matchingLink) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          matchingLink.classList.add('active');
        } else {
          matchingLink.classList.remove('active');
        }
      }
    });
  };
  window.addEventListener('scroll', scrollSpy, { passive: true });
}

/**
 * الجدار الآمن للأنظمة الإلكترونية
 * Master Admin Dashboard JavaScript Logic
 */

// --- Authentication Guard (Server-Verified with HttpOnly Cookies) ---
let currentAdminUser = null;

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) {
      window.location.href = 'login.html';
      return false;
    }
    const data = await res.json();
    if (data.authenticated && data.user) {
      currentAdminUser = data.user;
      return true;
    }
    window.location.href = 'login.html';
    return false;
  } catch (err) {
    return true; // Fallback to offline cache if server disconnected
  }
}

// Global Application State
let appData = {
  companyInfo: {},
  hero: {},
  services: [],
  projects: [],
  faqs: [],
  quotes: [],
  employees: [],
  nfcCards: [],
  reviews: []
};

let isBackendAvailable = false;

document.addEventListener('DOMContentLoaded', async () => {
  // Check Authentication with server
  await checkAuth();

  // Setup Tab Navigation
  initTabs();

  // Setup Mobile Sidebar
  initMobileSidebar();

  // Setup Logout
  initLogout();

  // Load Data
  await fetchMasterData();

  // Setup Image Drag & Drop
  initImageUploader();
  initLogoUploader();
  initEmpPhotoUploader();

  // Setup Forms
  initForms();

  // Setup Security & Account Tab
  initSecurityTab();
});

// ==========================================================================
// DATA FETCHING & SYNCHRONIZATION
// ==========================================================================

async function fetchMasterData() {
  try {
    const response = await fetch('/api/data', {
      credentials: 'include'
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        appData = result.data;
        isBackendAvailable = true;
        localStorage.setItem('cachedAdminData', JSON.stringify(appData));
        renderAllPanes();
        return;
      }
    }
  } catch (err) {
    console.warn('Backend server not connected. Falling back to local/cached data.');
  }

  // Fallback to local storage cache or defaults
  const cached = localStorage.getItem('cachedAdminData');
  if (cached) {
    try {
      appData = JSON.parse(cached);
    } catch (e) {
      console.error(e);
    }
  }
  renderAllPanes();
}

function renderAllPanes() {
  renderDashboardStats();
  renderProjectsTable();
  renderServicesTable();
  populateCompanyForm();
  populateHeroForm();
  renderFaqsTable();
  renderQuotesTable();
  renderNfcStats();
  renderCardsTable();
  renderEmployeesTable();
  renderReviewsTable();
}

// ==========================================================================
// 1. DASHBOARD STATS
// ==========================================================================

function renderDashboardStats() {
  const projects = appData.projects || [];
  const services = appData.services || [];
  const quotes = appData.quotes || [];
  const newQuotes = quotes.filter(q => q.status === 'جديد').length;

  document.getElementById('statProjectsCount').textContent = projects.length;
  document.getElementById('statServicesCount').textContent = services.length;
  document.getElementById('statQuotesCount').textContent = quotes.length;
  document.getElementById('statNewQuotesCount').textContent = newQuotes;
  document.getElementById('sidebarQuotesBadge').textContent = newQuotes;

  // Recent Quotes Table (first 5)
  const recentQuotesBody = document.getElementById('recentQuotesTableBody');
  recentQuotesBody.innerHTML = '';
  const recentQuotes = quotes.slice(0, 5);

  if (recentQuotes.length === 0) {
    recentQuotesBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--adm-text-muted); padding: 2rem;">لا توجد طلبات عروض أسعار حتى الآن</td></tr>`;
  } else {
    recentQuotes.forEach(q => {
      const tr = document.createElement('tr');
      const dateStr = q.createdAt ? new Date(q.createdAt).toLocaleDateString('ar-SA') : '-';
      const safeName = escapeHtml(q.name);
      const safePhone = escapeHtml(q.phone);
      const safeService = escapeHtml(q.service);
      const safeLocation = escapeHtml(q.location || '-');
      const safeWaNum = encodeURIComponent(String(q.phone || '').replace(/[^0-9]/g, ''));

      tr.innerHTML = `
        <td><strong>${safeName}</strong></td>
        <td>
          <a href="tel:${safePhone}" style="color: var(--adm-accent);" dir="ltr">${safePhone}</a>
        </td>
        <td>${safeService}</td>
        <td>${safeLocation}</td>
        <td>${q.inspection === 'نعم' ? '<span style="color: #34d399;">نعم</span>' : 'لا'}</td>
        <td><small style="color: var(--adm-text-muted);">${dateStr}</small></td>
        <td>${getStatusBadge(q.status)}</td>
        <td>
          <div class="action-buttons">
            <a href="https://wa.me/${safeWaNum}" target="_blank" class="btn-adm btn-adm-secondary btn-adm-sm" title="واتساب">
              <i class="fa-brands fa-whatsapp" style="color: #25d366;"></i>
            </a>
            <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="switchTab('quotes')">تفاصيل</button>
          </div>
        </td>
      `;
      recentQuotesBody.appendChild(tr);
    });
  }

  // Recent Projects Table (first 5)
  const recentProjectsBody = document.getElementById('recentProjectsTableBody');
  recentProjectsBody.innerHTML = '';
  const recentProjects = projects.slice(0, 5);

  if (recentProjects.length === 0) {
    recentProjectsBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--adm-text-muted); padding: 2rem;">لا توجد مشاريع مضافة حتى الآن</td></tr>`;
  } else {
    recentProjects.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${escapeHtml(p.image)}" class="table-thumb" alt="${escapeHtml(p.title)}"></td>
        <td><strong>${escapeHtml(p.title)}</strong></td>
        <td>${escapeHtml(p.service || p.category)}</td>
        <td>${escapeHtml(p.sector || '-')}</td>
        <td>${p.visible ? '<span class="status-badge completed">ظاهر</span>' : '<span class="status-badge cancelled">مخفي</span>'}</td>
        <td>
          <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="openEditProjectModal('${escapeHtml(p.id)}')">
            <i class="fa-solid fa-pen-to-square"></i> تعديل
          </button>
        </td>
      `;
      recentProjectsBody.appendChild(tr);
    });
  }
}

// ==========================================================================
// 2. PROJECTS & WORKS MANAGEMENT
// ==========================================================================

function renderProjectsTable() {
  const tbody = document.getElementById('projectsTableBody');
  tbody.innerHTML = '';
  const projects = appData.projects || [];

  if (projects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--adm-text-muted); padding: 2.5rem;">لا توجد مشاريع بعد. اضغط "إضافة مشروع جديد" للبدء.</td></tr>`;
    return;
  }

  projects.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${escapeHtml(p.image)}" class="table-thumb" alt="${escapeHtml(p.title)}"></td>
      <td><strong>${escapeHtml(p.title)}</strong></td>
      <td><span class="status-badge new">${escapeHtml(p.service)}</span></td>
      <td>${escapeHtml(p.sector || '-')}</td>
      <td style="max-width: 250px; font-size: 0.85rem; color: var(--adm-text-muted);">${escapeHtml(p.desc || '-')}</td>
      <td>
        <button class="btn-adm btn-adm-sm ${p.visible ? 'btn-adm-secondary' : 'btn-adm-danger'}" onclick="toggleProjectVisibility('${escapeHtml(p.id)}')">
          ${p.visible ? '<i class="fa-solid fa-eye"></i> ظاهر' : '<i class="fa-solid fa-eye-slash"></i> مخفي'}
        </button>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="openEditProjectModal('${escapeHtml(p.id)}')" title="تعديل">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-adm btn-adm-danger btn-adm-sm" onclick="deleteProject('${escapeHtml(p.id)}')" title="حذف">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddProjectModal() {
  document.getElementById('projectModalTitle').textContent = 'إضافة مشروع جديد';
  document.getElementById('projectForm').reset();
  document.getElementById('projectEditId').value = '';
  document.getElementById('projFinalImageUrl').value = '';
  removeSelectedProjImage();
  document.getElementById('projectModal').classList.add('show');
}

function openEditProjectModal(id) {
  const p = (appData.projects || []).find(item => item.id === id);
  if (!p) return;

  document.getElementById('projectModalTitle').textContent = 'تعديل المشروع';
  document.getElementById('projectEditId').value = p.id;
  document.getElementById('projTitle').value = p.title || '';
  document.getElementById('projService').value = p.service || 'كاميرات المراقبة';
  document.getElementById('projSector').value = p.sector || 'المشاريع والمنشآت المختلفة';
  document.getElementById('projDesc').value = p.desc || '';
  document.getElementById('projAltText').value = p.altText || '';
  document.getElementById('projVisible').value = p.visible ? 'true' : 'false';

  // Set existing image
  document.getElementById('projFinalImageUrl').value = p.image || '';
  if (p.image) {
    document.getElementById('projPreviewImg').src = p.image;
    document.getElementById('projPreviewName').textContent = p.title;
    document.getElementById('projPreviewSize').textContent = 'صورة حالية';
    document.getElementById('projPreviewBox').style.display = 'flex';
  }

  document.getElementById('projectModal').classList.add('show');
}

function closeProjectModal() {
  document.getElementById('projectModal').classList.remove('show');
}

async function toggleProjectVisibility(id) {
  const p = (appData.projects || []).find(item => item.id === id);
  if (!p) return;

  const newVis = !p.visible;
  p.visible = newVis;

  if (isBackendAvailable) {
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: newVis })
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderProjectsTable();
  renderDashboardStats();
  showToast(`تم ${newVis ? 'إظهار' : 'إخفاء'} المشروع بنجاح!`);
}

async function deleteProject(id) {
  if (!confirm('هل أنت متأكد من حذف هذا المشروع نهائياً؟')) return;

  appData.projects = (appData.projects || []).filter(p => p.id !== id);

  if (isBackendAvailable) {
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderProjectsTable();
  renderDashboardStats();
  showToast('تم حذف المشروع بنجاح!');
}

// ==========================================================================
// 3. IMAGE UPLOAD & CANVAS CLIENT-SIDE COMPRESSION
// ==========================================================================

function initImageUploader() {
  const dropzone = document.getElementById('projDropzone');
  const fileInput = document.getElementById('projImageFile');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleImageSelection(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleImageSelection(fileInput.files[0]);
    }
  });
}

async function handleImageSelection(file) {
  if (!file.type.startsWith('image/')) {
    alert('يرجى اختيار ملف صورة صالح.');
    return;
  }

  // Compress using HTML5 Canvas to ensure super fast site performance
  const compressedDataUrl = await compressImageClientSide(file, 1400, 0.82);

  // If backend is active, also upload to /api/upload
  if (isBackendAvailable) {
    try {
      const formData = new FormData();
      // Convert dataURL to blob
      const blob = dataURItoBlob(compressedDataUrl);
      formData.append('image', blob, file.name.replace(/\.[^/.]+$/, "") + ".webp");

      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        document.getElementById('projFinalImageUrl').value = data.url;
      } else {
        document.getElementById('projFinalImageUrl').value = compressedDataUrl;
      }
    } catch (err) {
      document.getElementById('projFinalImageUrl').value = compressedDataUrl;
    }
  } else {
    document.getElementById('projFinalImageUrl').value = compressedDataUrl;
  }

  // Update Preview
  document.getElementById('projPreviewImg').src = compressedDataUrl;
  document.getElementById('projPreviewName').textContent = file.name;
  document.getElementById('projPreviewSize').textContent = `حجم محسن (${Math.round(file.size / 1024)} KB الأصلية)`;
  document.getElementById('projPreviewBox').style.display = 'flex';
}

function removeSelectedProjImage() {
  document.getElementById('projFinalImageUrl').value = '';
  document.getElementById('projPreviewBox').style.display = 'none';
  document.getElementById('projImageFile').value = '';
}

// Client-side canvas compression utility
function compressImageClientSide(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedUrl);
      };
    };
  });
}

function dataURItoBlob(dataURI) {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

// XSS Protection: HTML entity escape helper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ==========================================================================
// LOGO UPLOADER FROM COMPUTER
// ==========================================================================

function initLogoUploader() {
  const dropzone = document.getElementById('logoDropzone');
  const fileInput = document.getElementById('compLogoFileInput');
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleLogoSelection(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleLogoSelection(fileInput.files[0]);
    }
  });
}

async function handleLogoSelection(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('يرجى اختيار ملف صورة صالح للشعار (PNG, JPG, SVG, WEBP).', 'error');
    return;
  }

  // Preview immediately
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('compLogoPreview');
    const placeholder = document.getElementById('compLogoPlaceholder');
    const info = document.getElementById('logoFileInfo');
    const nameSpan = document.getElementById('logoFileName');

    if (preview) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (info) info.style.display = 'flex';
    if (nameSpan) nameSpan.textContent = file.name;
  };
  reader.readAsDataURL(file);

  // Upload to /api/upload
  try {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const data = await res.json();
    if (data.success && data.url) {
      const logoUrl = data.url;
      const urlInput = document.getElementById('compLogoUrl');
      if (urlInput) urlInput.value = logoUrl;

      // Auto-update appData and persist immediately to server
      appData.companyInfo = appData.companyInfo || {};
      appData.companyInfo.logo = logoUrl;
      appData.companyInfo.logoUrl = logoUrl;

      if (isBackendAvailable) {
        try {
          await fetch('/api/company', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData.companyInfo)
          });
        } catch (e) { console.error(e); }
      }

      saveLocalCache();

      // Update brand icon in admin sidebar if present
      const brandIcon = document.querySelector('.sidebar-brand-icon');
      if (brandIcon) {
        brandIcon.innerHTML = `<img src="${logoUrl}" alt="شعار" style="max-height: 28px; max-width: 28px; object-fit: contain;">`;
      }

      showToast('تم رفع الشعار وتطبيقه على الموقع فوراً بنجاح!');
    } else {
      showToast(data.message || 'تعذر رفع الشعار.', 'error');
    }
  } catch (err) {
    console.error('Error uploading logo:', err);
    showToast('حدث خطأ أثناء الاتصال بالخادم لرفع الشعار.', 'error');
  }
}

async function removeCompanyLogo() {
  const urlInput = document.getElementById('compLogoUrl');
  if (urlInput) urlInput.value = '';

  const preview = document.getElementById('compLogoPreview');
  const placeholder = document.getElementById('compLogoPlaceholder');
  const info = document.getElementById('logoFileInfo');
  const fileInput = document.getElementById('compLogoFileInput');

  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'block';
  if (info) info.style.display = 'none';
  if (fileInput) fileInput.value = '';

  appData.companyInfo = appData.companyInfo || {};
  appData.companyInfo.logo = '';
  appData.companyInfo.logoUrl = '';

  if (isBackendAvailable) {
    try {
      await fetch('/api/company', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData.companyInfo)
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();

  const brandIcon = document.querySelector('.sidebar-brand-icon');
  if (brandIcon) {
    brandIcon.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
  }

  showToast('تمت إزالة الشعار وتحديث الموقع بنجاح!');
}

// ==========================================================================
// EMPLOYEE PHOTO UPLOADER FROM COMPUTER
// ==========================================================================

function initEmpPhotoUploader() {
  const dropzone = document.getElementById('empPhotoDropzone');
  const fileInput = document.getElementById('empPhotoFileInput');
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleEmpPhotoSelection(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleEmpPhotoSelection(fileInput.files[0]);
    }
  });
}

async function handleEmpPhotoSelection(file) {
  if (!file.type.startsWith('image/')) {
    alert('يرجى اختيار ملف صورة صالح.');
    return;
  }

  const compressed = await compressImageClientSide(file, 600, 0.85);

  const preview = document.getElementById('empPhotoPreview');
  const icon = document.getElementById('empPhotoIconPlaceholder');
  if (preview) {
    preview.src = compressed;
    preview.style.display = 'block';
  }
  if (icon) icon.style.display = 'none';

  if (isBackendAvailable) {
    try {
      const formData = new FormData();
      const blob = dataURItoBlob(compressed);
      formData.append('image', blob, file.name.replace(/\.[^/.]+$/, "") + ".webp");

      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        document.getElementById('empPhotoUrl').value = data.url;
      } else {
        document.getElementById('empPhotoUrl').value = compressed;
      }
    } catch (e) {
      document.getElementById('empPhotoUrl').value = compressed;
    }
  } else {
    document.getElementById('empPhotoUrl').value = compressed;
  }
}

// ==========================================================================
// 4. SERVICES MANAGEMENT
// ==========================================================================

function renderServicesTable() {
  const tbody = document.getElementById('servicesTableBody');
  tbody.innerHTML = '';
  const services = appData.services || [];

  services.forEach(s => {
    const tr = document.createElement('tr');
    const safeTitle = escapeHtml(s.title);
    const safeDesc = escapeHtml(s.desc);
    const safeUrl = escapeHtml(s.url);
    const safeId = escapeHtml(s.id);
    const safeIcon = escapeHtml(s.icon || 'fa-solid fa-shield');

    tr.innerHTML = `
      <td>
        <div class="sidebar-brand-icon" style="width: 36px; height: 36px; font-size: 1.1rem;">
          <i class="${safeIcon}"></i>
        </div>
      </td>
      <td><strong>${safeTitle}</strong></td>
      <td style="max-width: 320px; font-size: 0.85rem; color: var(--adm-text-muted);">${safeDesc}</td>
      <td><a href="../${safeUrl}" target="_blank" style="color: var(--adm-accent); font-size: 0.85rem;" dir="ltr">${safeUrl}</a></td>
      <td>${s.visible ? '<span class="status-badge completed">ظاهر</span>' : '<span class="status-badge cancelled">مخفي</span>'}</td>
      <td>
        <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="openEditServiceModal('${safeId}')">
          <i class="fa-solid fa-pen"></i> تعديل
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openEditServiceModal(id) {
  const s = (appData.services || []).find(item => item.id === id);
  if (!s) return;

  document.getElementById('serviceEditId').value = s.id;
  document.getElementById('srvTitle').value = s.title || '';
  document.getElementById('srvIcon').value = s.icon || '';
  document.getElementById('srvUrl').value = s.url || '';
  document.getElementById('srvDesc').value = s.desc || '';
  document.getElementById('srvVisible').value = s.visible ? 'true' : 'false';

  document.getElementById('serviceModal').classList.add('show');
}

function closeServiceModal() {
  document.getElementById('serviceModal').classList.remove('show');
}

// ==========================================================================
// 5. COMPANY INFORMATION
// ==========================================================================

function populateCompanyForm() {
  const c = appData.companyInfo || {};
  document.getElementById('compName').value = c.companyName || 'الجدار الآمن للأنظمة الإلكترونية';
  document.getElementById('compShortName').value = c.companyShortName || 'الجدار الآمن';
  document.getElementById('compTagline').value = c.tagline || '';
  document.getElementById('compPhone').value = c.phone || '+962 7 9000 0000';
  document.getElementById('compWhatsapp').value = c.whatsappNumber || '962790000000';
  document.getElementById('compEmail').value = c.email || 'info@aljidar-security.com';
  document.getElementById('compCity').value = c.city || 'عمّان';
  document.getElementById('compAddress').value = c.address || 'المملكة الأردنية الهاشمية - عمّان';
  document.getElementById('compHours').value = c.workingHours || 'السبت - الخميس: 8:30 ص - 6:30 م';
  document.getElementById('compMaps').value = c.googleMapsUrl || 'https://maps.google.com';

  const logo = c.logo || c.logoUrl || '';
  const logoInput = document.getElementById('compLogoUrl');
  const preview = document.getElementById('compLogoPreview');
  const placeholder = document.getElementById('compLogoPlaceholder');
  const info = document.getElementById('logoFileInfo');
  const nameSpan = document.getElementById('logoFileName');

  if (logoInput) logoInput.value = logo;
  if (logo && preview && placeholder) {
    preview.src = logo;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    if (info) info.style.display = 'flex';
    if (nameSpan) nameSpan.textContent = 'شعار محفوظ';
  } else if (preview && placeholder) {
    preview.style.display = 'none';
    placeholder.style.display = 'block';
    if (info) info.style.display = 'none';
  }

  const s = c.socialLinks || {};
  document.getElementById('socialTwitter').value = s.twitter || '';
  document.getElementById('socialLinkedin').value = s.linkedin || '';
  document.getElementById('socialInstagram').value = s.instagram || '';
  document.getElementById('socialFacebook').value = s.facebook || '';
  document.getElementById('socialTiktok').value = s.tiktok || '';
}

// ==========================================================================
// 6. HOMEPAGE HERO CONTENT
// ==========================================================================

function populateHeroForm() {
  const h = appData.hero || {};
  document.getElementById('heroBadge').value = h.badge || 'الجدار الآمن للأنظمة الإلكترونية';
  document.getElementById('heroTitle').value = h.title || 'حلول متكاملة للأمن والسلامة والأنظمة الإلكترونية';
  document.getElementById('heroDescription').value = h.description || '';
  document.getElementById('heroBgImage').value = h.bgImage || '';
  document.getElementById('heroFeature1').value = h.feature1 || 'تركيب وتجهيز';
  document.getElementById('heroFeature2').value = h.feature2 || 'صيانة ودعم فني';
  document.getElementById('heroFeature3').value = h.feature3 || 'حلول للمنازل والمنشآت';
}

// ==========================================================================
// 7. FAQs MANAGEMENT
// ==========================================================================

function renderFaqsTable() {
  const tbody = document.getElementById('faqsTableBody');
  tbody.innerHTML = '';
  const faqs = appData.faqs || [];

  if (faqs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--adm-text-muted); padding: 2rem;">لا توجد أسئلة مضافة حتى الآن.</td></tr>`;
    return;
  }

  faqs.forEach((f, idx) => {
    const tr = document.createElement('tr');
    const safeQ = escapeHtml(f.question);
    const safeA = escapeHtml(f.answer);
    const safeId = escapeHtml(f.id);

    tr.innerHTML = `
      <td style="font-weight: 700;">${safeQ}</td>
      <td style="font-size: 0.875rem; color: var(--adm-text-muted); max-width: 400px;">${safeA}</td>
      <td>${idx + 1}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="openEditFaqModal('${safeId}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-adm btn-adm-danger btn-adm-sm" onclick="deleteFaq('${safeId}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddFaqModal() {
  document.getElementById('faqModalTitle').textContent = 'إضافة سؤال شائع جديد';
  document.getElementById('faqForm').reset();
  document.getElementById('faqEditId').value = '';
  document.getElementById('faqModal').classList.add('show');
}

function openEditFaqModal(id) {
  const f = (appData.faqs || []).find(item => item.id === id);
  if (!f) return;

  document.getElementById('faqModalTitle').textContent = 'تعديل السؤال الشائع';
  document.getElementById('faqEditId').value = f.id;
  document.getElementById('faqQuestion').value = f.question || '';
  document.getElementById('faqAnswer').value = f.answer || '';
  document.getElementById('faqModal').classList.add('show');
}

function closeFaqModal() {
  document.getElementById('faqModal').classList.remove('show');
}

async function deleteFaq(id) {
  if (!confirm('هل تريد حذف هذا السؤال؟')) return;
  appData.faqs = (appData.faqs || []).filter(f => f.id !== id);

  if (isBackendAvailable) {
    try {
      await fetch(`/api/faqs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderFaqsTable();
  showToast('تم حذف السؤال بنجاح!');
}

// ==========================================================================
// 8. QUOTES & INQUIRIES MANAGEMENT
// ==========================================================================

function renderQuotesTable() {
  const tbody = document.getElementById('allQuotesTableBody');
  tbody.innerHTML = '';
  const quotes = appData.quotes || [];
  const filter = document.getElementById('filterQuotesStatus').value;

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--adm-text-muted); padding: 3rem;">لا توجد طلبات عروض أسعار تطابق التصفية الحالية.</td></tr>`;
    return;
  }

  filtered.forEach(q => {
    const tr = document.createElement('tr');
    const dateStr = q.createdAt ? new Date(q.createdAt).toLocaleString('ar-SA') : '-';

    tr.innerHTML = `
      <td><strong>${escapeHtml(q.name)}</strong></td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <a href="tel:${escapeHtml(q.phone)}" style="color: var(--adm-accent);" dir="ltr">${escapeHtml(q.phone)}</a>
          <a href="https://wa.me/${encodeURIComponent(q.phone.replace(/[^0-9]/g, ''))}" target="_blank" style="color: #25d366;" title="محادثة واتساب">
            <i class="fa-brands fa-whatsapp"></i>
          </a>
        </div>
      </td>
      <td><span class="status-badge new">${escapeHtml(q.service)}</span></td>
      <td>${escapeHtml(q.location || '-')}</td>
      <td>${q.inspection === 'نعم' ? '<strong style="color: #34d399;">نعم</strong>' : 'لا'}</td>
      <td style="max-width: 250px; font-size: 0.85rem; color: #cbd5e1;">${escapeHtml(q.details || '-')}</td>
      <td><small style="color: var(--adm-text-muted);">${dateStr}</small></td>
      <td>
        <select class="form-select" style="padding: 0.35rem 0.6rem; font-size: 0.825rem; width: auto;" onchange="updateQuoteStatus('${escapeHtml(q.id)}', this.value)">
          <option value="جديد" ${q.status === 'جديد' ? 'selected' : ''}>جديد</option>
          <option value="تم التواصل" ${q.status === 'تم التواصل' ? 'selected' : ''}>تم التواصل</option>
          <option value="قيد المتابعة" ${q.status === 'قيد المتابعة' ? 'selected' : ''}>قيد المتابعة</option>
          <option value="مكتمل" ${q.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
          <option value="ملغي" ${q.status === 'ملغي' ? 'selected' : ''}>ملغي</option>
        </select>
      </td>
      <td>
        <button class="btn-adm btn-adm-danger btn-adm-sm" onclick="deleteQuote('${escapeHtml(q.id)}')" title="حذف">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function updateQuoteStatus(id, newStatus) {
  const q = (appData.quotes || []).find(item => item.id === id);
  if (!q) return;

  q.status = newStatus;

  if (isBackendAvailable) {
    try {
      await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderDashboardStats();
  showToast(`تم تغيير حالة الطلب إلى "${newStatus}"!`);
}

async function deleteQuote(id) {
  if (!confirm('هل تريد حذف هذا الطلب نهائياً؟')) return;

  appData.quotes = (appData.quotes || []).filter(q => q.id !== id);

  if (isBackendAvailable) {
    try {
      await fetch(`/api/quotes/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderQuotesTable();
  renderDashboardStats();
  showToast('تم حذف الطلب بنجاح.');
}

// Filter quote status event
document.getElementById('filterQuotesStatus')?.addEventListener('change', renderQuotesTable);

// Helper for status badge HTML
function getStatusBadge(status) {
  switch (status) {
    case 'جديد': return '<span class="status-badge new">جديد</span>';
    case 'تم التواصل': return '<span class="status-badge contacted">تم التواصل</span>';
    case 'قيد المتابعة': return '<span class="status-badge progress">قيد المتابعة</span>';
    case 'مكتمل': return '<span class="status-badge completed">مكتمل</span>';
    case 'ملغي': return '<span class="status-badge cancelled">ملغي</span>';
    default: return `<span class="status-badge new">${status || 'جديد'}</span>`;
  }
}

// ==========================================================================
// FORM SUBMISSIONS & SAVING
// ==========================================================================

function initForms() {
  // Project Form Submit
  document.getElementById('projectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('projectEditId').value;
    const title = document.getElementById('projTitle').value.trim();
    const serviceSelect = document.getElementById('projService');
    const service = serviceSelect.value;
    const category = serviceSelect.selectedOptions[0]?.getAttribute('data-cat') || 'cctv';
    const sector = document.getElementById('projSector').value;
    const desc = document.getElementById('projDesc').value.trim();
    const altText = document.getElementById('projAltText').value.trim();
    const visible = document.getElementById('projVisible').value === 'true';
    const image = document.getElementById('projFinalImageUrl').value;

    if (!title || !service) {
      alert('يرجى كتابة اسم المشروع واختيار الخدمة.');
      return;
    }

    if (!image) {
      alert('يرجى رفع أو اختيار صورة رئيسية للمشروع.');
      return;
    }

    const projectData = {
      title,
      service,
      category,
      sector,
      desc,
      altText,
      visible,
      image
    };

    if (editId) {
      // Update
      const index = (appData.projects || []).findIndex(p => p.id === editId);
      if (index !== -1) {
        appData.projects[index] = { ...appData.projects[index], ...projectData };
      }

      if (isBackendAvailable) {
        try {
          await fetch(`/api/projects/${editId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
          });
        } catch (err) { console.error(err); }
      }
      showToast('تم تحديث المشروع بنجاح!');
    } else {
      // Create new
      const newProj = {
        id: 'proj-' + Date.now(),
        ...projectData,
        order: (appData.projects || []).length + 1,
        createdAt: new Date().toISOString()
      };
      appData.projects = appData.projects || [];
      appData.projects.unshift(newProj);

      if (isBackendAvailable) {
        try {
          await fetch('/api/projects', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProj)
          });
        } catch (err) { console.error(err); }
      }
      showToast('تمت إضافة المشروع الجديد بنجاح!');
    }

    saveLocalCache();
    closeProjectModal();
    renderProjectsTable();
    renderDashboardStats();
  });

  // Service Form Submit
  document.getElementById('serviceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('serviceEditId').value;
    const title = document.getElementById('srvTitle').value.trim();
    const icon = document.getElementById('srvIcon').value.trim();
    const url = document.getElementById('srvUrl').value.trim();
    const desc = document.getElementById('srvDesc').value.trim();
    const visible = document.getElementById('srvVisible').value === 'true';

    const index = (appData.services || []).findIndex(s => s.id === editId);
    if (index !== -1) {
      appData.services[index] = {
        ...appData.services[index],
        title, icon, url, desc, visible
      };

      if (isBackendAvailable) {
        try {
          await fetch(`/api/services/${editId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData.services[index])
          });
        } catch (err) { console.error(err); }
      }

      saveLocalCache();
      closeServiceModal();
      renderServicesTable();
      showToast('تم حفظ تعديل الخدمة بنجاح!');
    }
  });

  // Company Form Save Button
  document.getElementById('saveCompanyBtn')?.addEventListener('click', async () => {
    const logoVal = (document.getElementById('compLogoUrl')?.value || '').trim();
    const updatedCompany = {
      companyName: document.getElementById('compName').value.trim(),
      companyShortName: document.getElementById('compShortName').value.trim(),
      logo: logoVal,
      logoUrl: logoVal,
      tagline: document.getElementById('compTagline').value.trim(),
      phone: document.getElementById('compPhone').value.trim(),
      phoneRaw: document.getElementById('compPhone').value.replace(/[^0-9+]/g, ''),
      whatsapp: document.getElementById('compWhatsapp').value.trim(),
      whatsappNumber: document.getElementById('compWhatsapp').value.replace(/[^0-9]/g, ''),
      email: document.getElementById('compEmail').value.trim(),
      city: document.getElementById('compCity').value.trim(),
      address: document.getElementById('compAddress').value.trim(),
      workingHours: document.getElementById('compHours').value.trim(),
      googleMapsUrl: document.getElementById('compMaps').value.trim(),
      socialLinks: {
        twitter: document.getElementById('socialTwitter').value.trim(),
        linkedin: document.getElementById('socialLinkedin').value.trim(),
        instagram: document.getElementById('socialInstagram').value.trim(),
        facebook: document.getElementById('socialFacebook').value.trim(),
        tiktok: document.getElementById('socialTiktok').value.trim()
      }
    };

    appData.companyInfo = updatedCompany;

    if (isBackendAvailable) {
      try {
        await fetch('/api/company', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedCompany)
        });
      } catch (err) { console.error(err); }
    }

    saveLocalCache();
    showToast('تم حفظ بيانات المؤسسة بنجاح وتحديث الموقع كاملاً!');
  });

  // Hero Form Save Button
  document.getElementById('saveHeroBtn')?.addEventListener('click', async () => {
    const updatedHero = {
      badge: document.getElementById('heroBadge').value.trim(),
      title: document.getElementById('heroTitle').value.trim(),
      description: document.getElementById('heroDescription').value.trim(),
      bgImage: document.getElementById('heroBgImage').value.trim(),
      feature1: document.getElementById('heroFeature1').value.trim(),
      feature2: document.getElementById('heroFeature2').value.trim(),
      feature3: document.getElementById('heroFeature3').value.trim()
    };

    appData.hero = updatedHero;

    if (isBackendAvailable) {
      try {
        await fetch('/api/hero', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedHero)
        });
      } catch (err) { console.error(err); }
    }

    saveLocalCache();
    showToast('تم حفظ محتوى الواجهة الرئيسية بنجاح!');
  });

  // FAQ Form Submit
  document.getElementById('faqForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('faqEditId').value;
    const question = document.getElementById('faqQuestion').value.trim();
    const answer = document.getElementById('faqAnswer').value.trim();

    if (!question || !answer) return;

    if (editId) {
      const index = (appData.faqs || []).findIndex(f => f.id === editId);
      if (index !== -1) {
        appData.faqs[index] = { ...appData.faqs[index], question, answer };
        if (isBackendAvailable) {
          try {
            await fetch(`/api/faqs/${editId}`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ question, answer })
            });
          } catch (e) { console.error(e); }
        }
      }
      showToast('تم تحديث السؤال بنجاح!');
    } else {
      const newFaq = {
        id: 'faq-' + Date.now(),
        question,
        answer,
        order: (appData.faqs || []).length + 1
      };
      appData.faqs = appData.faqs || [];
      appData.faqs.push(newFaq);

      if (isBackendAvailable) {
        try {
          await fetch('/api/faqs', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newFaq)
          });
        } catch (e) { console.error(e); }
      }
      showToast('تمت إضافة السؤال الجديد بنجاح!');
    }

    saveLocalCache();
    closeFaqModal();
    renderFaqsTable();
  });

  // Employee Form Submit
  document.getElementById('employeeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('empEditId').value;
    const name = document.getElementById('empName').value.trim();
    const title = document.getElementById('empTitle').value.trim();
    const department = document.getElementById('empDepartment').value.trim();
    const specializationsRaw = document.getElementById('empSpecializations').value.trim();
    const specializations = specializationsRaw ? specializationsRaw.split(/[,،]+/).map(s => s.trim()).filter(Boolean) : [];
    const phone = document.getElementById('empPhone').value.trim();
    const whatsapp = document.getElementById('empWhatsapp').value.trim();
    const email = document.getElementById('empEmail').value.trim();
    const bio = document.getElementById('empBio').value.trim();
    const photo = document.getElementById('empPhotoUrl').value.trim() || 'assets/images/employees/default-avatar.png';
    const isActive = document.getElementById('empActive').value === 'true';

    const empData = {
      name,
      title,
      department,
      specializations,
      phone,
      whatsapp,
      email,
      bio,
      photo,
      isActive
    };

    if (editId) {
      const idx = (appData.employees || []).findIndex(emp => emp.id === editId);
      if (idx !== -1) {
        appData.employees[idx] = { ...appData.employees[idx], ...empData };
      }
      if (isBackendAvailable) {
        try {
          await fetch(`/api/employees/${editId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(empData)
          });
        } catch (err) { console.error(err); }
      }
      showToast('تم تحديث بيانات الموظف بنجاح!');
    } else {
      const newEmp = {
        id: 'emp-' + Date.now(),
        ...empData,
        createdAt: new Date().toISOString()
      };
      appData.employees = appData.employees || [];
      appData.employees.push(newEmp);

      if (isBackendAvailable) {
        try {
          const res = await fetch('/api/employees', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newEmp)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.data?.id) newEmp.id = data.data.id;
          }
        } catch (err) { console.error(err); }
      }
      showToast('تمت إضافة الموظف الجديد بنجاح!');
    }

    saveLocalCache();
    closeEmployeeModal();
    renderEmployeesTable();
    renderNfcStats();
  });

  // Card Form Submit
  document.getElementById('cardForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('cardEditId').value;
    const cardCode = document.getElementById('cardCode').value.trim();
    let slug = document.getElementById('cardSlug').value.trim().toLowerCase().replace(/\s+/g, '-');
    const employeeId = document.getElementById('cardEmployeeId').value;
    const isActive = document.getElementById('cardActive').value === 'true';

    if (!employeeId) {
      alert('الرجاء اختيار الموظف المرتبط بهذه البطاقة');
      return;
    }

    const cardPayload = {
      cardCode,
      slug,
      employeeId,
      isActive
    };

    if (editId) {
      const idx = (appData.nfcCards || []).findIndex(c => c.id === editId);
      if (idx !== -1) {
        appData.nfcCards[idx] = { ...appData.nfcCards[idx], ...cardPayload };
      }
      if (isBackendAvailable) {
        try {
          await fetch(`/api/cards/${editId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardPayload)
          });
        } catch (err) { console.error(err); }
      }
      showToast('تم تحديث بيانات البطاقة بنجاح!');
    } else {
      const newCard = {
        id: 'card-' + Date.now(),
        ...cardPayload,
        analytics: { visits: 0, calls: 0, whatsapp: 0, vcardDownloads: 0, googleReviews: 0, lastVisit: null },
        createdAt: new Date().toISOString()
      };
      appData.nfcCards = appData.nfcCards || [];
      appData.nfcCards.push(newCard);

      if (isBackendAvailable) {
        try {
          const res = await fetch('/api/cards', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCard)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.data?.id) newCard.id = data.data.id;
          }
        } catch (err) { console.error(err); }
      }
      showToast('تم إصدار البطاقة وربطها بنجاح!');
    }

    saveLocalCache();
    closeCardModal();
    renderCardsTable();
    renderEmployeesTable();
    renderNfcStats();
  });

  // Slug input live preview
  document.getElementById('cardSlug')?.addEventListener('input', (e) => {
    const clean = e.target.value.trim().toLowerCase().replace(/\s+/g, '-');
    const preview = document.getElementById('slugPreviewText');
    if (preview) {
      preview.textContent = 'الرابط: /card/' + (clean || 'slug');
    }
  });

  // Reviews filter
  document.getElementById('filterReviewsStatus')?.addEventListener('change', () => {
    renderReviewsTable();
  });
}

function saveLocalCache() {
  localStorage.setItem('cachedAdminData', JSON.stringify(appData));
}

// ==========================================================================
// NAVIGATION & UI UTILITIES
// ==========================================================================

function initTabs() {
  const buttons = document.querySelectorAll('.nav-item-btn[data-tab]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  // Update Buttons
  document.querySelectorAll('.nav-item-btn').forEach(b => b.classList.remove('active'));
  const targetBtn = document.querySelector(`.nav-item-btn[data-tab="${tabId}"]`);
  if (targetBtn) targetBtn.classList.add('active');

  // Update Panes
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const targetPane = document.getElementById(`pane-${tabId}`);
  if (targetPane) targetPane.classList.add('active');

  // Update Topbar Title
  const titles = {
    dashboard: 'لوحة الإحصائيات العامة',
    projects: 'إدارة المشاريع ومعرض الأعمال',
    services: 'إدارة وتخصيص الخدمات',
    company: 'بيانات المؤسسة والتواصل',
    homepage: 'إدارة الصفحة الرئيسية',
    faqs: 'إدارة الأسئلة الشائعة (FAQ)',
    quotes: 'طلبات عروض الأسعار المستلمة',
    nfc: 'إدارة بطاقات NFC والموظفين',
    reviews: 'تقييمات وآراء العملاء',
    security: 'الأمان وحساب الإدارة والنسخ الاحتياطي'
  };
  document.getElementById('currentTabTitle').textContent = titles[tabId] || 'لوحة التحكم';

  // Close Mobile Sidebar if opened
  document.getElementById('adminSidebar')?.classList.remove('open');
}

function initMobileSidebar() {
  const toggle = document.getElementById('mobileSidebarToggle');
  const sidebar = document.getElementById('adminSidebar');

  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

function initLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (confirm('هل ترغب في تسجيل الخروج من لوحة التحكم؟')) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (e) {}
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = 'login.html';
    }
  });
}

function showToast(msg) {
  const toast = document.getElementById('admToast');
  const toastMsg = document.getElementById('admToastMsg');
  if (toast && toastMsg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
}

// ==========================================================================
// 9. NFC CARDS & EMPLOYEES
// ==========================================================================

function renderNfcStats() {
  const employees = appData.employees || [];
  const cards = appData.nfcCards || [];
  const reviews = appData.reviews || [];

  const activeCards = cards.filter(c => c.isActive !== undefined ? c.isActive : (c.status === 'مفعلة' || c.status === 'active')).length;
  let totalVisits = 0;
  let totalVcard = 0;

  cards.forEach(c => {
    totalVisits += (c.analytics?.visits || c.stats?.opens || 0);
    totalVcard += (c.analytics?.vcardDownloads || c.stats?.vCards || 0);
  });

  const statEmp = document.getElementById('statEmpCount');
  if (statEmp) statEmp.textContent = employees.length;

  const statActCards = document.getElementById('statActiveCardsCount');
  if (statActCards) statActCards.textContent = activeCards;

  const statVisits = document.getElementById('statTotalVisitsCount');
  if (statVisits) statVisits.textContent = totalVisits;

  const statVcard = document.getElementById('statTotalVcardDownloads');
  if (statVcard) statVcard.textContent = totalVcard;

  const sidebarCardsBadge = document.getElementById('sidebarCardsBadge');
  if (sidebarCardsBadge) sidebarCardsBadge.textContent = cards.length;

  const pendingReviews = reviews.filter(r => (r.approved === false || r.status === 'pending') && r.status !== 'hidden').length;
  const sidebarReviewsBadge = document.getElementById('sidebarReviewsBadge');
  if (sidebarReviewsBadge) sidebarReviewsBadge.textContent = pendingReviews;
}

function renderCardsTable() {
  const tbody = document.getElementById('nfcCardsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const cards = appData.nfcCards || [];
  const employees = appData.employees || [];

  if (cards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--adm-text-muted); padding: 2.5rem;">لا توجد بطاقات NFC مضافة حتى الآن. اضغط على زر "إصدار بطاقة NFC جديدة" بالأعلى.</td></tr>`;
    return;
  }

  cards.forEach(card => {
    const emp = employees.find(e => e.id === card.employeeId);
    const tr = document.createElement('tr');
    const isCardActive = card.isActive !== undefined ? card.isActive : (card.status === 'مفعلة' || card.status === 'active');
    const visits = (card.analytics?.visits || card.stats?.opens || 0);
    const vcardDownloads = (card.analytics?.vcardDownloads || card.stats?.vCards || 0);
    const calls = (card.analytics?.calls || card.stats?.calls || 0);
    const whatsapp = (card.analytics?.whatsapp || card.stats?.whatsapps || 0);

    const safeCode = escapeHtml(card.cardCode);
    const safeSlug = escapeHtml(card.slug);
    const safeEncodedSlug = encodeURIComponent(card.slug || '');
    const safeId = escapeHtml(card.id);
    const safeEmpName = emp ? escapeHtml(emp.name) : '';
    const safeEmpTitle = emp ? escapeHtml(emp.title) : '';
    const safeEmpPhoto = emp?.photo ? escapeHtml(emp.photo) : 'assets/images/employees/default-avatar.png';

    tr.innerHTML = `
      <td>
        <div style="font-weight: 700; color: #fff; font-family: monospace; font-size: 0.95rem;">${safeCode}</div>
        <div style="font-size: 0.75rem; color: var(--adm-text-muted);">${card.createdAt ? new Date(card.createdAt).toLocaleDateString('ar-SA') : ''}</div>
      </td>
      <td>
        ${emp ? `
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <img src="${safeEmpPhoto}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' fill=\\'%230284c7\\' viewBox=\\'0 0 16 16\\'><path d=\\'M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z\\'/><path fill-rule=\\'evenodd\\' d=\\'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z\\'/></svg>'" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid var(--adm-border);">
            <div>
              <div style="font-weight: 700; color: #fff;">${safeEmpName}</div>
              <div style="font-size: 0.78rem; color: var(--adm-accent);">${safeEmpTitle}</div>
            </div>
          </div>
        ` : `<span style="color: var(--adm-danger);">غير مرتبط بموظف</span>`}
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <a href="/card/${safeEncodedSlug}" target="_blank" style="color: var(--adm-accent); font-weight: 600; text-decoration: underline; font-size: 0.88rem;" dir="ltr">/card/${safeSlug}</a>
          <button type="button" class="btn-adm btn-adm-secondary btn-adm-sm" onclick="copyCardLink('${safeSlug}')" title="نسخ الرابط"><i class="fa-solid fa-copy"></i></button>
        </div>
      </td>
      <td>
        <div style="font-size: 0.82rem; line-height: 1.5;">
          <span style="color: #38bdf8; font-weight: 700;">${visits}</span> زيارة | 
          <span style="color: #22c55e;">${vcardDownloads}</span> حفظ اتصال
          <div style="font-size: 0.72rem; color: var(--adm-text-muted);">
            اتصال: ${calls} | واتساب: ${whatsapp}
          </div>
        </div>
      </td>
      <td>
        <button class="status-badge ${isCardActive ? 'active' : 'cancelled'}" onclick="toggleCardStatus('${safeId}')" style="cursor: pointer; border: none; font-size: 0.8rem; padding: 0.35rem 0.75rem;" title="اضغط للتبديل بين تفعيل / تعطيل">
          <i class="fa-solid ${isCardActive ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
          <span>${isCardActive ? 'مفعّلة' : 'معطلة'}</span>
        </button>
      </td>
      <td>
        <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="openQrModal('${safeSlug}')" style="display: inline-flex; align-items: center; gap: 0.4rem;">
          <i class="fa-solid fa-qrcode" style="color: var(--adm-accent);"></i>
          <span>رمز QR</span>
        </button>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="openCardModal('${safeId}')" title="تعديل"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-adm btn-adm-danger btn-adm-sm" onclick="deleteCard('${safeId}')" title="حذف"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderEmployeesTable() {
  const tbody = document.getElementById('employeesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const employees = appData.employees || [];
  const cards = appData.nfcCards || [];

  if (employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--adm-text-muted); padding: 2.5rem;">لا يوجد موظفون مسجلون حتى الآن.</td></tr>`;
    return;
  }

  employees.forEach(emp => {
    const linkedCard = cards.find(c => c.employeeId === emp.id);
    const tr = document.createElement('tr');

    const specs = (emp.specializations || []).map(s => `<span style="display: inline-block; background: rgba(56, 189, 248, 0.1); color: var(--adm-accent); padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; margin: 1px;">${escapeHtml(s)}</span>`).join(' ');

    tr.innerHTML = `
      <td>
        <img src="${escapeHtml(emp.photo || 'assets/images/employees/default-avatar.png')}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'44\\' height=\\'44\\' fill=\\'%230284c7\\' viewBox=\\'0 0 16 16\\'><path d=\\'M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z\\'/><path fill-rule=\\'evenodd\\' d=\\'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z\\'/></svg>'" class="table-thumb" style="border-radius: 50%; width: 44px; height: 44px;">
      </td>
      <td>
        <strong style="color: #fff; font-size: 0.95rem;">${escapeHtml(emp.name)}</strong>
        ${emp.email ? `<div style="font-size: 0.75rem; color: var(--adm-text-muted);"><i class="fa-solid fa-envelope" style="font-size: 0.7rem;"></i> ${escapeHtml(emp.email)}</div>` : ''}
      </td>
      <td>
        <div style="font-weight: 600; color: #cbd5e1;">${escapeHtml(emp.title)}</div>
      </td>
      <td>
        <div style="font-size: 0.82rem; color: var(--adm-text-muted); margin-bottom: 0.25rem;">${escapeHtml(emp.department || '-')}</div>
        <div>${specs}</div>
      </td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem;" dir="ltr">
          <a href="tel:${escapeHtml(emp.phone)}" style="color: var(--adm-accent);"><i class="fa-solid fa-phone"></i> ${escapeHtml(emp.phone)}</a>
          <a href="https://wa.me/${encodeURIComponent((emp.whatsapp || emp.phone).replace(/[^0-9]/g, ''))}" target="_blank" style="color: #22c55e;"><i class="fa-brands fa-whatsapp"></i> ${escapeHtml(emp.whatsapp || emp.phone)}</a>
        </div>
      </td>
      <td>
        ${linkedCard ? `
          <div>
            <a href="/card/${encodeURIComponent(linkedCard.slug)}" target="_blank" style="color: var(--adm-accent); font-weight: 700; font-size: 0.85rem;" dir="ltr">/card/${escapeHtml(linkedCard.slug)}</a>
            <div style="font-size: 0.72rem; color: var(--adm-text-muted);">${escapeHtml(linkedCard.cardCode)}</div>
          </div>
        ` : `<span style="font-size: 0.8rem; color: var(--adm-text-muted);">لا توجد بطاقة</span>`}
      </td>
      <td>
        <span class="status-badge ${emp.isActive ? 'active' : 'cancelled'}">
          ${emp.isActive ? 'نشط' : 'معطل'}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="openEmployeeModal('${escapeHtml(emp.id)}')" title="تعديل"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-adm btn-adm-danger btn-adm-sm" onclick="deleteEmployee('${escapeHtml(emp.id)}')" title="حذف"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Employee Modal Handlers
function openEmployeeModal(empId) {
  const form = document.getElementById('employeeForm');
  if (form) form.reset();

  const photoPreview = document.getElementById('empPhotoPreview');
  const photoIcon = document.getElementById('empPhotoIconPlaceholder');
  const fileInput = document.getElementById('empPhotoFileInput');
  if (fileInput) fileInput.value = '';

  if (empId) {
    const emp = (appData.employees || []).find(e => e.id === empId);
    if (!emp) return;
    document.getElementById('employeeModalTitle').textContent = 'تعديل بيانات الموظف';
    document.getElementById('empEditId').value = emp.id;
    document.getElementById('empName').value = emp.name || '';
    document.getElementById('empTitle').value = emp.title || '';
    document.getElementById('empDepartment').value = emp.department || '';
    document.getElementById('empSpecializations').value = (emp.specializations || []).join('، ');
    document.getElementById('empPhone').value = emp.phone || '';
    document.getElementById('empWhatsapp').value = emp.whatsapp || emp.phone || '';
    document.getElementById('empEmail').value = emp.email || '';
    document.getElementById('empBio').value = emp.bio || '';
    document.getElementById('empPhotoUrl').value = emp.photo || '';
    document.getElementById('empActive').value = emp.isActive ? 'true' : 'false';

    if (emp.photo) {
      if (photoPreview) { photoPreview.src = emp.photo; photoPreview.style.display = 'block'; }
      if (photoIcon) photoIcon.style.display = 'none';
    } else {
      if (photoPreview) { photoPreview.src = ''; photoPreview.style.display = 'none'; }
      if (photoIcon) photoIcon.style.display = 'block';
    }
  } else {
    document.getElementById('employeeModalTitle').textContent = 'إضافة موظف جديد';
    document.getElementById('empEditId').value = '';
    document.getElementById('empPhotoUrl').value = '';
    document.getElementById('empActive').value = 'true';
    if (photoPreview) { photoPreview.src = ''; photoPreview.style.display = 'none'; }
    if (photoIcon) photoIcon.style.display = 'block';
  }

  document.getElementById('employeeModal').classList.add('show');
}

function removeEmpPhoto() {
  const urlInput = document.getElementById('empPhotoUrl');
  if (urlInput) urlInput.value = '';
  const photoPreview = document.getElementById('empPhotoPreview');
  const photoIcon = document.getElementById('empPhotoIconPlaceholder');
  const fileInput = document.getElementById('empPhotoFileInput');
  if (photoPreview) { photoPreview.src = ''; photoPreview.style.display = 'none'; }
  if (photoIcon) photoIcon.style.display = 'block';
  if (fileInput) fileInput.value = '';
}

function closeEmployeeModal() {
  document.getElementById('employeeModal')?.classList.remove('show');
}

async function deleteEmployee(id) {
  if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الموظف؟ لن يتمكن العملاء من فتح بطاقته بعد الحذف.')) return;

  appData.employees = (appData.employees || []).filter(e => e.id !== id);

  if (isBackendAvailable) {
    try {
      await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderEmployeesTable();
  renderCardsTable();
  renderNfcStats();
  showToast('تم حذف الموظف بنجاح!');
}

// Card Modal Handlers
function openCardModal(cardId) {
  const form = document.getElementById('cardForm');
  if (form) form.reset();

  // Populate Employee Select
  const select = document.getElementById('cardEmployeeId');
  select.innerHTML = '<option value="">-- اختر موظفاً لربطه بالبطاقة --</option>';
  (appData.employees || []).forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.title})`;
    select.appendChild(opt);
  });

  if (cardId) {
    const card = (appData.nfcCards || []).find(c => c.id === cardId);
    if (!card) return;
    document.getElementById('cardModalTitle').textContent = 'تعديل بيانات بطاقة NFC';
    document.getElementById('cardEditId').value = card.id;
    document.getElementById('cardCode').value = card.cardCode || '';
    document.getElementById('cardSlug').value = card.slug || '';
    document.getElementById('cardEmployeeId').value = card.employeeId || '';
    document.getElementById('cardActive').value = card.isActive ? 'true' : 'false';
    const preview = document.getElementById('slugPreviewText');
    if (preview) preview.textContent = 'الرابط: /card/' + card.slug;
  } else {
    document.getElementById('cardModalTitle').textContent = 'إصدار بطاقة NFC جديدة';
    document.getElementById('cardEditId').value = '';
    document.getElementById('cardCode').value = 'NFC-SEC-00' + ((appData.nfcCards || []).length + 1);
    document.getElementById('cardActive').value = 'true';
    const preview = document.getElementById('slugPreviewText');
    if (preview) preview.textContent = 'الرابط: /card/slug';
  }

  document.getElementById('cardModal').classList.add('show');
}

function closeCardModal() {
  document.getElementById('cardModal')?.classList.remove('show');
}

async function toggleCardStatus(id) {
  const card = (appData.nfcCards || []).find(c => c.id === id);
  if (!card) return;

  card.isActive = !card.isActive;

  if (isBackendAvailable) {
    try {
      await fetch(`/api/cards/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: card.isActive })
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderCardsTable();
  renderNfcStats();
  showToast(card.isActive ? 'تم تفعيل البطاقة بنجاح!' : 'تم تعطيل البطاقة بنجاح!');
}

async function deleteCard(id) {
  if (!confirm('هل تريد بالتأكيد حذف هذه البطاقة الذكية؟')) return;

  appData.nfcCards = (appData.nfcCards || []).filter(c => c.id !== id);

  if (isBackendAvailable) {
    try {
      await fetch(`/api/cards/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderCardsTable();
  renderNfcStats();
  showToast('تم حذف البطاقة بنجاح!');
}

// QR Code Modal
function openQrModal(slug) {
  const card = (appData.nfcCards || []).find(c => c.slug === slug);
  const emp = card ? (appData.employees || []).find(e => e.id === card.employeeId) : null;
  const fullUrl = `${window.location.origin}/card/${slug}`;

  document.getElementById('qrModalEmpName').textContent = emp ? emp.name : 'موظف مؤسسة الجدار الآمن';
  document.getElementById('qrModalEmpTitle').textContent = emp ? emp.title : 'أنظمة أمنية وإلكترونية';
  document.getElementById('qrModalUrlInput').value = fullUrl;
  document.getElementById('qrVisitBtn').href = `/card/${slug}`;
  document.getElementById('qrDownloadBtn').href = `/api/qrcode/${slug}?download=true`;

  const img = document.getElementById('qrModalImage');
  img.src = `/api/qrcode/${slug}`;

  document.getElementById('qrModal').classList.add('show');
}

function closeQrModal() {
  document.getElementById('qrModal')?.classList.remove('show');
}

function copyQrUrl() {
  const input = document.getElementById('qrModalUrlInput');
  if (input) {
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('تم نسخ الرابط إلى الحافظة بنجاح!');
    });
  }
}

function copyCardLink(slug) {
  const fullUrl = `${window.location.origin}/card/${slug}`;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('تم نسخ رابط البطاقة: ' + fullUrl);
  });
}

function printQrCard() {
  const url = document.getElementById('qrModalUrlInput').value;
  const name = document.getElementById('qrModalEmpName').textContent;
  const title = document.getElementById('qrModalEmpTitle').textContent;
  const qrImgSrc = document.getElementById('qrModalImage').src;

  const printWin = window.open('', '_blank', 'width=600,height=700');
  printWin.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>طباعة بطاقة QR - ${name}</title>
      <style>
        body { font-family: 'Cairo', Tahoma, sans-serif; text-align: center; margin: 40px auto; color: #0f172a; max-width: 400px; }
        .card-box { border: 2px solid #0284c7; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .logo-title { font-size: 20px; font-weight: bold; color: #0369a1; margin-bottom: 4px; }
        .logo-sub { font-size: 13px; color: #64748b; margin-bottom: 20px; }
        img.qr { width: 220px; height: 220px; margin: 10px auto; display: block; }
        .emp-name { font-size: 18px; font-weight: bold; margin-top: 15px; color: #0f172a; }
        .emp-title { font-size: 14px; color: #0284c7; margin-bottom: 10px; }
        .card-url { font-family: monospace; font-size: 12px; color: #475569; word-break: break-all; direction: ltr; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="card-box">
        <div class="logo-title">الجدار الآمن للأنظمة الإلكترونية</div>
        <div class="logo-sub">بطاقة الأعمال الرقمية الذكية</div>
        <img class="qr" src="${qrImgSrc}" alt="QR Code">
        <div class="emp-name">${name}</div>
        <div class="emp-title">${title}</div>
        <div class="card-url">${url}</div>
      </div>
      <script>
        window.onload = () => { window.print(); }
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// ==========================================================================
// 10. REVIEWS MODERATION
// ==========================================================================

function renderReviewsTable() {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const reviews = appData.reviews || [];
  const employees = appData.employees || [];
  const filter = document.getElementById('filterReviewsStatus')?.value || 'all';

  const filtered = filter === 'all' ? reviews : reviews.filter(r => {
    const isApproved = r.approved === true || r.status === 'approved';
    const isHidden = r.status === 'hidden';
    if (filter === 'approved') return isApproved && !isHidden;
    if (filter === 'pending') return !isApproved && !isHidden;
    if (filter === 'hidden') return isHidden;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--adm-text-muted); padding: 2.5rem;">لا توجد تقييمات مطابقة لهذا الفلتر.</td></tr>`;
    return;
  }

  filtered.forEach(rev => {
    const emp = employees.find(e => e.id === rev.employeeId);
    const tr = document.createElement('tr');
    const dateStr = rev.createdAt ? new Date(rev.createdAt).toLocaleString('ar-SA') : '-';

    // Stars
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= rev.rating) {
        starsHtml += '<i class="fa-solid fa-star" style="color: #f59e0b;"></i>';
      } else {
        starsHtml += '<i class="fa-regular fa-star" style="color: #64748b;"></i>';
      }
    }

    // Status label & class
    const isApproved = rev.approved === true || rev.status === 'approved';
    const isHidden = rev.status === 'hidden';
    let badgeClass = 'new';
    let statusLabel = 'بانتظار المراجعة';
    if (isHidden) {
      badgeClass = 'cancelled';
      statusLabel = 'مخفي';
    } else if (isApproved) {
      badgeClass = 'active';
      statusLabel = 'معتمد ومقبول';
    }

    tr.innerHTML = `
      <td><strong>${escapeHtml(rev.clientName || 'عميل')}</strong></td>
      <td><span dir="ltr">${escapeHtml(rev.clientPhone || '-')}</span></td>
      <td>${emp ? `<span style="color: var(--adm-accent); font-weight: 600;">${escapeHtml(emp.name)}</span>` : '-'}</td>
      <td>
        <div style="display: flex; gap: 2px; align-items: center;">
          ${starsHtml}
          <span style="font-size: 0.8rem; font-weight: 700; margin-right: 0.35rem; color: #fff;">(${Number(rev.rating) || 5}/5)</span>
        </div>
      </td>
      <td style="max-width: 320px; font-size: 0.875rem; color: #cbd5e1;">${rev.comment ? escapeHtml(rev.comment) : '<em style="color: var(--adm-text-muted);">بدون تعليق</em>'}</td>
      <td style="font-size: 0.8rem; color: var(--adm-text-muted);">${dateStr}</td>
      <td>
        <span class="status-badge ${badgeClass}">${statusLabel}</span>
      </td>
      <td>
        <div class="action-buttons">
          ${!isApproved ? `
            <button class="btn-adm btn-adm-primary btn-adm-sm" onclick="updateReviewStatus('${escapeHtml(rev.id)}', 'approved')" title="اعتماد التقييم"><i class="fa-solid fa-check"></i> اعتماد</button>
          ` : `
            <button class="btn-adm btn-adm-secondary btn-adm-sm" onclick="updateReviewStatus('${escapeHtml(rev.id)}', 'hidden')" title="إخفاء التقييم"><i class="fa-solid fa-eye-slash"></i> إخفاء</button>
          `}
          <button class="btn-adm btn-adm-danger btn-adm-sm" onclick="deleteReview('${escapeHtml(rev.id)}')" title="حذف"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function updateReviewStatus(id, newStatus) {
  const rev = (appData.reviews || []).find(r => r.id === id);
  if (!rev) return;

  rev.status = newStatus;
  rev.approved = (newStatus === 'approved');

  if (isBackendAvailable) {
    try {
      await fetch(`/api/reviews/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderReviewsTable();
  renderNfcStats();
  showToast(newStatus === 'approved' ? 'تم اعتماد التقييم بنجاح!' : 'تم تحديث حالة التقييم!');
}

async function deleteReview(id) {
  if (!confirm('هل تريد بالتأكيد حذف هذا التقييم؟')) return;

  appData.reviews = (appData.reviews || []).filter(r => r.id !== id);

  if (isBackendAvailable) {
    try {
      await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (e) { console.error(e); }
  }

  saveLocalCache();
  renderReviewsTable();
  renderNfcStats();
  showToast('تم حذف التقييم بنجاح!');
}

// Window attachments for inline HTML onclick handlers
window.openEmployeeModal = openEmployeeModal;
window.closeEmployeeModal = closeEmployeeModal;
window.deleteEmployee = deleteEmployee;
window.openCardModal = openCardModal;
window.closeCardModal = closeCardModal;
window.toggleCardStatus = toggleCardStatus;
window.deleteCard = deleteCard;
window.openQrModal = openQrModal;
window.closeQrModal = closeQrModal;
window.copyQrUrl = copyQrUrl;
window.copyCardLink = copyCardLink;
window.printQrCard = printQrCard;
window.updateReviewStatus = updateReviewStatus;
window.deleteReview = deleteReview;
window.removeCompanyLogo = removeCompanyLogo;
window.removeEmpPhoto = removeEmpPhoto;

// ==========================================================================
// 11. SECURITY & ADMIN ACCOUNT SETTINGS
// ==========================================================================

function initSecurityTab() {
  renderAdminProfile();

  // 1. Change Password Form
  document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword.length < 8) {
      alert('كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    const btn = document.getElementById('btnChangePassword');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحديث...';

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('تم تحديث كلمة المرور بنجاح وحفظها بتشفير آمن!');
        document.getElementById('changePasswordForm').reset();
      } else {
        alert(data.message || 'فشل تحديث كلمة المرور، يرجى التأكد من كلمة المرور الحالية.');
      }
    } catch (err) {
      alert('حدث خطأ أثناء محاولة تحديث كلمة المرور.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>تحديث كلمة المرور</span>';
    }
  });

  // 2. Start 2FA Setup
  document.getElementById('btnStart2fa')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnStart2fa');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري إنشاء المفتاح...';

    try {
      const res = await fetch('/api/auth/2fa/generate', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        document.getElementById('qr2faImage').src = data.qrCode;
        document.getElementById('text2faSecret').textContent = data.secret;
        document.getElementById('input2faCode').value = '';
        document.getElementById('modal2fa').classList.add('show');
      } else {
        alert(data.message || 'تعذر إنشاء رمز التحقق الثنائي.');
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-qrcode"></i> <span>تفعيل التحقق بخطوتين (2FA)</span>';
    }
  });

  // 3. Confirm & Enable 2FA
  document.getElementById('formConfirm2fa')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('input2faCode').value.trim();
    const btn = document.getElementById('btnSubmitConfirm2fa');

    if (!code || code.length !== 6) {
      alert('يرجى إدخال الرمز السداسي.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';

    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        close2faModal();
        if (currentAdminUser) currentAdminUser.twoFactorEnabled = true;
        renderAdminProfile();
        showToast('تم تفعيل ميزة التحقق بخطوتين بنجاح!');
      } else {
        alert(data.message || 'الرمز غير صحيح، يرجى المحاولة مرة أخرى.');
      }
    } catch (err) {
      alert('حدث خطأ في الاتصال.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'تأكيد وتفعيل';
    }
  });

  // 4. Disable 2FA
  document.getElementById('btnDisable2fa')?.addEventListener('click', async () => {
    const password = prompt('يرجى كتابة كلمة المرور الخاصة بك لتأكيد إلغاء التحقق بخطوتين:');
    if (!password) return;

    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (currentAdminUser) currentAdminUser.twoFactorEnabled = false;
        renderAdminProfile();
        showToast('تم تعطيل ميزة التحقق بخطوتين.');
      } else {
        alert(data.message || 'تعذر التعطيل، يرجى التأكد من كلمة المرور.');
      }
    } catch (err) {
      alert('حدث خطأ في الاتصال.');
    }
  });

  // 5. Manual Backup
  document.getElementById('btnManualBackup')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnManualBackup');
    const statusText = document.getElementById('backupStatusText');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري إنشاء النسخة الاحتياطية...';

    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        statusText.style.display = 'block';
        statusText.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${data.message}`;
        showToast('تم حفظ النسخة الاحتياطية بنجاح!');
      } else {
        alert(data.message || 'فشل إنشاء النسخة الاحتياطية.');
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-download"></i> <span>إنشاء نسخة احتياطية فورية الآن</span>';
    }
  });
}

function renderAdminProfile() {
  if (!currentAdminUser) return;
  const nameEl = document.getElementById('secAdminName');
  const emailEl = document.getElementById('secAdminEmail');
  const createdEl = document.getElementById('secAdminCreatedAt');
  const badge2fa = document.getElementById('sec2faBadge');
  const boxDisabled = document.getElementById('box2faDisabled');
  const boxEnabled = document.getElementById('box2faEnabled');

  if (nameEl) nameEl.textContent = currentAdminUser.name || 'مدير النظام';
  if (emailEl) emailEl.textContent = currentAdminUser.email || '-';
  if (createdEl) {
    createdEl.textContent = currentAdminUser.createdAt ? new Date(currentAdminUser.createdAt).toLocaleDateString('ar-SA') : 'الآن';
  }

  if (badge2fa && boxDisabled && boxEnabled) {
    if (currentAdminUser.twoFactorEnabled) {
      badge2fa.textContent = 'مفعّل ومحمي';
      badge2fa.className = 'status-badge active';
      boxDisabled.style.display = 'none';
      boxEnabled.style.display = 'block';
    } else {
      badge2fa.textContent = 'غير مفعّل';
      badge2fa.className = 'status-badge cancelled';
      boxDisabled.style.display = 'block';
      boxEnabled.style.display = 'none';
    }
  }
}

function close2faModal() {
  document.getElementById('modal2fa')?.classList.remove('show');
}
window.close2faModal = close2faModal;

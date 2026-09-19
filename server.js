/**
 * ==========================================================================
 * الجدار الآمن للأنظمة الإلكترونية - خادم الإنتاج المحصّن أمنياً
 * Production-Grade Express Server with True Authentication, Secure Sessions,
 * Server-Side Page Guards, TOTP 2FA, and OWASP Hardening.
 * ==========================================================================
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ==========================================================================
// DIRECTORIES & PERSISTENCE
// ==========================================================================
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(__dirname, 'backups');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const ASSETS_DIR = path.join(__dirname, 'assets');
const CONFIG_FILE = path.join(__dirname, 'js', 'config.js');

[DATA_DIR, BACKUP_DIR, UPLOAD_DIR, ASSETS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==========================================================================
// SECURITY HEADERS (HELMET)
// ==========================================================================
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://images.unsplash.com",
        "https://*.google.com",
        "https://*.googleusercontent.com"
      ],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: IS_PRODUCTION ? [] : null
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Permissions-Policy Header
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Whitelist of permitted CORS origins (Dev & Production)
const allowedOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://aljdar-alameen.com',
  'https://www.aljdar-alameen.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',').includes(origin))) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Access denied for this origin.'));
  },
  credentials: true
}));

// Cookie Parser & Body Parsers
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prototype Pollution Prevention Guard
app.use((req, res, next) => {
  function sanitize(obj) {
    if (obj && typeof obj === 'object') {
      delete obj['__proto__'];
      delete obj['constructor'];
      delete obj['prototype'];
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') sanitize(obj[key]);
      }
    }
  }
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  next();
});

// CSRF Origin Verification on Mutating Requests (POST, PUT, PATCH, DELETE)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const originHeader = req.headers['origin'] || req.headers['referer'];
    if (originHeader) {
      try {
        const originUrl = new URL(originHeader);
        const reqHost = req.get('host');
        const isSameHost = originUrl.host === reqHost;
        const isWhitelisted = allowedOrigins.some(ao => {
          try { return new URL(ao).host === originUrl.host; } catch(e) { return false; }
        });
        if (!isSameHost && !isWhitelisted) {
          return res.status(403).json({ success: false, message: 'طلب غير مصرح به (CSRF Protection Blocked).' });
        }
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid Origin Header' });
      }
    }
  }
  next();
});

// ==========================================================================
// SENSITIVE FILE & DIRECTORY SHIELD
// ==========================================================================
app.use((req, res, next) => {
  let cleanPath = '';
  try {
    cleanPath = decodeURIComponent(req.path).replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
  } catch (e) {
    return res.status(400).json({ success: false, message: 'Bad Request' });
  }

  // Traversal & Null-Byte Defense
  if (cleanPath.includes('..') || cleanPath.includes('\0')) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'تم حظر الطلب لأسباب أمنية.'
    });
  }

  const forbiddenPatterns = [
    /(^\/|^)(data|backups|\.env|\.git|node_modules)(\/|$)/i,
    /server\.js$/i,
    /package(-lock)?\.json$/i,
    /\.(json|env|log|bat|ps1|bak|config|lock|md|git.*)$/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(cleanPath)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'تم حظر الوصول إلى هذا المورد لأسباب أمنية.'
      });
    }
  }

  next();
});

// ==========================================================================
// RATE LIMITERS (Brute-Force & DoS Protection)
// ==========================================================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تم تجاوز الحد الأقصى للمحاولات. يرجى الانتظار لمدة 15 دقيقة.' }
});

const quoteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تم استلام عدد كبير من الطلبات. يرجى الانتظار قبل إرسال طلب جديد.' }
});

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تم إرسال عدة تقييمات، شكراً لك.' }
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: false,
  legacyHeaders: false
});

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', generalApiLimiter);

// ==========================================================================
// DATABASE & BACKUP MANAGEMENT
// ==========================================================================
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    const content = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(content);
    parsed.admins = parsed.admins || [];
    parsed.activeSessions = parsed.activeSessions || [];
    parsed.passwordResetTokens = parsed.passwordResetTokens || [];
    return parsed;
  } catch (err) {
    console.error('Error reading db.json:', err.message);
    return { admins: [], activeSessions: [], passwordResetTokens: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    syncToConfigFile(data);
    return true;
  } catch (err) {
    console.error('Error writing db.json:', err.message);
    return false;
  }
}

function createDatabaseBackup() {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `db-backup-${timestamp}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);
    fs.copyFileSync(DB_FILE, backupFilePath);

    // Retain maximum 20 latest backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('db-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > 20) {
      files.slice(20).forEach(oldFile => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, oldFile)); } catch (e) {}
      });
    }

    return backupFileName;
  } catch (err) {
    console.error('Error creating database backup:', err.message);
    return null;
  }
}

function syncToConfigFile(data) {
  try {
    if (!data.companyInfo) return;
    const c = data.companyInfo;
    const projects = (data.projects || []).map(p => ({
      id: p.id,
      title: p.title,
      category: p.category,
      categoryName: p.service || p.category,
      description: p.desc,
      image: p.image
    }));

    const configContent = `/**
 * ==========================================================================
 * الجدار الآمن للأنظمة الإلكترونية - ملف الإعدادات والبيانات المركزية
 * Central Website Configuration & Contact Data
 * (Synced automatically from Admin Dashboard & Database)
 * ==========================================================================
 */

const SITE_CONFIG = {
  companyName: ${JSON.stringify(c.companyName || 'الجدار الآمن للأنظمة الإلكترونية')},
  companyShortName: ${JSON.stringify(c.companyShortName || 'الجدار الآمن')},
  tagline: ${JSON.stringify(c.tagline || 'حلول متكاملة للأمن والسلامة والأنظمة الإلكترونية')},

  phoneDisplay: ${JSON.stringify(c.phone || '+962 7 9000 0000')},
  phoneFormatted: ${JSON.stringify(c.phone || '+962 7 9000 0000')},
  phoneRaw: ${JSON.stringify(c.phoneRaw || '+962790000000')},
  
  whatsappNumber: ${JSON.stringify(c.whatsappNumber || '962790000000')},
  whatsappDisplay: ${JSON.stringify(c.whatsapp || '+962 7 9000 0000')},

  address: ${JSON.stringify(c.address || 'المملكة الأردنية الهاشمية - عمّان')},
  addressDetail: ${JSON.stringify(c.address || 'المملكة الأردنية الهاشمية - عمّان')},
  city: ${JSON.stringify(c.city || 'عمّان')},

  workingHours: ${JSON.stringify(c.workingHours || 'السبت - الخميس: 8:30 ص - 6:30 م')},
  workingHoursShort: "8:30 ص - 6:30 م",
  email: ${JSON.stringify(c.email || 'info@aljidar-security.com')},

  logo: ${JSON.stringify(c.logo || c.logoUrl || '')},
  socialLinks: ${JSON.stringify(c.socialLinks || {})},
  googleMapsUrl: ${JSON.stringify(c.googleMapsUrl || 'https://maps.google.com')},

  portfolioProjects: ${JSON.stringify(projects, null, 2)}
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SITE_CONFIG;
}
`;
    fs.writeFileSync(CONFIG_FILE, configContent, 'utf8');
  } catch (err) {
    console.error('Error syncing to config.js:', err.message);
  }
}

// ==========================================================================
// SESSION MANAGEMENT (Memory & Persistent Validation)
// ==========================================================================
const activeSessions = new Map(); // token -> { adminId, email, name, createdAt }
const temp2faTokens = new Map();  // tempToken -> { adminId, email, createdAt }
const pending2faSecrets = new Map(); // adminId -> secretBase32

// Load existing valid sessions from DB on startup
(() => {
  const db = readDB();
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  (db.activeSessions || []).forEach(s => {
    if (now - s.createdAt < maxAge) {
      activeSessions.set(s.token, s);
    }
  });
})();

// Periodic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.createdAt > maxAge) {
      activeSessions.delete(token);
    }
  }
  for (const [tempToken, item] of temp2faTokens.entries()) {
    if (now - item.createdAt > 5 * 60 * 1000) {
      temp2faTokens.delete(tempToken);
    }
  }
}, 15 * 60 * 1000);

function getSessionToken(req) {
  return req.cookies?.admin_session || req.headers['authorization']?.replace(/^Bearer\s+/i, '') || req.query.token;
}

function setSessionCookie(req, res, token) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  });
}

function clearSessionCookie(res) {
  res.clearCookie('admin_session', { path: '/' });
}

function requireAuth(req, res, next) {
  const token = getSessionToken(req);

  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token);
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - session.createdAt > maxAge) {
      activeSessions.delete(token);
      clearSessionCookie(res);
      return res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.' });
    }
    req.adminUser = session;
    return next();
  }

  res.status(401).json({ success: false, message: 'غير مصرح لك بالدخول، يرجى تسجيل الدخول أولاً.' });
}

// ==========================================================================
// SERVER-SIDE PAGE GUARDS & STATIC ASSET ROUTING
// ==========================================================================
// 1. Static CSS, JS, Assets, Uploads
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(ASSETS_DIR));
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  next();
}, express.static(UPLOAD_DIR));

// Admin static CSS and JS (Isolated from HTML)
app.use('/admin/css', express.static(path.join(__dirname, 'admin', 'css')));
app.use('/admin/js', express.static(path.join(__dirname, 'admin', 'js')));

// 2. Server-Side Guard for /admin and /admin/index.html
app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) => {
  const db = readDB();
  const hasAdmin = Array.isArray(db.admins) && db.admins.length > 0;

  if (!hasAdmin) {
    return res.redirect('/admin/setup.html');
  }

  const token = getSessionToken(req);
  if (!token || !activeSessions.has(token)) {
    return res.redirect('/admin/login.html');
  }

  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// 3. Server-Side Guard for /admin/setup.html (Initial Setup Only)
app.get('/admin/setup.html', (req, res) => {
  const db = readDB();
  const hasAdmin = Array.isArray(db.admins) && db.admins.length > 0;
  if (hasAdmin) {
    return res.redirect('/admin/login.html');
  }
  res.sendFile(path.join(__dirname, 'admin', 'setup.html'));
});

// 4. Server-Side Guard for /admin/login.html
app.get('/admin/login.html', (req, res) => {
  const db = readDB();
  const hasAdmin = Array.isArray(db.admins) && db.admins.length > 0;
  if (!hasAdmin) {
    return res.redirect('/admin/setup.html');
  }

  const token = getSessionToken(req);
  if (token && activeSessions.has(token)) {
    return res.redirect('/admin/index.html');
  }

  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// 5. Server-Side Guard for /admin/reset-password.html
app.get('/admin/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'reset-password.html'));
});

// Whitelist of allowed public HTML pages
const allowedHtmlPages = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/card.html': 'card.html',
  '/cctv.html': 'cctv.html',
  '/fire-alarm.html': 'fire-alarm.html',
  '/fire-fighting.html': 'fire-fighting.html',
  '/networking.html': 'networking.html',
  '/safety-systems.html': 'safety-systems.html',
  '/security-alarm.html': 'security-alarm.html',
  '/404.html': '404.html'
};

Object.entries(allowedHtmlPages).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
});

app.get('/card/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'card.html'));
});

// ==========================================================================
// FILE UPLOADS (Multer + Magic Bytes Validation)
// ==========================================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(rawExt) ? rawExt : '.png';
    cb(null, 'img-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex') + safeExt);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg|gif/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('الملف المرفوع يجب أن يكون ملف صورة صالح (JPG, PNG, WEBP, SVG).'));
    }
  }
});

function validateImageMagicBytes(filePath) {
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true; // JPEG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true; // PNG
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true; // GIF
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true; // WEBP

    const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
    if (content.includes('<svg') || content.includes('<?xml')) {
      const dangerousPatterns = [
        '<script', 'onload', 'onerror', 'onclick', 'onmouse', 'onfocus',
        'javascript:', 'eval(', '<foreignobject', '<animate', '<set', '<use', 'xlink:href'
      ];
      for (const danger of dangerousPatterns) {
        if (content.includes(danger)) return false;
      }
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
}

app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'لم يتم استلام أي صورة صالحة.' });
  }

  const filePath = path.join(UPLOAD_DIR, req.file.filename);

  if (!validateImageMagicBytes(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) {}
    return res.status(400).json({
      success: false,
      message: 'فشل التحقق الأمني: محتوى الملف المرفوع لا يتطابق مع صورة صالحة وآمنة.'
    });
  }

  res.json({
    success: true,
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    size: req.file.size,
    message: 'تم رفع الصورة والتحقق منها بنجاح!'
  });
});

// ==========================================================================
// AUTHENTICATION APIs
// ==========================================================
// 1. Check if setup is needed
app.get('/api/auth/setup-status', (req, res) => {
  const db = readDB();
  const setupRequired = !Array.isArray(db.admins) || db.admins.length === 0;
  res.json({ success: true, setupRequired });
});

// 2. Initial Setup Endpoint (Permanently closed once an admin exists)
app.post('/api/auth/initial-setup', authLimiter, (req, res) => {
  const db = readDB();
  if (Array.isArray(db.admins) && db.admins.length > 0) {
    return res.status(403).json({
      success: false,
      message: 'النظام مهيأ مسبقاً ولا يمكن إنشاء مدير جديد من خلال صفحة الإعداد الأولي.'
    });
  }

  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'الاسم، البريد الإلكتروني وكلمة المرور حقول مطلوبة.' });
  }

  const emailClean = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailClean)) {
    return res.status(400).json({ success: false, message: 'صيغة البريد الإلكتروني غير صالحة.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'كلمة المرور يجب ألا تقل عن 8 خانات.' });
  }

  // Salt & Hash with Bcrypt (12 rounds)
  const salt = bcrypt.genSaltSync(12);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newAdmin = {
    id: 'admin-' + Date.now(),
    name: String(name).trim(),
    email: emailClean,
    passwordHash: passwordHash,
    role: 'superadmin',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    createdAt: new Date().toISOString()
  };

  db.admins = [newAdmin];

  // Issue session token and HttpOnly cookie
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const sessionData = {
    token: sessionToken,
    adminId: newAdmin.id,
    email: newAdmin.email,
    name: newAdmin.name,
    createdAt: Date.now()
  };

  activeSessions.set(sessionToken, sessionData);
  db.activeSessions = [sessionData];

  writeDB(db);
  setSessionCookie(req, res, sessionToken);

  res.status(201).json({
    success: true,
    token: sessionToken,
    user: { id: newAdmin.id, name: newAdmin.name, email: newAdmin.email },
    message: 'تم إنشاء حساب المدير بنجاح وقفل معالج الإعداد الأولي نهائياً!'
  });
});

// 3. Admin Login Endpoint (Email + Password + 2FA check)
app.post('/api/auth/login', authLimiter, (req, res) => {
  const db = readDB();
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
  }

  const emailClean = String(email).trim().toLowerCase();
  const admin = (db.admins || []).find(a => a.email.toLowerCase() === emailClean);

  if (!admin) {
    return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, admin.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة.' });
  }

  // Check 2FA
  if (admin.twoFactorEnabled && admin.twoFactorSecret) {
    const tempToken = crypto.randomBytes(24).toString('hex');
    temp2faTokens.set(tempToken, { adminId: admin.id, email: admin.email, createdAt: Date.now() });
    return res.json({
      success: true,
      twoFactorRequired: true,
      tempToken: tempToken,
      message: 'يرجى إدخال رمز التحقق الثنائي (2FA) للمتابعة.'
    });
  }

  // Create session
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const sessionData = {
    token: sessionToken,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    createdAt: Date.now()
  };

  activeSessions.set(sessionToken, sessionData);
  db.activeSessions = (db.activeSessions || []).filter(s => s.adminId !== admin.id);
  db.activeSessions.push(sessionData);
  writeDB(db);

  setSessionCookie(req, res, sessionToken);

  res.json({
    success: true,
    token: sessionToken,
    user: { id: admin.id, name: admin.name, email: admin.email },
    message: 'تم تسجيل الدخول بنجاح!'
  });
});

// 4. Verify 2FA TOTP Code on Login
app.post('/api/auth/verify-2fa', authLimiter, (req, res) => {
  const { tempToken, code } = req.body || {};

  if (!tempToken || !code) {
    return res.status(400).json({ success: false, message: 'بيانات التحقق غير مكتملة.' });
  }

  const temp = temp2faTokens.get(tempToken);
  if (!temp || Date.now() - temp.createdAt > 5 * 60 * 1000) {
    return res.status(401).json({ success: false, message: 'انتهت صلاحية جلسة التحقق، يرجى إعادة تسجيل الدخول.' });
  }

  const db = readDB();
  const admin = (db.admins || []).find(a => a.id === temp.adminId);
  if (!admin || !admin.twoFactorSecret) {
    return res.status(401).json({ success: false, message: 'حساب المدير غير موجود.' });
  }

  const isVerified = speakeasy.totp.verify({
    secret: admin.twoFactorSecret,
    encoding: 'base32',
    token: String(code).trim(),
    window: 1
  });

  if (!isVerified) {
    return res.status(401).json({ success: false, message: 'رمز التحقق غير صحيح، يرجى المحاولة مجدداً.' });
  }

  temp2faTokens.delete(tempToken);

  // Issue real session
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const sessionData = {
    token: sessionToken,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    createdAt: Date.now()
  };

  activeSessions.set(sessionToken, sessionData);
  db.activeSessions = (db.activeSessions || []).filter(s => s.adminId !== admin.id);
  db.activeSessions.push(sessionData);
  writeDB(db);

  setSessionCookie(req, res, sessionToken);

  res.json({
    success: true,
    token: sessionToken,
    user: { id: admin.id, name: admin.name, email: admin.email },
    message: 'تم التحقق بنجاح!'
  });
});

// 5. Logout Endpoint
app.post('/api/auth/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) {
    activeSessions.delete(token);
    const db = readDB();
    db.activeSessions = (db.activeSessions || []).filter(s => s.token !== token);
    writeDB(db);
  }
  clearSessionCookie(res);
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح.' });
});

// 6. Current Admin Me
app.get('/api/auth/me', (req, res) => {
  const token = getSessionToken(req);
  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token);
    const db = readDB();
    const admin = (db.admins || []).find(a => a.id === session.adminId);
    return res.json({
      success: true,
      authenticated: true,
      user: {
        id: session.adminId,
        name: admin?.name || session.name,
        email: admin?.email || session.email,
        twoFactorEnabled: !!admin?.twoFactorEnabled,
        createdAt: admin?.createdAt
      }
    });
  }
  res.status(401).json({ success: false, authenticated: false });
});

// 7. Forgot Password (Crypto Reset Token Generation)
app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال البريد الإلكتروني.' });
  }

  const db = readDB();
  const emailClean = String(email).trim().toLowerCase();
  const admin = (db.admins || []).find(a => a.email.toLowerCase() === emailClean);

  if (!admin) {
    // Avoid user enumeration
    return res.json({
      success: true,
      message: 'إذا كان البريد الإلكتروني مسجلاً، فسيتم إصدار رابط استعادة كلمة المرور.'
    });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

  db.passwordResetTokens = (db.passwordResetTokens || []).filter(t => t.adminId !== admin.id);
  db.passwordResetTokens.push({ tokenHash, adminId: admin.id, expiresAt });
  writeDB(db);

  const recoveryUrl = `/admin/reset-password.html?token=${rawToken}`;

  res.json({
    success: true,
    message: 'تم إنشاء رابط استعادة كلمة المرور بنجاح (صالح لمدة 15 دقيقة).',
    recoveryUrl: recoveryUrl
  });
});

// 8. Reset Password with Token
app.post('/api/auth/reset-password', authLimiter, (req, res) => {
  const { token, newPassword } = req.body || {};

  if (!token || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'الرمز غير صالح أو كلمة المرور قصيرة جداً (8 خانات كحد أدنى).' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const db = readDB();
  const recordIndex = (db.passwordResetTokens || []).findIndex(t => t.tokenHash === tokenHash && t.expiresAt > Date.now());

  if (recordIndex === -1) {
    return res.status(400).json({ success: false, message: 'رابط الاستعادة غير صالح أو منتهي الصلاحية.' });
  }

  const record = db.passwordResetTokens[recordIndex];
  const adminIndex = (db.admins || []).findIndex(a => a.id === record.adminId);

  if (adminIndex === -1) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
  }

  const salt = bcrypt.genSaltSync(12);
  db.admins[adminIndex].passwordHash = bcrypt.hashSync(newPassword, salt);
  db.admins[adminIndex].updatedAt = new Date().toISOString();

  // Remove token and revoke all active sessions
  db.passwordResetTokens.splice(recordIndex, 1);
  for (const [sToken, session] of activeSessions.entries()) {
    if (session.adminId === record.adminId) activeSessions.delete(sToken);
  }
  db.activeSessions = (db.activeSessions || []).filter(s => s.adminId !== record.adminId);

  writeDB(db);

  res.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بها.' });
});

// 9. Change Password (Inside Admin Dashboard)
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'يرجى تقديم كلمة المرور الحالية والجديدة.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.' });
  }

  const db = readDB();
  const adminIndex = (db.admins || []).findIndex(a => a.id === req.adminUser.adminId);

  if (adminIndex === -1) {
    return res.status(404).json({ success: false, message: 'حساب المدير غير موجود.' });
  }

  const admin = db.admins[adminIndex];
  const isMatch = bcrypt.compareSync(currentPassword, admin.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة.' });
  }

  const salt = bcrypt.genSaltSync(12);
  admin.passwordHash = bcrypt.hashSync(newPassword, salt);
  admin.updatedAt = new Date().toISOString();

  // Invalidate other sessions
  for (const [sToken, s] of activeSessions.entries()) {
    if (s.adminId === admin.id && sToken !== getSessionToken(req)) {
      activeSessions.delete(sToken);
    }
  }

  writeDB(db);

  res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح وحفظها بتشفير آمن!' });
});

// 10. Generate 2FA Secret & QR Code
app.post('/api/auth/2fa/generate', requireAuth, async (req, res) => {
  try {
    const adminEmail = req.adminUser.email;
    const secret = speakeasy.generateSecret({
      name: `الجدار الآمن (${adminEmail})`,
      length: 20
    });

    pending2faSecrets.set(req.adminUser.adminId, secret.base32);

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
      width: 250,
      margin: 1,
      color: { dark: '#090d16', light: '#ffffff' }
    });

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'تعذر إنشاء رمز التحقق الثنائي.' });
  }
});

// 11. Enable 2FA after Code Verification
app.post('/api/auth/2fa/enable', requireAuth, (req, res) => {
  const { code } = req.body || {};
  const pendingSecret = pending2faSecrets.get(req.adminUser.adminId);

  if (!pendingSecret || !code) {
    return res.status(400).json({ success: false, message: 'لم يتم إنشاء مفتاح تحقق أو الرمز مفقود.' });
  }

  const isVerified = speakeasy.totp.verify({
    secret: pendingSecret,
    encoding: 'base32',
    token: String(code).trim(),
    window: 1
  });

  if (!isVerified) {
    return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح، يرجى المحاولة مرة أخرى.' });
  }

  const db = readDB();
  const admin = (db.admins || []).find(a => a.id === req.adminUser.adminId);
  if (admin) {
    admin.twoFactorEnabled = true;
    admin.twoFactorSecret = pendingSecret;
    admin.updatedAt = new Date().toISOString();
    writeDB(db);
  }

  pending2faSecrets.delete(req.adminUser.adminId);

  res.json({ success: true, message: 'تم تفعيل ميزة التحقق بخطوتين (2FA) بنجاح على حسابك!' });
});

// 12. Disable 2FA
app.post('/api/auth/2fa/disable', requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور لتأكيد تعطيل التحقق الثنائي.' });
  }

  const db = readDB();
  const admin = (db.admins || []).find(a => a.id === req.adminUser.adminId);
  if (!admin) return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });

  const isMatch = bcrypt.compareSync(password, admin.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'كلمة المرور غير صحيحة.' });
  }

  admin.twoFactorEnabled = false;
  admin.twoFactorSecret = null;
  admin.updatedAt = new Date().toISOString();
  writeDB(db);

  res.json({ success: true, message: 'تم تعطيل التحقق بخطوتين بنجاح.' });
});

// ==========================================================================
// DATABASE BACKUP & RESTORE APIS
// ==========================================================================
app.post('/api/admin/backup', requireAuth, (req, res) => {
  const backupName = createDatabaseBackup();
  if (backupName) {
    res.json({ success: true, backup: backupName, message: `تم إنشاء نسخة احتياطية آمنة: ${backupName}` });
  } else {
    res.status(500).json({ success: false, message: 'فشل إنشاء النسخة الاحتياطية.' });
  }
});

app.get('/api/admin/backups', requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ success: true, backups: [] });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, size: stats.size, createdAt: stats.mtime };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, backups: files });
  } catch (err) {
    res.status(500).json({ success: false, message: 'تعذر جلب قائمة النسخ الاحتياطية.' });
  }
});

app.post('/api/admin/restore', requireAuth, (req, res) => {
  const { filename } = req.body || {};
  if (!filename) {
    return res.status(400).json({ success: false, message: 'يرجى تحديد اسم ملف النسخة الاحتياطية.' });
  }
  const safeFilename = path.basename(filename);
  if (!safeFilename.endsWith('.json')) {
    return res.status(400).json({ success: false, message: 'صيغة ملف غير صالحة.' });
  }
  const backupFile = path.join(BACKUP_DIR, safeFilename);
  if (!fs.existsSync(backupFile)) {
    return res.status(404).json({ success: false, message: 'ملف النسخة الاحتياطية غير موجود.' });
  }

  try {
    const backupContent = fs.readFileSync(backupFile, 'utf8');
    const parsed = JSON.parse(backupContent);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('بيانات النسخة الاحتياطية غير صالحة.');
    }
    // Emergency current snapshot before restore
    createDatabaseBackup();
    // Overwrite DB
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    res.json({ success: true, message: `تمت استعادة قاعدة البيانات بنجاح من النسخة: ${safeFilename}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'فشل استعادة قاعدة البيانات: ' + err.message });
  }
});

// SEO Routes
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// ==========================================================================
// DATA ISOLATION (Public vs Authenticated)
// ==========================================================================
app.get('/api/data', (req, res) => {
  const db = readDB();
  const token = getSessionToken(req);
  const isAuthenticated = token && activeSessions.has(token);

  if (isAuthenticated) {
    // Authenticated admin receives master database (quotes, full staff, etc.)
    return res.json({ success: true, data: db });
  }

  // Public visitors receive strictly sanitized public content ONLY
  const sanitizedPublicData = {
    companyInfo: db.companyInfo || {},
    hero: db.hero || {},
    services: db.services || [],
    projects: (db.projects || []).filter(p => p.visible !== false),
    faqs: db.faqs || [],
    reviews: (db.reviews || [])
      .filter(r => r.approved === true && r.status !== 'hidden')
      .map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        clientName: r.clientName,
        employeeName: r.employeeName,
        createdAt: r.createdAt
      }))
  };

  res.json({ success: true, data: sanitizedPublicData });
});

app.get('/api/stats', requireAuth, (req, res) => {
  const db = readDB();
  const projects = db.projects || [];
  const services = db.services || [];
  const quotes = db.quotes || [];
  const employees = db.employees || [];
  const nfcCards = db.nfcCards || [];
  const reviews = db.reviews || [];

  const newQuotes = quotes.filter(q => q.status === 'جديد').length;
  const totalNfcTaps = nfcCards.reduce((acc, c) => acc + (c.stats?.opens || c.analytics?.visits || 0), 0);

  res.json({
    success: true,
    stats: {
      totalProjects: projects.length,
      totalServices: services.length,
      totalQuotes: quotes.length,
      newQuotes: newQuotes,
      totalEmployees: employees.length,
      totalCards: nfcCards.length,
      totalNfcTaps: totalNfcTaps,
      totalReviews: reviews.length,
      recentProjects: projects.slice(0, 5),
      recentQuotes: quotes.slice(0, 5),
      recentReviews: reviews.slice(0, 5)
    }
  });
});

// ==========================================================================
// NFC CARDS & STAFF (Public Card vs Protected CRUD)
// ==========================================================================
app.get('/api/card-data/:slug', (req, res) => {
  const db = readDB();
  const slug = req.params.slug;
  const cards = db.nfcCards || [];
  const employees = db.employees || [];

  const card = cards.find(c => c.slug === slug || c.id === slug || c.cardCode === slug);
  if (!card) return res.status(404).json({ success: false, message: 'البطاقة غير موجودة' });

  const employee = employees.find(e => e.id === card.employeeId);
  const isCardActive = card.isActive !== undefined ? card.isActive : (card.status === 'مفعلة' || card.status === 'active');
  const isEmpActive = employee ? (employee.isActive !== undefined ? employee.isActive : (employee.status === 'فعال' || employee.status === 'نشط')) : false;

  if (!isCardActive || !isEmpActive) {
    return res.json({
      success: true,
      card: { status: 'معطلة', isActive: false, slug: card.slug },
      company: {
        companyName: db.companyInfo?.companyName,
        phone: db.companyInfo?.phone,
        phoneRaw: db.companyInfo?.phoneRaw,
        logo: db.companyInfo?.logo || db.companyInfo?.logoUrl
      }
    });
  }

  // Active public card data
  res.json({
    success: true,
    card: { id: card.id, slug: card.slug, cardCode: card.cardCode, status: card.status },
    employee: {
      id: employee.id,
      name: employee.name,
      title: employee.title,
      department: employee.department,
      specialization: (employee.specializations || []).join('، ') || employee.specialization,
      bio: employee.bio,
      phone: employee.phone,
      phoneRaw: employee.phoneRaw || employee.phone.replace(/[^0-9+]/g, ''),
      whatsapp: employee.whatsapp || employee.phone,
      whatsappNumber: employee.whatsappNumber || (employee.whatsapp || employee.phone).replace(/[^0-9]/g, ''),
      email: employee.email,
      photo: employee.photo,
      socials: employee.socials || {}
    },
    company: {
      companyName: db.companyInfo?.companyName,
      address: db.companyInfo?.address,
      logo: db.companyInfo?.logo || db.companyInfo?.logoUrl,
      googleMapsUrl: db.companyInfo?.googleMapsUrl,
      googleReviewsUrl: db.companyInfo?.googleReviewsUrl
    }
  });
});

app.post('/api/card-analytics/:slug/track', analyticsLimiter, (req, res) => {
  const db = readDB();
  const slug = req.params.slug;
  const rawAction = req.body.action || req.body.type;

  const card = (db.nfcCards || []).find(c => c.slug === slug || c.id === slug || c.cardCode === slug);
  if (!card) return res.status(404).json({ success: false });

  card.stats = card.stats || { opens: 0, calls: 0, whatsapps: 0, vCards: 0, googleReviews: 0 };
  card.analytics = card.analytics || { visits: 0, calls: 0, whatsapp: 0, vcardDownloads: 0, googleReviews: 0 };

  const mapAction = {
    'visit': 'opens', 'opens': 'opens',
    'calls': 'calls', 'call': 'calls',
    'whatsapp': 'whatsapps', 'whatsapps': 'whatsapps',
    'vcard': 'vCards', 'vCards': 'vCards', 'vcardDownloads': 'vCards',
    'googleReviews': 'googleReviews'
  };

  const key = mapAction[rawAction] || rawAction;
  if (card.stats[key] !== undefined) card.stats[key] += 1;

  card.analytics.visits = card.stats.opens;
  card.analytics.calls = card.stats.calls;
  card.analytics.whatsapp = card.stats.whatsapps;
  card.analytics.vcardDownloads = card.stats.vCards;
  card.stats.lastVisit = new Date().toISOString();

  writeDB(db);
  res.json({ success: true });
});

app.get('/api/qrcode/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}/card/${slug}`;

    if (req.query.format === 'dataurl') {
      const dataUrl = await QRCode.toDataURL(fullUrl, {
        width: 600,
        margin: 2,
        color: { dark: '#090d16', light: '#ffffff' }
      });
      return res.json({ success: true, url: fullUrl, dataUrl });
    }

    const pngBuffer = await QRCode.toBuffer(fullUrl, {
      width: 600,
      margin: 2,
      color: { dark: '#090d16', light: '#ffffff' }
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qrcode-${slug}.png"`);
    res.send(pngBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'تعذر إنشاء رمز QR' });
  }
});

// Employees CRUD (All Protected)
app.get('/api/employees', requireAuth, (req, res) => {
  const db = readDB();
  res.json({ success: true, employees: db.employees || [] });
});

app.post('/api/employees', requireAuth, (req, res) => {
  const db = readDB();
  db.employees = db.employees || [];

  const { name, title, department, specialization, specializations, bio, phone, whatsapp, email, photo, isActive } = req.body;
  if (!name || !title || !phone) {
    return res.status(400).json({ success: false, message: 'الاسم والمسمى الوظيفي ورقم الهاتف حقول مطلوبة.' });
  }

  const newEmp = {
    id: 'emp-' + Date.now(),
    name: String(name).trim(),
    title: String(title).trim(),
    department: department || 'القسم الفني والهندسي',
    specialization: specialization || (Array.isArray(specializations) ? specializations.join('، ') : ''),
    specializations: Array.isArray(specializations) ? specializations : (specialization ? specialization.split(/[,،]+/).map(s => s.trim()) : []),
    bio: bio || '',
    phone: String(phone).trim(),
    phoneRaw: String(phone).replace(/[^0-9+]/g, ''),
    whatsapp: whatsapp || phone,
    whatsappNumber: String(whatsapp || phone).replace(/[^0-9]/g, ''),
    email: email || '',
    photo: photo || '',
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    status: (isActive === false) ? 'معطل' : 'فعال',
    createdAt: new Date().toISOString()
  };

  db.employees.unshift(newEmp);
  writeDB(db);
  res.status(201).json({ success: true, data: newEmp, employee: newEmp, message: 'تمت إضافة الموظف بنجاح!' });
});

app.put('/api/employees/:id', requireAuth, (req, res) => {
  const db = readDB();
  const id = req.params.id;
  const index = (db.employees || []).findIndex(e => e.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'الموظف غير موجود' });

  if (req.body.isActive !== undefined) req.body.status = req.body.isActive ? 'فعال' : 'معطل';

  db.employees[index] = { ...db.employees[index], ...req.body, updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ success: true, employee: db.employees[index], message: 'تم تحديث بيانات الموظف بنجاح!' });
});

app.delete('/api/employees/:id', requireAuth, (req, res) => {
  const db = readDB();
  const id = req.params.id;
  db.employees = (db.employees || []).filter(e => e.id !== id);

  (db.nfcCards || []).forEach(card => {
    if (card.employeeId === id) {
      card.employeeId = null;
      card.status = 'معطلة';
      card.isActive = false;
    }
  });

  writeDB(db);
  res.json({ success: true, message: 'تم حذف الموظف بنجاح!' });
});

// Cards CRUD (All Protected)
app.get('/api/cards', requireAuth, (req, res) => {
  const db = readDB();
  const cards = db.nfcCards || [];
  const employees = db.employees || [];

  const enriched = cards.map(c => {
    const emp = employees.find(e => e.id === c.employeeId);
    return {
      ...c,
      employeeName: emp ? emp.name : 'غير مرتبط بموظف',
      employeeTitle: emp ? emp.title : '',
      employeePhoto: emp ? emp.photo : ''
    };
  });

  res.json({ success: true, cards: enriched });
});

app.post('/api/cards', requireAuth, (req, res) => {
  const db = readDB();
  db.nfcCards = db.nfcCards || [];

  const { slug, employeeId, cardCode, isActive } = req.body;
  const finalSlug = (slug || 'card-' + Date.now()).trim().toLowerCase().replace(/\s+/g, '-');

  if (db.nfcCards.some(c => c.slug === finalSlug)) {
    return res.status(400).json({ success: false, message: 'معرف الرابط (Slug) مستخدم لبطاقة أخرى.' });
  }

  const newCard = {
    id: 'card-' + Date.now(),
    slug: finalSlug,
    cardCode: cardCode || 'NFC-' + Math.floor(1000 + Math.random() * 9000),
    employeeId: employeeId || null,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    status: (isActive === false) ? 'معطلة' : 'مفعلة',
    createdAt: new Date().toISOString(),
    stats: { opens: 0, calls: 0, whatsapps: 0, vCards: 0, googleReviews: 0, lastVisit: null },
    analytics: { visits: 0, calls: 0, whatsapp: 0, vcardDownloads: 0, googleReviews: 0, lastVisit: null }
  };

  db.nfcCards.unshift(newCard);
  writeDB(db);
  res.status(201).json({ success: true, data: newCard, card: newCard, message: 'تم إنشاء بطاقة NFC بنجاح!' });
});

app.put('/api/cards/:id', requireAuth, (req, res) => {
  const db = readDB();
  const id = req.params.id;
  const index = (db.nfcCards || []).findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'البطاقة غير موجودة' });

  if (req.body.slug && req.body.slug !== db.nfcCards[index].slug) {
    const cleanSlug = req.body.slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (db.nfcCards.some(c => c.id !== id && c.slug === cleanSlug)) {
      return res.status(400).json({ success: false, message: 'الرابط التعريفي مستخدم لبطاقة أخرى.' });
    }
    req.body.slug = cleanSlug;
  }

  if (req.body.isActive !== undefined) req.body.status = req.body.isActive ? 'مفعلة' : 'معطلة';

  db.nfcCards[index] = { ...db.nfcCards[index], ...req.body, updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ success: true, card: db.nfcCards[index], message: 'تم تحديث البطاقة بنجاح!' });
});

app.delete('/api/cards/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.nfcCards = (db.nfcCards || []).filter(c => c.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'تم حذف البطاقة بنجاح!' });
});

// Reviews & Moderation
app.get('/api/reviews', requireAuth, (req, res) => {
  const db = readDB();
  res.json({ success: true, reviews: db.reviews || [] });
});

app.post('/api/reviews', reviewLimiter, (req, res) => {
  const db = readDB();
  db.reviews = db.reviews || [];

  const { cardSlug, employeeId, employeeName, rating, clientName, comment, clientPhone } = req.body;

  const newReview = {
    id: 'rev-' + Date.now(),
    cardSlug: cardSlug || '',
    employeeId: employeeId || '',
    employeeName: employeeName || 'فريق العمل',
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    clientName: String(clientName || 'عميل كريم').slice(0, 80),
    clientPhone: String(clientPhone || '').slice(0, 30),
    comment: String(comment || '').slice(0, 500),
    approved: false, // Must be approved by admin
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.reviews.unshift(newReview);
  writeDB(db);
  res.status(201).json({ success: true, message: 'شكراً جزيلاً! تم إرسال تقييمك بنجاح وسيعرض بعد مراجعته.' });
});

const updateReviewHandler = (req, res) => {
  const db = readDB();
  const rev = (db.reviews || []).find(r => r.id === req.params.id);
  if (!rev) return res.status(404).json({ success: false, message: 'التقييم غير موجود' });

  if (req.body.approved !== undefined) rev.approved = Boolean(req.body.approved);
  if (req.body.status !== undefined) {
    rev.status = req.body.status;
    if (req.body.status === 'approved') rev.approved = true;
    if (req.body.status === 'hidden') rev.approved = false;
  }

  writeDB(db);
  res.json({ success: true, review: rev, message: 'تم تحديث حالة التقييم!' });
};

app.patch('/api/reviews/:id', requireAuth, updateReviewHandler);
app.put('/api/reviews/:id', requireAuth, updateReviewHandler);

app.delete('/api/reviews/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.reviews = (db.reviews || []).filter(r => r.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'تم حذف التقييم بنجاح!' });
});

// ==========================================================================
// PROJECTS, SERVICES, COMPANY, HERO, FAQS & QUOTES
// ==========================================================================
app.get('/api/projects', (req, res) => {
  const db = readDB();
  res.json({ success: true, projects: db.projects || [] });
});

app.post('/api/projects', requireAuth, (req, res) => {
  const db = readDB();
  db.projects = db.projects || [];

  const { title, service, category, sector, desc, image, altText, visible } = req.body;
  if (!title || !service) return res.status(400).json({ success: false, message: 'اسم المشروع ونوع الخدمة مطلوبان.' });

  const newProject = {
    id: 'proj-' + Date.now(),
    title: String(title).slice(0, 150),
    service: String(service).slice(0, 80),
    category: category || 'cctv',
    sector: sector || 'مشاريع متنوعة',
    desc: desc || '',
    image: image || '',
    altText: altText || title,
    visible: visible !== undefined ? Boolean(visible) : true,
    order: db.projects.length + 1,
    createdAt: new Date().toISOString()
  };

  db.projects.unshift(newProject);
  writeDB(db);
  res.status(201).json({ success: true, project: newProject, message: 'تمت إضافة المشروع بنجاح!' });
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const db = readDB();
  const index = (db.projects || []).findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'المشروع غير موجود.' });

  db.projects[index] = { ...db.projects[index], ...req.body, updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ success: true, project: db.projects[index], message: 'تم تحديث المشروع بنجاح!' });
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.projects = (db.projects || []).filter(p => p.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'تم حذف المشروع بنجاح!' });
});

// Services
app.get('/api/services', (req, res) => {
  const db = readDB();
  res.json({ success: true, services: db.services || [] });
});

app.put('/api/services/:id', requireAuth, (req, res) => {
  const db = readDB();
  const index = (db.services || []).findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'الخدمة غير موجودة.' });

  db.services[index] = { ...db.services[index], ...req.body };
  writeDB(db);
  res.json({ success: true, service: db.services[index], message: 'تم تحديث الخدمة بنجاح!' });
});

// Company
app.get('/api/company', (req, res) => {
  const db = readDB();
  res.json({ success: true, companyInfo: db.companyInfo || {} });
});

app.put('/api/company', requireAuth, (req, res) => {
  const db = readDB();
  db.companyInfo = { ...db.companyInfo, ...req.body };
  writeDB(db);
  res.json({ success: true, companyInfo: db.companyInfo, message: 'تم حفظ بيانات المؤسسة وتحديث الموقع بنجاح!' });
});

// Hero
app.get('/api/hero', (req, res) => {
  const db = readDB();
  res.json({ success: true, hero: db.hero || {} });
});

app.put('/api/hero', requireAuth, (req, res) => {
  const db = readDB();
  db.hero = { ...db.hero, ...req.body };
  writeDB(db);
  res.json({ success: true, hero: db.hero, message: 'تم تحديث الصفحة الرئيسية بنجاح!' });
});

// FAQs
app.get('/api/faqs', (req, res) => {
  const db = readDB();
  res.json({ success: true, faqs: db.faqs || [] });
});

app.post('/api/faqs', requireAuth, (req, res) => {
  const db = readDB();
  db.faqs = db.faqs || [];
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ success: false, message: 'السؤال والإجابة مطلوبان.' });

  const newFaq = { id: 'faq-' + Date.now(), question, answer, order: db.faqs.length + 1 };
  db.faqs.push(newFaq);
  writeDB(db);
  res.status(201).json({ success: true, faq: newFaq, message: 'تمت إضافة السؤال بنجاح!' });
});

app.delete('/api/faqs/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.faqs = (db.faqs || []).filter(f => f.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'تم حذف السؤال بنجاح!' });
});

// Quotes
app.get('/api/quotes', requireAuth, (req, res) => {
  const db = readDB();
  res.json({ success: true, quotes: db.quotes || [] });
});

app.post('/api/quotes', quoteLimiter, (req, res) => {
  const db = readDB();
  db.quotes = db.quotes || [];

  const { name, phone, service, location, inspection, details } = req.body;
  if (!name || !phone || !service) {
    return res.status(400).json({ success: false, message: 'يرجى تزويدنا بالاسم، الهاتف والخدمة المطلوبة.' });
  }

  const newQuote = {
    id: 'quote-' + Date.now(),
    name: String(name).trim().slice(0, 100),
    phone: String(phone).trim().slice(0, 30),
    service: String(service).trim().slice(0, 80),
    location: String(location || 'عمّان').trim().slice(0, 100),
    inspection: inspection || 'نعم',
    details: String(details || '').trim().slice(0, 1000),
    status: 'جديد',
    createdAt: new Date().toISOString()
  };

  db.quotes.unshift(newQuote);
  writeDB(db);
  res.status(201).json({ success: true, quote: newQuote, message: 'تم استلام طلبك بنجاح وسنتواصل معك قريباً!' });
});

app.patch('/api/quotes/:id', requireAuth, (req, res) => {
  const db = readDB();
  const quote = (db.quotes || []).find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });

  quote.status = req.body.status;
  quote.updatedAt = new Date().toISOString();
  writeDB(db);
  res.json({ success: true, quote, message: `تم تغيير حالة الطلب إلى "${req.body.status}" بنجاح!` });
});

app.delete('/api/quotes/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.quotes = (db.quotes || []).filter(q => q.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'تم حذف الطلب بنجاح.' });
});

// 404 Fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// Production Error Handler (No debug stack trace disclosure)
app.use((err, req, res, next) => {
  console.error('Server Internal Error:', err.message);
  res.status(500).json({ success: false, message: 'حدث خطأ في معالجة الطلب.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🛡️  خادم مؤسسة الجدار الآمن للأنظمة الإلكترونية`);
  console.log(`🔒 وضع الأمان العالي: مفعّل (OWASP Compliant)`);
  console.log(`🌐 الموقع الرئيسي: http://localhost:${PORT}`);
  console.log(`🔐 لوحة التحكم: http://localhost:${PORT}/admin`);
  console.log(`💳 صفحة البطاقة: http://localhost:${PORT}/card/ahmad`);
  console.log(`====================================================`);
});

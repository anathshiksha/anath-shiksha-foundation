require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const multer     = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs         = require('fs');
const path       = require('path');
const Razorpay   = require('razorpay');
const crypto     = require('crypto');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const nodemailer = require('nodemailer');
const QRCode     = require('qrcode');
const xss        = require('xss');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc:         ["'self'", "data:", "blob:", "https://img.youtube.com", "https://images.unsplash.com"],
      connectSrc:     ["'self'"],
      frameSrc:       ["https://www.youtube.com", "https://checkout.razorpay.com"],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' },
  permittedCrossDomainPolicies: false
}));

// ── CORS — only allow same origin ────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// ── Body size limits ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static files ─────────────────────────────────────────────────────────────
app.use(express.static('public', {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Prevent browsers caching sensitive admin JS
    if (filePath.includes('admin.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }
}));

// ── Rate limiting — tiered ────────────────────────────────────────────────────
// General API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
// Strict limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' }
});
// Payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please try again in a few minutes.' }
});
// Contact/form submissions
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many form submissions. Please try again later.' }
});

app.use('/api/', generalLimiter);
app.use('/api/admin/login',      loginLimiter);
app.use('/api/payment/',         paymentLimiter);
app.use('/api/contact',          formLimiter);
app.use('/api/applications',     formLimiter);
app.use('/api/scholarship/apply', formLimiter);

// ── XSS sanitiser — cleans all incoming string fields ────────────────────────
function sanitiseObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') obj[key] = xss(obj[key].trim());
    else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) sanitiseObj(obj[key]);
  }
  return obj;
}
app.use((req, res, next) => { if (req.body) sanitiseObj(req.body); next(); });

// ── No-cache headers for API responses ───────────────────────────────────────
app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// ── Block common attack patterns ──────────────────────────────────────────────
app.use((req, res, next) => {
  const url = req.url.toLowerCase();
  // Block path traversal
  if (url.includes('..') || url.includes('%2e%2e')) return res.status(400).json({ error: 'Bad request' });
  // Block common probe paths
  const blockedPaths = ['/wp-admin', '/wp-login', '/phpmyadmin', '/.env', '/admin.php', '/xmlrpc', '/.git', '/config.php', '/shell', '/eval', '/exec'];
  if (blockedPaths.some(p => url.startsWith(p))) return res.status(404).json({ error: 'Not found' });
  // Block suspicious user-agents (scanners/bots)
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const badAgents = ['nikto', 'sqlmap', 'nmap', 'masscan', 'zgrab', 'nuclei', 'dirbuster', 'gobuster'];
  if (badAgents.some(b => ua.includes(b))) return res.status(403).json({ error: 'Forbidden' });
  next();
});

// ── Uploaded file validation ──────────────────────────────────────────────────
// (applied to multer below)

// ── Data file paths ──────────────────────────────────────────────────────────
const DATA_DIR          = path.join(__dirname, 'data');
const CONTENT_FILE      = path.join(DATA_DIR, 'content.json');
const EVENTS_FILE       = path.join(DATA_DIR, 'events.json');
const DONORS_FILE       = path.join(DATA_DIR, 'donors.json');
const ADMIN_FILE        = path.join(DATA_DIR, 'admin.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');
const GALLERY_FILE      = path.join(DATA_DIR, 'gallery.json');
const PAYMENT_FILE      = path.join(DATA_DIR, 'payment.json');
const MESSAGES_FILE     = path.join(DATA_DIR, 'messages.json');
const VIDEOS_FILE       = path.join(DATA_DIR, 'videos.json');
const SCHOLARSHIPS_FILE = path.join(DATA_DIR, 'scholarships.json');

// ── Multer — secure file uploads ─────────────────────────────────────────────
const ALLOWED_MIME = new Set(['image/jpeg','image/jpg','image/png','image/gif','image/webp']);
const ALLOWED_EXT  = /\.(jpeg|jpg|png|gif|webp)$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  // Rename with UUID — prevents original filename injection
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase())
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },  // max 4MB, 1 file
  fileFilter: (req, file, cb) => {
    // Double-check both MIME type AND extension
    const extOk  = ALLOWED_EXT.test(path.extname(file.originalname));
    const mimeOk = ALLOWED_MIME.has(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
});

// ── Razorpay ─────────────────────────────────────────────────────────────────
let razorpay;
try {
  razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID     || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
  });
} catch (e) { console.log('Razorpay note:', e.message); }

// ── Email transporter ────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

async function sendDonationReceipt(donor) {
  if (!process.env.EMAIL_USER || !donor.email) return;
  const receiptNo = 'ASF-' + Date.now().toString().slice(-8);
  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"/>
  <style>
    body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
    .card{background:#fff;max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}
    .header{background:linear-gradient(135deg,#FF6B35,#E55A25);padding:30px;text-align:center;color:#fff}
    .header h1{margin:0;font-size:24px}
    .header p{margin:5px 0 0;opacity:.9;font-size:14px}
    .body{padding:30px}
    .receipt-no{background:#fff7f4;border:1px dashed #FF6B35;border-radius:8px;padding:12px 20px;text-align:center;margin-bottom:24px}
    .receipt-no span{font-size:20px;font-weight:700;color:#FF6B35;letter-spacing:2px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    td{padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px}
    td:first-child{color:#888;font-weight:600;width:40%}
    td:last-child{color:#333;font-weight:500}
    .amount-row td{background:#fff7f4;font-size:16px}
    .amount-row td:last-child{color:#FF6B35;font-weight:700;font-size:18px}
    .footer{background:#1a1a2e;padding:20px;text-align:center;color:rgba(255,255,255,.7);font-size:12px}
    .footer a{color:#FF6B35}
    .ceo-sig{margin-top:24px;padding-top:20px;border-top:1px solid #f0f0f0;display:flex;align-items:center;gap:12px}
    .ceo-avatar{width:48px;height:48px;border-radius:50%;background:#FF6B35;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;flex-shrink:0}
    .badge-80g{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;display:inline-block;margin-top:16px}
    .thank-box{background:linear-gradient(135deg,#1a1a2e,#302b63);border-radius:8px;padding:20px;text-align:center;margin-bottom:24px}
    .thank-box h2{color:#F9C74F;margin:0 0 8px;font-size:22px}
    .thank-box p{color:rgba(255,255,255,.8);margin:0;font-size:14px}
  </style>
  </head>
  <body>
  <div class="card">
    <div class="header">
      <div style="font-size:40px;margin-bottom:8px">🌟</div>
      <h1>Anath Shiksha Foundation</h1>
      <p>Official Donation Receipt</p>
    </div>
    <div class="body">
      <div class="thank-box">
        <h2>Thank You, ${donor.name}! 🙏</h2>
        <p>Your generosity will transform a child's life forever.</p>
      </div>
      <div class="receipt-no">
        Receipt No: <span>${receiptNo}</span>
      </div>
      <table>
        <tr><td>Donor Name</td><td>${donor.name}</td></tr>
        <tr><td>Email</td><td>${donor.email}</td></tr>
        <tr><td>Phone</td><td>${donor.phone || '—'}</td></tr>
        <tr><td>Payment ID</td><td style="font-family:monospace">${donor.paymentId || '—'}</td></tr>
        <tr><td>Date & Time</td><td>${new Date(donor.date).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})}</td></tr>
        <tr class="amount-row"><td>Donation Amount</td><td>₹${Number(donor.amount).toLocaleString('en-IN')}</td></tr>
      </table>
      ${donor.message ? `<p style="background:#f9f9f9;padding:14px;border-radius:8px;font-style:italic;color:#555;font-size:14px">"${donor.message}"</p>` : ''}
      <div class="badge-80g">✅ Eligible for Tax Deduction under Section 80G of Income Tax Act</div>
      <div class="ceo-sig">
        <div class="ceo-avatar">A</div>
        <div>
          <div style="font-weight:700;color:#333;font-size:15px">Abhinav Singh</div>
          <div style="color:#888;font-size:13px">CEO & Founder, Anath Shiksha Foundation</div>
          <div style="color:#FF6B35;font-size:13px">📱 +91 7752923441</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Anath Shiksha Foundation | 80G & 12A Certified NGO</p>
      <p>📧 ${process.env.EMAIL_USER || 'info@anathshiksha.org'} | 🌐 anathshiksha.org</p>
      <p style="margin-top:8px;font-size:11px">This is an auto-generated receipt. Please keep it for your tax records.</p>
    </div>
  </div>
  </body>
  </html>`;

  try {
    await mailer.sendMail({
      from: `"Anath Shiksha Foundation" <${process.env.EMAIL_USER}>`,
      to:   donor.email,
      subject: `Donation Receipt ₹${Number(donor.amount).toLocaleString('en-IN')} — ${receiptNo} | Anath Shiksha Foundation`,
      html
    });
    console.log('Receipt sent to', donor.email);
  } catch(e) {
    console.log('Email note (configure EMAIL_USER/EMAIL_PASS in .env to enable):', e.message);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// ── Helpers ──────────────────────────────────────────────────────────────────
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}
function writeJSON(file, data) {
  // Validate data is serialisable before writing
  const str = JSON.stringify(data, null, 2);
  fs.writeFileSync(file, str, { mode: 0o600 });  // owner read/write only
}

// ── Auth middleware ───────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'anath_secret_2024_CHANGE_THIS';
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  if (!token || token === 'no-auth') return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch(e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ error: 'Session expired. Please login again.' });
    res.status(401).json({ error: 'Invalid token.' });
  }
}

// ── Input validator helper ────────────────────────────────────────────────────
function validateInput(obj, rules) {
  for (const [field, rule] of Object.entries(rules)) {
    const val = obj[field];
    if (rule.required && (!val || String(val).trim() === '')) return `${field} is required`;
    if (val && rule.maxLen && String(val).length > rule.maxLen) return `${field} is too long`;
    if (val && rule.pattern && !rule.pattern.test(String(val))) return `${field} has invalid format`;
  }
  return null;
}

// ── Global error handler ──────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err?.message));
process.on('uncaughtException',  (err) => console.error('Uncaught exception:', err?.message));

// ── Admin login ───────────────────────────────────────────────────────────────

// ── Ensure data + uploads dirs exist on first boot ───────────────────────────
[DATA_DIR, path.join(__dirname, 'public', 'uploads')].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
// Seed missing data files so cloud deploy works without git-tracked data
const defaultPayment = { upiId: 'anathshikshafoundation@ybl', qrImage: null, razorpayEnabled: true };
const SEEDS = {
  [EVENTS_FILE]:       [],
  [DONORS_FILE]:       [],
  [APPLICATIONS_FILE]: [],
  [GALLERY_FILE]:      [],
  [MESSAGES_FILE]:     [],
  [VIDEOS_FILE]:       [],
  [SCHOLARSHIPS_FILE]: [],
  [PAYMENT_FILE]:      defaultPayment
};
Object.entries(SEEDS).forEach(([file, def]) => {
  if (!fs.existsSync(file)) writeJSON(file, def);
});
if (!fs.existsSync(ADMIN_FILE)) {
  const bcrypt = require('bcryptjs');
  writeJSON(ADMIN_FILE, { username: 'admin', passwordHash: bcrypt.hashSync('Admin@2024', 10) });
  console.log('⚠️  Admin created: admin / Admin@2024 — change immediately!');
}
if (!fs.existsSync(CONTENT_FILE)) {
  // copy from default if missing
  const def = path.join(__dirname, 'data', 'content.default.json');
  if (fs.existsSync(def)) fs.copyFileSync(def, CONTENT_FILE);
}

// ── Public APIs ───────────────────────────────────────────────────────────────

app.get('/api/content', (req, res) => res.json(readJSON(CONTENT_FILE)));

app.get('/api/events', (req, res) => {
  const events = readJSON(EVENTS_FILE) || [];
  res.json(events.sort((a, b) => new Date(a.date) - new Date(b.date)));
});

// Only confirmed donors visible on public site (top 10)
app.get('/api/donors', (req, res) => {
  const donors = readJSON(DONORS_FILE) || [];
  const top10  = donors
    .filter(d => d.public && d.confirmed)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(d => ({
      name:    d.name,
      amount:  d.amount,
      date:    d.date,
      message: d.message || '',
      photo:   d.photo   || null
    }));
  res.json(top10);
});

// ── Public: payment settings (UPI ID + custom QR) ────────────────────────────
app.get('/api/payment/settings', (req, res) => {
  const p = readJSON(PAYMENT_FILE) || {};
  res.json({ upiId: p.upiId || 'anathshikshafoundation@ybl', qrImage: p.qrImage || null });
});

// ── UPI QR code generation ────────────────────────────────────────────────────
app.get('/api/payment/upi-qr', async (req, res) => {
  const amount = parseFloat(req.query.amount) || 0;
  const p      = readJSON(PAYMENT_FILE) || {};
  const upiId  = p.upiId || process.env.UPI_ID || 'anathshikshafoundation@ybl';
  const name   = encodeURIComponent('Anath Shiksha Foundation');
  const upiStr = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=Donation`;
  try {
    const qr = await QRCode.toDataURL(upiStr, { width: 280, margin: 2, color: { dark: '#1a1a2e', light: '#fff' } });
    res.json({ qr, upiId, upiStr, customQr: p.qrImage || null });
  } catch(e) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// ── Payment: create Razorpay order ────────────────────────────────────────────
app.post('/api/payment/create-order', async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  uuidv4()
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    const fakeOrderId = 'order_demo_' + uuidv4().slice(0, 8);
    res.json({ orderId: fakeOrderId, amount: Math.round(amount * 100), currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID, demo: true });
  }
});

// ── Payment: verify & record (pending confirmation) ───────────────────────────
app.post('/api/payment/verify', upload.single('photo'), (req, res) => {
  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    name, email, phone, amount, message, isPublic, paymentMethod
  } = req.body;

  if (razorpay_order_id && !razorpay_order_id.startsWith('order_demo_') && razorpay_signature) {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
      .update(body).digest('hex');
    if (expected !== razorpay_signature)
      return res.status(400).json({ error: 'Payment verification failed' });
  }

  const donors = readJSON(DONORS_FILE) || [];
  const donor = {
    id:            uuidv4(),
    name:          name          || 'Anonymous',
    email:         email         || '',
    phone:         phone         || '',
    amount:        parseFloat(amount),
    message:       message       || '',
    public:        isPublic !== 'false' && isPublic !== false,
    paymentMethod: paymentMethod || 'online',
    orderId:       razorpay_order_id  || '',
    paymentId:     razorpay_payment_id || '',
    photo:         req.file ? '/uploads/' + req.file.filename : null,
    confirmed:     false,           // ← admin must confirm
    date:          new Date().toISOString()
  };
  donors.push(donor);
  writeJSON(DONORS_FILE, donors);

  // Send receipt email regardless (payment received even if display pending)
  sendDonationReceipt(donor);

  res.json({ success: true, message: 'Thank you! Your donation has been received. A receipt has been sent to your email. Your name will appear on the website once the admin confirms the payment.' });
});

// ── UPI manual payment record ─────────────────────────────────────────────────
app.post('/api/payment/upi-record', upload.single('photo'), (req, res) => {
  const { name, email, phone, amount, message, isPublic, utrNumber } = req.body;
  if (!name || !amount) return res.status(400).json({ error: 'Name and amount required' });

  const donors = readJSON(DONORS_FILE) || [];
  const donor = {
    id:            uuidv4(),
    name:          name   || 'Anonymous',
    email:         email  || '',
    phone:         phone  || '',
    amount:        parseFloat(amount),
    message:       message || '',
    public:        isPublic !== 'false' && isPublic !== false,
    paymentMethod: 'UPI',
    utrNumber:     utrNumber || '',
    orderId:       'upi_' + uuidv4().slice(0, 8),
    paymentId:     'utr_' + (utrNumber || 'pending'),
    photo:         req.file ? '/uploads/' + req.file.filename : null,
    confirmed:     false,
    date:          new Date().toISOString()
  };
  donors.push(donor);
  writeJSON(DONORS_FILE, donors);
  sendDonationReceipt(donor);
  res.json({ success: true, message: 'UPI payment recorded! Admin will verify and confirm shortly.' });
});

// ── Admin login (after OTP verified) ─────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  // Input validation
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' });
  if (username.length > 50 || password.length > 200) return res.status(400).json({ error: 'Input too long' });

  const admin = readJSON(ADMIN_FILE);
  // Timing-safe comparison — always run bcrypt even if username wrong (prevents user enumeration)
  const dummyHash = '$2a$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu';
  const hashToCheck = (admin && admin.username === username) ? admin.passwordHash : dummyHash;
  const valid = bcrypt.compareSync(password, hashToCheck);
  if (!admin || admin.username !== username || !valid)
    return res.status(401).json({ error: 'Invalid username or password' });

  const token = jwt.sign({ username, iat: Math.floor(Date.now()/1000) }, JWT_SECRET, { expiresIn: '24h', algorithm: 'HS256' });
  res.json({ token, username });
});

app.put('/api/admin/content', auth, (req, res) => {
  const current = readJSON(CONTENT_FILE) || {};
  // Deep merge top-level keys so scholarship.exams/eligibility/process are preserved
  const merged = { ...current };
  for (const key of Object.keys(req.body)) {
    if (typeof req.body[key] === 'object' && !Array.isArray(req.body[key]) && req.body[key] !== null) {
      merged[key] = { ...(current[key] || {}), ...req.body[key] };
    } else {
      merged[key] = req.body[key];
    }
  }
  writeJSON(CONTENT_FILE, merged);
  res.json({ success: true });
});

app.post('/api/admin/upload', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// Upload CEO photo — saves to uploads and patches content.json
app.post('/api/admin/upload/ceo-photo', auth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url     = '/uploads/' + req.file.filename;
  const content = readJSON(CONTENT_FILE) || {};
  content.ceo   = { ...(content.ceo || {}), photo: url };
  writeJSON(CONTENT_FILE, content);
  res.json({ url });
});

// Clear CEO photo
app.delete('/api/admin/upload/ceo-photo', auth, (req, res) => {
  const content = readJSON(CONTENT_FILE) || {};
  if (content.ceo) { delete content.ceo.photo; writeJSON(CONTENT_FILE, content); }
  res.json({ success: true });
});

// Events CRUD
app.get('/api/admin/events',     auth, (req, res) => res.json(readJSON(EVENTS_FILE) || []));
app.post('/api/admin/events',    auth, (req, res) => {
  const events = readJSON(EVENTS_FILE) || [];
  const ev = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
  events.push(ev); writeJSON(EVENTS_FILE, events); res.json(ev);
});
app.put('/api/admin/events/:id', auth, (req, res) => {
  const events = readJSON(EVENTS_FILE) || [];
  const idx = events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  events[idx] = { ...events[idx], ...req.body }; writeJSON(EVENTS_FILE, events); res.json(events[idx]);
});
app.delete('/api/admin/events/:id', auth, (req, res) => {
  writeJSON(EVENTS_FILE, (readJSON(EVENTS_FILE) || []).filter(e => e.id !== req.params.id));
  res.json({ success: true });
});

// All donors (admin — includes unconfirmed)
app.get('/api/admin/donors', auth, (req, res) => {
  res.json((readJSON(DONORS_FILE) || []).sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// Admin confirm / unconfirm donor
app.put('/api/admin/donors/:id/confirm', auth, (req, res) => {
  const donors = readJSON(DONORS_FILE) || [];
  const idx = donors.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  donors[idx].confirmed = req.body.confirmed !== false;
  writeJSON(DONORS_FILE, donors);
  res.json({ success: true, confirmed: donors[idx].confirmed });
});

// Admin change password
app.put('/api/admin/password', auth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });
  const admin = readJSON(ADMIN_FILE);
  admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  writeJSON(ADMIN_FILE, admin);
  res.json({ success: true });
});

// Admin panel page
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── Applications ──────────────────────────────────────────────────────────────
app.post('/api/applications', (req, res) => {
  const { role, name, email, phone, city, qualification, availability, why, social } = req.body;
  if (!role || !name || !email || !phone || !why) return res.status(400).json({ error: 'Missing required fields' });
  const apps = readJSON(APPLICATIONS_FILE) || [];
  apps.push({ id: uuidv4(), role, name, email, phone, city: city||'', qualification: qualification||'', availability: availability||'', why, social: social||'', status: 'New', date: new Date().toISOString() });
  writeJSON(APPLICATIONS_FILE, apps);
  res.json({ success: true, message: 'Application received! We will contact you soon.' });
});
app.get('/api/admin/applications',      auth, (req, res) => res.json((readJSON(APPLICATIONS_FILE)||[]).sort((a,b)=>new Date(b.date)-new Date(a.date))));
app.put('/api/admin/applications/:id',  auth, (req, res) => {
  const apps = readJSON(APPLICATIONS_FILE)||[];
  const idx  = apps.findIndex(a => a.id === req.params.id);
  if (idx===-1) return res.status(404).json({error:'Not found'});
  apps[idx] = {...apps[idx],...req.body}; writeJSON(APPLICATIONS_FILE,apps); res.json(apps[idx]);
});
app.delete('/api/admin/applications/:id', auth, (req, res) => {
  writeJSON(APPLICATIONS_FILE, (readJSON(APPLICATIONS_FILE)||[]).filter(a=>a.id!==req.params.id));
  res.json({success:true});
});

// ── Gallery ───────────────────────────────────────────────────────────────────

// Public: get all gallery photos
app.get('/api/gallery', (req, res) => {
  res.json(readJSON(GALLERY_FILE) || []);
});

// Admin: upload a new gallery photo
app.post('/api/admin/gallery', auth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const gallery = readJSON(GALLERY_FILE) || [];
  const item = {
    id:        uuidv4(),
    url:       '/uploads/' + req.file.filename,
    caption:   req.body.caption || '',
    category:  req.body.category || 'General',
    uploadedAt: new Date().toISOString()
  };
  gallery.unshift(item);          // newest first
  writeJSON(GALLERY_FILE, gallery);
  res.json(item);
});

// Admin: update caption / category
app.put('/api/admin/gallery/:id', auth, (req, res) => {
  const gallery = readJSON(GALLERY_FILE) || [];
  const idx     = gallery.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  gallery[idx] = { ...gallery[idx], ...req.body };
  writeJSON(GALLERY_FILE, gallery);
  res.json(gallery[idx]);
});

// Admin: delete a gallery photo
app.delete('/api/admin/gallery/:id', auth, (req, res) => {
  const gallery = readJSON(GALLERY_FILE) || [];
  const item    = gallery.find(g => g.id === req.params.id);
  // Remove physical file
  if (item && item.url) {
    const filePath = path.join(__dirname, 'public', item.url);
    fs.unlink(filePath, () => {});
  }
  writeJSON(GALLERY_FILE, gallery.filter(g => g.id !== req.params.id));
  res.json({ success: true });
});

// ── Contact messages ──────────────────────────────────────────────────────────
// Public: submit contact message
app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'Name and message required' });
  const msgs = readJSON(MESSAGES_FILE) || [];
  msgs.unshift({ id: uuidv4(), name, email: email||'', phone: phone||'', subject: subject||'', message, read: false, date: new Date().toISOString() });
  writeJSON(MESSAGES_FILE, msgs);
  res.json({ success: true, whatsapp: buildWhatsApp(name, phone, subject, message) });
});
function buildWhatsApp(name, phone, subject, msg) {
  const number = (process.env.WHATSAPP_NUMBER || '917752923441').replace(/[^0-9]/g,'');
  const text = encodeURIComponent(`*New Contact Form Message*\n\n*Name:* ${name}\n*Phone:* ${phone||'—'}\n*Subject:* ${subject||'—'}\n\n*Message:*\n${msg}`);
  return `https://wa.me/${number}?text=${text}`;
}

// Admin: get all messages
app.get('/api/admin/messages', auth, (req, res) => res.json(readJSON(MESSAGES_FILE) || []));
// Admin: mark read
app.put('/api/admin/messages/:id/read', auth, (req, res) => {
  const msgs = readJSON(MESSAGES_FILE) || [];
  const idx  = msgs.findIndex(m => m.id === req.params.id);
  if (idx > -1) { msgs[idx].read = true; writeJSON(MESSAGES_FILE, msgs); }
  res.json({ success: true });
});
// Admin: delete message
app.delete('/api/admin/messages/:id', auth, (req, res) => {
  writeJSON(MESSAGES_FILE, (readJSON(MESSAGES_FILE)||[]).filter(m => m.id !== req.params.id));
  res.json({ success: true });
});

// ── Videos ────────────────────────────────────────────────────────────────────
// Public: get videos
app.get('/api/videos', (req, res) => res.json(readJSON(VIDEOS_FILE) || []));
app.get('/api/admin/videos', auth, (req, res) => res.json(readJSON(VIDEOS_FILE) || []));
// Update video (title, type)
app.put('/api/admin/videos/:id', auth, (req, res) => {
  const videos = readJSON(VIDEOS_FILE) || [];
  const idx    = videos.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  videos[idx] = { ...videos[idx], ...req.body };
  writeJSON(VIDEOS_FILE, videos);
  res.json(videos[idx]);
});
// Admin: add video
app.post('/api/admin/videos', auth, (req, res) => {
  const { url, title, type } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const videos = readJSON(VIDEOS_FILE) || [];
  const vid = { id: uuidv4(), url: url.trim(), title: title||'', type: type||'youtube', thumb: getYtThumb(url), date: new Date().toISOString() };
  videos.unshift(vid);
  writeJSON(VIDEOS_FILE, videos);
  res.json(vid);
});
// Admin: delete video
app.delete('/api/admin/videos/:id', auth, (req, res) => {
  writeJSON(VIDEOS_FILE, (readJSON(VIDEOS_FILE)||[]).filter(v => v.id !== req.params.id));
  res.json({ success: true });
});
function getYtThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}
function getYtEmbed(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  const isShort = url.includes('/shorts/');
  if (!m) return url;
  return isShort
    ? `https://www.youtube.com/embed/${m[1]}`
    : `https://www.youtube.com/embed/${m[1]}`;
}

// ── Payment Settings (admin) ──────────────────────────────────────────────────
app.get('/api/admin/payment-settings', auth, (req, res) => res.json(readJSON(PAYMENT_FILE) || {}));
app.put('/api/admin/payment-settings', auth, upload.single('qrImage'), (req, res) => {
  const current = readJSON(PAYMENT_FILE) || {};
  if (req.body.upiId) current.upiId = req.body.upiId.trim();
  if (req.file)       current.qrImage = '/uploads/' + req.file.filename;
  if (req.body.clearQr === 'true') current.qrImage = null;
  if (req.body.razorpayEnabled !== undefined) current.razorpayEnabled = req.body.razorpayEnabled !== 'false';
  writeJSON(PAYMENT_FILE, current);
  res.json({ success: true, settings: current });
});

// ── Scholarships ──────────────────────────────────────────────────────────────

// Public: submit scholarship application
app.post('/api/scholarship/apply', upload.single('photo'), (req, res) => {
  const {
    fullName, dob, gender, category, fatherName, motherName,
    phone, email, address, state, pincode,
    currentClass, schoolName, boardName, lastYearMarks, lastYearPercent,
    examApplying, achievements, whyDeserve
  } = req.body;

  if (!fullName || !phone || !currentClass || !examApplying)
    return res.status(400).json({ error: 'Required fields missing' });

  const apps = readJSON(SCHOLARSHIPS_FILE) || [];
  const app_ = {
    id:              uuidv4(),
    fullName,        dob:           dob || '',
    gender:          gender || '',  category:       category || '',
    fatherName:      fatherName || '',
    motherName:      motherName || '',
    phone,           email:         email || '',
    address:         address || '', state:          state || '',
    pincode:         pincode || '',
    currentClass,    schoolName:    schoolName || '',
    boardName:       boardName || '',
    lastYearMarks:   lastYearMarks || '',
    lastYearPercent: lastYearPercent || '',
    examApplying,    achievements:  achievements || '',
    whyDeserve:      whyDeserve || '',
    photo:           req.file ? '/uploads/' + req.file.filename : null,
    status:          'New',
    score:           null,
    rank:            null,
    scholarshipAwarded: false,
    submittedAt:     new Date().toISOString()
  };
  apps.push(app_);
  writeJSON(SCHOLARSHIPS_FILE, apps);
  res.json({ success: true, applicationId: app_.id, message: 'Application submitted successfully! You will be contacted with exam details.' });
});

// Public: get scholarship exam info (from content)
app.get('/api/scholarship/info', (req, res) => {
  const c = readJSON(CONTENT_FILE) || {};
  res.json(c.scholarship || {});
});

// Admin: get all scholarship applications
app.get('/api/admin/scholarships', auth, (req, res) => {
  const apps = (readJSON(SCHOLARSHIPS_FILE) || [])
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(apps);
});

// Admin: update application (score, rank, status, award)
app.put('/api/admin/scholarships/:id', auth, (req, res) => {
  const apps = readJSON(SCHOLARSHIPS_FILE) || [];
  const idx  = apps.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  apps[idx]  = { ...apps[idx], ...req.body };
  writeJSON(SCHOLARSHIPS_FILE, apps);
  res.json(apps[idx]);
});

// Admin: delete application
app.delete('/api/admin/scholarships/:id', auth, (req, res) => {
  writeJSON(SCHOLARSHIPS_FILE, (readJSON(SCHOLARSHIPS_FILE) || []).filter(a => a.id !== req.params.id));
  res.json({ success: true });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Multer file errors
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 4MB.' });
  if (err.message && err.message.includes('Only image files')) return res.status(400).json({ error: err.message });
  // Don't leak stack traces to client
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌟  Anath Shiksha Foundation  —  http://localhost:${PORT}`);
  console.log(`🔐  Admin Panel              —  http://localhost:${PORT}/admin\n`);
});

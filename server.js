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

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security & middleware ────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ── Data file paths ──────────────────────────────────────────────────────────
const DATA_DIR          = path.join(__dirname, 'data');
const CONTENT_FILE      = path.join(DATA_DIR, 'content.json');
const EVENTS_FILE       = path.join(DATA_DIR, 'events.json');
const DONORS_FILE       = path.join(DATA_DIR, 'donors.json');
const ADMIN_FILE        = path.join(DATA_DIR, 'admin.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');
const GALLERY_FILE      = path.join(DATA_DIR, 'gallery.json');

// ── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename:    (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
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
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function auth(req, res, next) { next(); }  // login-free admin

// ── Ensure data + uploads dirs exist on first boot ───────────────────────────
[DATA_DIR, path.join(__dirname, 'public', 'uploads')].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
// Seed missing data files so cloud deploy works without git-tracked data
const SEEDS = {
  [EVENTS_FILE]:       [],
  [DONORS_FILE]:       [],
  [APPLICATIONS_FILE]: [],
  [GALLERY_FILE]:      []
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

// ── UPI QR code generation ────────────────────────────────────────────────────
app.get('/api/payment/upi-qr', async (req, res) => {
  const amount  = parseFloat(req.query.amount) || 0;
  const upiId   = process.env.UPI_ID || 'anathshiksha@upi';
  const name    = encodeURIComponent('Anath Shiksha Foundation');
  const upiStr  = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=Donation`;
  try {
    const qr = await QRCode.toDataURL(upiStr, { width: 280, margin: 2, color: { dark: '#1a1a2e', light: '#fff' } });
    res.json({ qr, upiId, upiStr });
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

// ── Admin APIs ────────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = readJSON(ADMIN_FILE);
  if (!admin || admin.username !== username) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, admin.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ username }, process.env.JWT_SECRET || 'anath_secret_2024', { expiresIn: '24h' });
  res.json({ token, username });
});

app.put('/api/admin/content', auth, (req, res) => {
  writeJSON(CONTENT_FILE, { ...readJSON(CONTENT_FILE), ...req.body });
  res.json({ success: true });
});

app.post('/api/admin/upload', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/uploads/' + req.file.filename });
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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌟  Anath Shiksha Foundation  —  http://localhost:${PORT}`);
  console.log(`🔐  Admin Panel              —  http://localhost:${PORT}/admin\n`);
});

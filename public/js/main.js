/* ════════════════════════════════════════
   MAIN WEBSITE JAVASCRIPT
   Anath Shiksha Foundation
════════════════════════════════════════ */

'use strict';

// ── Loader ───────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    loader.classList.add('hidden');
    initAOS();
    animateHeroStats();
  }, 1800);
});

// ── Navbar ───────────────────────────────────────────
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');

  // Back-to-top
  const btt = document.getElementById('backToTop');
  if (window.scrollY > 400) btt.classList.add('visible');
  else btt.classList.remove('visible');

  // Active nav
  updateActiveNav();

  // AOS
  checkAOS();

  // Count-up trigger
  triggerCountUp();
});

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

function updateActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('active');
    if (l.getAttribute('href') === '#' + current) l.classList.add('active');
  });
}

// Back-to-top
document.getElementById('backToTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ── Particle Canvas ──────────────────────────────────
(function initParticles() {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  const wrap   = document.getElementById('particles-canvas');
  if (!wrap) return;
  wrap.appendChild(canvas);

  const resize = () => { canvas.width = wrap.offsetWidth; canvas.height = wrap.offsetHeight; };
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['rgba(255,107,53,', 'rgba(249,199,79,', 'rgba(255,255,255,'];
  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 3 + 1,
    vx: (Math.random() - .5) * .6,
    vy: (Math.random() - .5) * .6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: Math.random() * .4 + .1
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.alpha + ')';
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    });
    // Draw lines between close particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(255,255,255,' + (1 - d/120) * 0.08 + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── AOS (Animate On Scroll) ──────────────────────────
function initAOS() {
  document.querySelectorAll('[data-aos]').forEach(el => {
    el.style.transition = 'opacity .7s ease, transform .7s ease';
  });
  checkAOS();
}

function checkAOS() {
  document.querySelectorAll('[data-aos]').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 60) el.classList.add('aos-animate');
  });
}

// ── Hero stat counter ────────────────────────────────
function animateHeroStats() {
  document.querySelectorAll('.hero-stat-num').forEach(el => {
    const target = parseInt(el.dataset.target);
    countUp(el, target, 2000);
  });
}

// ── Section count-up ────────────────────────────────
let countUpDone = false;
function triggerCountUp() {
  if (countUpDone) return;
  const statsGrid = document.querySelector('.stats-grid');
  if (!statsGrid) return;
  const rect = statsGrid.getBoundingClientRect();
  if (rect.top < window.innerHeight - 100) {
    countUpDone = true;
    document.querySelectorAll('.count-up').forEach(el => {
      countUp(el, parseInt(el.dataset.target), 2500);
    });
  }
}

function countUp(el, target, duration) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { start = target; clearInterval(timer); }
    el.textContent = formatNum(Math.floor(start));
  }, 16);
}

function formatNum(n) {
  if (n >= 100000) return (n / 100000).toFixed(1).replace('.0','') + 'L';
  if (n >= 1000)   return n.toLocaleString('en-IN');
  return n.toString();
}

// ── Load site content ────────────────────────────────
async function loadContent() {
  try {
    const res = await fetch('/api/content');
    const c   = await res.json();

    // Hero
    setTxt('heroTitle',    c.hero?.title);
    setTxt('heroSubtitle', c.hero?.subtitle);
    setTxt('heroTagline',  c.hero?.tagline);

    // About
    setTxt('aboutTitle',       c.about?.title);
    setTxt('aboutDescription', c.about?.description);
    setTxt('visionText',       c.about?.vision);
    setTxt('missionText',      c.about?.mission);
    setTxt('foundedYear',      c.about?.founded);
    setTxt('registeredBadge',  c.about?.registered);
    setTxt('locationText',     c.about?.location);

    // Stats
    if (c.stats) {
      setTxt('statSchools', c.stats.schools || '47');
    }

    // Programs
    if (c.programs) renderPrograms(c.programs);

    // Gallery — loaded separately from /api/gallery
    // (renderGallery called by loadGallery)

    // Testimonials
    if (c.testimonials) renderTestimonials(c.testimonials);

    // CEO
    if (c.ceo) renderCEO(c.ceo);

    // Contact
    if (c.contact) {
      setTxt('contactAddress', c.contact.address);
      setTxt('contactPhone',   c.contact.phone);
      setTxt('contactEmail',   c.contact.email);
      setHref('contactPhone',  'tel:' + c.contact.phone);
      setHref('contactEmail',  'mailto:' + c.contact.email);
      setHref('fbLink', c.contact.facebook);
      setHref('twLink', c.contact.twitter);
      setHref('igLink', c.contact.instagram);
      setHref('ytLink', c.contact.youtube);
    }
  } catch(e) { console.warn('Content load issue:', e.message); }
}

function setTxt(id, val) { const el = document.getElementById(id); if (el && val) el.textContent = val; }
function setHref(id, val) { const el = document.getElementById(id); if (el && val) el.href = val; }

// ── Programs ─────────────────────────────────────────
function renderPrograms(programs) {
  const grid = document.getElementById('programsGrid');
  if (!grid) return;
  grid.innerHTML = programs.map(p => `
    <div class="program-card" data-aos="fade-up" style="--delay:${p.id * 0.1}s">
      <div class="program-card-accent" style="background:${p.color || '#FF6B35'}"></div>
      <div class="program-card-body">
        <span class="program-icon">${p.icon}</span>
        <h3 class="program-title">${p.title}</h3>
        <p class="program-description">${p.description}</p>
        <span class="program-impact" style="color:${p.color || '#FF6B35'}; background:${p.color || '#FF6B35'}15">
          <i class="fas fa-check-circle"></i> ${p.impact}
        </span>
      </div>
    </div>
  `).join('');
  checkAOS();
}

// ── Events ───────────────────────────────────────────
async function loadEvents() {
  try {
    const res    = await fetch('/api/events');
    const events = await res.json();
    const grid   = document.getElementById('eventsGrid');
    if (!grid) return;

    if (!events.length) {
      grid.innerHTML = '<p style="text-align:center;color:#666;grid-column:1/-1">No upcoming events at the moment.</p>';
      return;
    }

    const catColors = { Education:'#2196F3', Nutrition:'#4CAF50', Mentorship:'#9C27B0', Fundraiser:'#FF6B35', default:'#607D8B' };

    grid.innerHTML = events.map(ev => {
      const d    = new Date(ev.date);
      const day  = d.getDate();
      const mon  = d.toLocaleString('default', { month: 'short' });
      const yr   = d.getFullYear();
      const col  = catColors[ev.category] || catColors.default;
      return `
        <div class="event-card" data-aos="fade-up">
          <div class="event-date-col" style="background:${col}">
            <div class="event-day">${day}</div>
            <div class="event-month">${mon}</div>
            <div class="event-year">${yr}</div>
          </div>
          <div class="event-body">
            <span class="event-category" style="background:${col}18;color:${col}">${ev.category || 'Event'}</span>
            <h3 class="event-title">${ev.title}</h3>
            <div class="event-meta">
              <span><i class="fas fa-clock"></i> ${ev.time || 'TBD'}</span>
              <span><i class="fas fa-map-marker-alt"></i> ${ev.venue || 'TBD'}</span>
            </div>
            <p class="event-desc">${ev.description || ''}</p>
          </div>
        </div>
      `;
    }).join('');
    checkAOS();
  } catch(e) { console.warn('Events load issue:', e.message); }
}

// ── Testimonials slider ──────────────────────────────
let testimonialIdx = 0;
let testimonialTimer;

function renderTestimonials(testimonials) {
  const track = document.getElementById('testimonialsTrack');
  const dots  = document.getElementById('testimonialDots');
  if (!track) return;

  const slider = document.createElement('div');
  slider.className = 'testimonials-slider';
  slider.innerHTML = testimonials.map(t => `
    <div class="testimonial-card">
      <div class="testimonial-avatar">${t.avatar || t.name[0]}</div>
      <p class="testimonial-quote">${t.quote}</p>
      <div class="testimonial-name">${t.name}</div>
      <div class="testimonial-role">${t.role}</div>
    </div>
  `).join('');
  track.appendChild(slider);

  if (dots) {
    dots.innerHTML = testimonials.map((_, i) => `<span class="dot${i===0?' active':''}" data-i="${i}"></span>`).join('');
    dots.querySelectorAll('.dot').forEach(d => d.addEventListener('click', () => goTestimonial(parseInt(d.dataset.i))));
  }

  function goTestimonial(i) {
    testimonialIdx = i;
    slider.style.transform = `translateX(-${i * 100}%)`;
    if (dots) dots.querySelectorAll('.dot').forEach((d,j) => d.classList.toggle('active', j===i));
  }

  function autoPlay() {
    testimonialTimer = setInterval(() => {
      goTestimonial((testimonialIdx + 1) % testimonials.length);
    }, 4500);
  }

  autoPlay();
  track.addEventListener('mouseenter', () => clearInterval(testimonialTimer));
  track.addEventListener('mouseleave', autoPlay);
}

// ── Gallery ──────────────────────────────────────────
const galleryEmojis = ['🎓','🍱','🌱','💍','📚','🏫','🌟','🙌'];

async function loadGallery() {
  try {
    const res     = await fetch('/api/gallery');
    const gallery = await res.json();
    renderGallery(gallery);
  } catch(e) { console.warn('Gallery load issue:', e.message); }
}

function renderGallery(gallery) {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  if (!gallery.length) {
    grid.innerHTML = '<p style="text-align:center;color:#999;grid-column:1/-1">Gallery coming soon.</p>';
    return;
  }
  grid.innerHTML = gallery.map((g, i) => {
    const hasImg = g.url && !g.url.includes('/images/gallery');  // only real uploads
    return `
    <div class="gallery-item" data-aos="fade-up" onclick="openPublicLightbox('${encodeURIComponent(g.url)}','${encodeURIComponent(g.caption||'')}')">
      ${hasImg
        ? `<img src="${g.url}" alt="${g.caption||''}" loading="lazy" style="width:100%;height:100%;object-fit:cover"/>`
        : `<div class="gallery-placeholder">${galleryEmojis[i % galleryEmojis.length]}</div>`}
      <div class="gallery-caption">${g.caption || ''}</div>
    </div>`;
  }).join('');
  checkAOS();
}

window.openPublicLightbox = (url, caption) => {
  const existing = document.getElementById('pubLightbox');
  if (existing) existing.remove();
  const lb = document.createElement('div');
  lb.id = 'pubLightbox';
  lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;cursor:pointer;animation:fadeIn .2s ease';
  lb.innerHTML = `
    <button onclick="document.getElementById('pubLightbox').remove()" style="position:absolute;top:1rem;right:1.2rem;background:none;border:none;color:#fff;font-size:2.2rem;cursor:pointer;line-height:1">&times;</button>
    <img src="${decodeURIComponent(url)}" style="max-width:90vw;max-height:88vh;border-radius:10px;object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,.5)"/>
    ${decodeURIComponent(caption) ? `<div style="position:absolute;bottom:1.5rem;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.85);font-size:.95rem;background:rgba(0,0,0,.55);padding:.4rem 1.3rem;border-radius:50px;white-space:nowrap;max-width:80vw;overflow:hidden;text-overflow:ellipsis">${decodeURIComponent(caption)}</div>` : ''}
  `;
  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
  document.body.appendChild(lb);
};

// ── Top Donors ───────────────────────────────────────
async function loadDonors() {
  try {
    const res    = await fetch('/api/donors');
    const donors = await res.json();
    renderDonors(donors);
  } catch(e) { console.warn('Donors load issue:', e.message); }
}

function renderDonors(donors) {
  const podium = document.getElementById('donorsPodium');
  const list   = document.getElementById('donorsList');
  if (!podium || !list) return;

  if (!donors.length) {
    podium.innerHTML = '<p class="pending-confirm-notice">Donations are being verified by admin. Check back soon!</p>';
    list.innerHTML = '';
    return;
  }

  const medals      = ['🥇','🥈','🥉'];
  const top3        = donors.slice(0, 3);
  const rest        = donors.slice(3, 10);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const rankClass   = ['rank-2', 'rank-1', 'rank-3'];
  const medalOrder  = [medals[1], medals[0], medals[2]];

  podium.innerHTML = podiumOrder.map((d, i) => {
    const avatarInner = d.photo
      ? `<img src="${d.photo}" alt="${d.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
      : d.name[0].toUpperCase();
    return `
    <div class="podium-card ${rankClass[i]}">
      <div class="podium-rank">${medalOrder[i]}</div>
      <div class="podium-avatar">${avatarInner}</div>
      <div class="podium-name">${d.name}</div>
      <div class="podium-amount">₹${d.amount.toLocaleString('en-IN')}</div>
      ${d.message ? `<div style="font-size:.78rem;opacity:.6;margin-top:.4rem">"${d.message}"</div>` : ''}
    </div>`;
  }).join('');

  list.innerHTML = rest.map((d, i) => {
    const avatarInner = d.photo
      ? `<img src="${d.photo}" alt="${d.name}"/>`
      : d.name[0].toUpperCase();
    return `
    <div class="donor-row" data-aos="fade-up">
      <div class="donor-rank-num">#${i + 4}</div>
      <div class="donor-avatar-sm">${avatarInner}</div>
      <div class="donor-info">
        <div class="donor-name">${d.name}</div>
        ${d.message ? `<div class="donor-msg">"${d.message}"</div>` : ''}
      </div>
      <div class="donor-amount-badge">₹${d.amount.toLocaleString('en-IN')}</div>
    </div>`;
  }).join('');
  checkAOS();
}

// ── Donation Form ─────────────────────────────────────
let selectedAmount  = 1000;
let currentPhotoFile = null;

// Amount buttons
document.querySelectorAll('.amt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAmount = parseInt(btn.dataset.amount);
    const ca = document.getElementById('customAmount');
    if (ca) ca.value = '';
    updateDonateDisplay();
  });
});

document.getElementById('customAmount')?.addEventListener('input', e => {
  const val = parseInt(e.target.value);
  if (val > 0) {
    selectedAmount = val;
    document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
    updateDonateDisplay();
  }
});

function updateDonateDisplay() {
  const fmt = '₹' + selectedAmount.toLocaleString('en-IN');
  document.querySelectorAll('.donate-amt-lbl').forEach(el => el.textContent = fmt);
  document.getElementById('qrAmountLabel') && (document.getElementById('qrAmountLabel').textContent = 'Scan to pay ' + fmt);
  refreshQR();
}

// Photo upload
document.getElementById('photoUploadBtn')?.addEventListener('click', () => document.getElementById('donorPhoto').click());
document.getElementById('donorPhoto')?.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  currentPhotoFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('photoPreview').src = ev.target.result;
    document.getElementById('photoPreviewWrap').style.display = 'block';
    document.getElementById('photoUploadBtn').style.display = 'none';
  };
  reader.readAsDataURL(file);
});
document.getElementById('photoRemoveBtn')?.addEventListener('click', () => {
  currentPhotoFile = null;
  document.getElementById('donorPhoto').value = '';
  document.getElementById('photoPreviewWrap').style.display = 'none';
  document.getElementById('photoUploadBtn').style.display = 'flex';
});

// Payment tabs
document.querySelectorAll('.pay-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('panel-' + tab.dataset.method);
    if (panel) panel.classList.add('active');
    if (tab.dataset.method === 'qr') refreshQR();
  });
});

// Shared: collect donor fields
function getDonorFields() {
  return {
    name:     (document.getElementById('donorName')?.value || '').trim(),
    email:    (document.getElementById('donorEmail')?.value || '').trim(),
    phone:    (document.getElementById('donorPhone')?.value || '').trim(),
    message:  (document.getElementById('donorMessage')?.value || '').trim(),
    isPublic: document.getElementById('publicDonor')?.checked
  };
}

function validateDonorFields(f) {
  if (!f.name)  { showToast('Please enter your name', 'error'); return false; }
  if (!f.email) { showToast('Please enter your email', 'error'); return false; }
  if (selectedAmount < 1) { showToast('Please select a donation amount', 'error'); return false; }
  return true;
}

// Build FormData (handles photo upload)
function buildFormData(extra = {}) {
  const fd = new FormData();
  const f  = getDonorFields();
  fd.append('name',          f.name);
  fd.append('email',         f.email);
  fd.append('phone',         f.phone);
  fd.append('message',       f.message);
  fd.append('isPublic',      f.isPublic);
  fd.append('amount',        selectedAmount);
  if (currentPhotoFile) fd.append('photo', currentPhotoFile);
  Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

function setBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.dataset.orig = btn.innerHTML;
  btn.innerHTML = loading
    ? '<i class="fas fa-spinner fa-spin"></i> Processing...'
    : (btn.dataset.orig || btn.innerHTML);
}

// ─── Card payment (Razorpay) ─────────────────────────
document.getElementById('donateSubmitCard')?.addEventListener('click', async () => {
  const f = getDonorFields();
  if (!validateDonorFields(f)) return;
  setBtnLoading('donateSubmitCard', true);
  try {
    const orderRes = await fetch('/api/payment/create-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: selectedAmount })
    });
    const order = await orderRes.json();

    if (order.demo) {
      const fd = buildFormData({ razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_demo_' + Date.now(), paymentMethod: 'Card/Demo' });
      const vRes = await fetch('/api/payment/verify', { method: 'POST', body: fd });
      await vRes.json();
      showSuccessModal(f.name, selectedAmount);
      clearDonateForm();
      setTimeout(loadDonors, 500);
    } else {
      new Razorpay({
        key:         order.keyId,
        amount:      order.amount,
        currency:    order.currency,
        name:        'Anath Shiksha Foundation',
        description: 'Donation for a brighter future',
        order_id:    order.orderId,
        handler: async resp => {
          const fd = buildFormData({ ...resp, paymentMethod: 'Card' });
          await fetch('/api/payment/verify', { method: 'POST', body: fd });
          showSuccessModal(f.name, selectedAmount);
          clearDonateForm();
          setTimeout(loadDonors, 500);
        },
        prefill: { name: f.name, email: f.email, contact: f.phone },
        theme:   { color: '#FF6B35' }
      }).open();
    }
  } catch(err) {
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    setBtnLoading('donateSubmitCard', false);
  }
});

// ─── UPI payment ─────────────────────────────────────
document.getElementById('copyUpiBtn')?.addEventListener('click', () => {
  const upiId = document.getElementById('upiIdDisplay')?.textContent || '';
  navigator.clipboard.writeText(upiId).then(() => showToast('UPI ID copied!', 'success'));
});

document.getElementById('donateSubmitUpi')?.addEventListener('click', async () => {
  const f = getDonorFields();
  if (!validateDonorFields(f)) return;
  const utr = document.getElementById('utrNumber')?.value.trim();
  if (!utr) { showToast('Please enter your UTR/transaction number', 'error'); return; }
  setBtnLoading('donateSubmitUpi', true);
  try {
    const fd = buildFormData({ utrNumber: utr });
    const res = await fetch('/api/payment/upi-record', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showSuccessModal(f.name, selectedAmount, true);
    clearDonateForm();
  } catch(err) {
    showToast(err.message || 'Error submitting payment', 'error');
  } finally {
    setBtnLoading('donateSubmitUpi', false);
  }
});

// ─── QR payment ──────────────────────────────────────
let qrRefreshTimer;
async function refreshQR() {
  const panel = document.getElementById('panel-qr');
  if (!panel || !panel.classList.contains('active')) return;
  clearTimeout(qrRefreshTimer);
  qrRefreshTimer = setTimeout(async () => {
    const qrImg  = document.getElementById('qrImage');
    const qrLoad = document.getElementById('qrLoading');
    if (!qrImg) return;
    if (qrLoad) qrLoad.style.display = 'block';
    qrImg.style.display = 'none';
    try {
      const res  = await fetch('/api/payment/upi-qr?amount=' + selectedAmount);
      const data = await res.json();
      if (data.qr) {
        qrImg.src = data.qr;
        qrImg.style.display = 'block';
        if (qrLoad) qrLoad.style.display = 'none';
        const upiDisp = document.getElementById('upiIdDisplay');
        if (upiDisp && data.upiId) upiDisp.textContent = data.upiId;
      }
    } catch(e) { if (qrLoad) qrLoad.textContent = 'QR generation failed. Use UPI ID.'; }
  }, 300);
}

document.getElementById('donateSubmitQr')?.addEventListener('click', async () => {
  const f = getDonorFields();
  if (!validateDonorFields(f)) return;
  const utr = document.getElementById('utrNumberQr')?.value.trim();
  if (!utr) { showToast('Please enter your UTR/transaction number', 'error'); return; }
  setBtnLoading('donateSubmitQr', true);
  try {
    const fd = buildFormData({ utrNumber: utr });
    const res = await fetch('/api/payment/upi-record', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showSuccessModal(f.name, selectedAmount, true);
    clearDonateForm();
  } catch(err) {
    showToast(err.message || 'Error submitting payment', 'error');
  } finally {
    setBtnLoading('donateSubmitQr', false);
  }
});

function clearDonateForm() {
  ['donorName','donorEmail','donorPhone','donorMessage','utrNumber','utrNumberQr','customAmount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  currentPhotoFile = null;
  document.getElementById('donorPhoto') && (document.getElementById('donorPhoto').value = '');
  document.getElementById('photoPreviewWrap') && (document.getElementById('photoPreviewWrap').style.display = 'none');
  document.getElementById('photoUploadBtn') && (document.getElementById('photoUploadBtn').style.display = 'flex');
  document.getElementById('publicDonor') && (document.getElementById('publicDonor').checked = true);
  selectedAmount = 1000;
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.toggle('active', b.dataset.amount === '1000'));
  updateDonateDisplay();
}

function showSuccessModal(name, amount, isUpi = false) {
  const modal = document.getElementById('successModal');
  const msg   = isUpi
    ? `Thank you, ${name}! Your UPI payment of ₹${Number(amount).toLocaleString('en-IN')} has been recorded. Once admin verifies it, your name will appear in the Donors Hall of Fame.`
    : `Thank you, ${name}! Your donation of ₹${Number(amount).toLocaleString('en-IN')} is received. A receipt has been sent to your email.`;
  document.getElementById('successMsg').textContent = msg;
  modal.style.display = 'flex';
}

// Load CEO info into donate section
function renderCEO(ceo) {
  if (!ceo) return;
  const setText = (id, v) => { const el = document.getElementById(id); if (el && v) el.textContent = v; };
  setText('ceoName', ceo.name);
  setText('ceoRole', ceo.role);
  setText('ceoBio',  ceo.bio);
  const ph = document.getElementById('ceoPhone');
  if (ph && ceo.phone) { ph.href = 'tel:' + ceo.phone.replace(/[^+\d]/g,''); ph.querySelector('i').nextSibling.textContent = ' ' + ceo.phone; }
}

// ── Contact form ─────────────────────────────────────
document.getElementById('contactForm')?.addEventListener('submit', e => {
  e.preventDefault();
  showToast('✅ Message sent! We\'ll respond within 24 hours.', 'success');
  e.target.reset();
});

// ── Newsletter form ──────────────────────────────────
document.getElementById('newsletterForm')?.addEventListener('submit', e => {
  e.preventDefault();
  showToast('✅ Subscribed! Thank you for joining us.', 'success');
  e.target.reset();
});

// ── Toast ────────────────────────────────────────────
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => toast.className = 'toast', 3500);
}

// ── Join Us Section ──────────────────────────────────
document.querySelectorAll('.role-apply-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const role = btn.dataset.role;
    document.getElementById('joinRole').value        = role;
    document.getElementById('joinFormTitle').textContent = 'Apply — ' + role;
    const wrap = document.getElementById('joinFormWrap');
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.getElementById('joinFormClose')?.addEventListener('click', () => {
  document.getElementById('joinFormWrap').style.display = 'none';
});

document.getElementById('joinForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('joinSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  const payload = {
    role:         document.getElementById('joinRole').value,
    name:         document.getElementById('joinName').value.trim(),
    email:        document.getElementById('joinEmail').value.trim(),
    phone:        document.getElementById('joinPhone').value.trim(),
    city:         document.getElementById('joinCity').value.trim(),
    qualification:document.getElementById('joinQual').value.trim(),
    availability: document.getElementById('joinAvail').value,
    why:          document.getElementById('joinWhy').value.trim(),
    social:       document.getElementById('joinSocial').value.trim()
  };
  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('🎉 Application submitted! We will reach out to you soon.', 'success');
    document.getElementById('joinForm').reset();
    document.getElementById('joinFormWrap').style.display = 'none';
  } catch(err) {
    showToast('Error: ' + (err.message || 'Please try again.'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application';
  }
});

// ── Init ──────────────────────────────────────────────
(async function init() {
  await loadContent();
  await Promise.all([loadEvents(), loadDonors(), loadGallery()]);
  updateDonateDisplay();
  checkAOS();
})();

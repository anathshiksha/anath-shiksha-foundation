/* ════════════════════════════════════════
   ADMIN PANEL JAVASCRIPT
   Anath Shiksha Foundation
════════════════════════════════════════ */

'use strict';

let TOKEN      = localStorage.getItem('asf_admin_token') || '';
let ADMIN_USER = localStorage.getItem('asf_admin_user')  || 'Admin';

// ── Init ──────────────────────────────────────────────
(function init() {
  if (TOKEN) {
    verifyStoredToken();
  } else {
    showLogin();
  }
})();

async function verifyStoredToken() {
  try {
    await apiFetch('/api/admin/donors');
    showDash();
  } catch {
    TOKEN = ''; localStorage.removeItem('asf_admin_token');
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminDash').style.display   = 'none';
}

function showDash() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminDash').style.display   = 'flex';
  const un = document.getElementById('adminUsername');
  if (un) un.textContent = ADMIN_USER;
  loadDashboard();
}

// Toggle password visibility
document.getElementById('togglePass')?.addEventListener('click', () => {
  const inp = document.getElementById('loginPass');
  const ico = document.querySelector('#togglePass i');
  if (inp.type === 'password') { inp.type = 'text'; ico.className = 'fas fa-eye-slash'; }
  else { inp.type = 'password'; ico.className = 'fas fa-eye'; }
});

document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
  err.style.display = 'none';
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('loginUser').value,
        password: document.getElementById('loginPass').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    TOKEN      = data.token;
    ADMIN_USER = data.username;
    localStorage.setItem('asf_admin_token', TOKEN);
    localStorage.setItem('asf_admin_user',  ADMIN_USER);
    showDash();
  } catch(ex) {
    err.textContent   = ex.message || 'Invalid credentials';
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  TOKEN = ''; ADMIN_USER = 'admin';
  localStorage.removeItem('asf_admin_token');
  localStorage.removeItem('asf_admin_user');
  // Force reload so verifyStoredToken doesn't auto-login again
  window.location.reload();
});

// ── Sidebar / Navigation ──────────────────────────────
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('sidebarClose')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
});

document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const tab = item.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('topbarTitle').textContent = item.textContent.trim();
    document.getElementById('sidebar').classList.remove('open');

    if (tab === 'dashboard')    loadDashboard();
    if (tab === 'content')      loadContentForm();
    if (tab === 'events')       loadEventsTab();
    if (tab === 'gallery')      loadGalleryTab();
    if (tab === 'donors')       loadDonorsTab();
    if (tab === 'applications') loadApplicationsTab();
    if (tab === 'scholarships') loadScholarshipsTab();
    if (tab === 'messages')     loadMessagesTab();
    if (tab === 'videos')       loadVideosTab();
    if (tab === 'payment')      loadPaymentTab();
  });
});

// ── API Helper ────────────────────────────────────────
async function apiFetch(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN }
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const data = await res.json();
  if (res.status === 401) { showLogin(); throw new Error(data.error || 'Session expired'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Dashboard ─────────────────────────────────────────
async function loadDashboard() {
  try {
    const [donors, events] = await Promise.all([
      apiFetch('/api/admin/donors'),
      apiFetch('/api/admin/events')
    ]);
    const total  = donors.reduce((s, d) => s + d.amount, 0);
    const top    = donors[0]?.amount || 0;
    document.getElementById('dsTotalDonors').textContent  = donors.length;
    document.getElementById('dsTotalAmount').textContent  = '₹' + total.toLocaleString('en-IN');
    document.getElementById('dsEvents').textContent       = events.length;
    document.getElementById('dsTopDonation').textContent  = '₹' + top.toLocaleString('en-IN');

    const tbody = document.querySelector('#recentDonorsTable tbody');
    const recent = donors.slice(0, 10);
    tbody.innerHTML = recent.map((d, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${escHtml(d.name)}</td>
        <td><strong>₹${d.amount.toLocaleString('en-IN')}</strong></td>
        <td>${fmtDate(d.date)}</td>
        <td>${escHtml(d.message || '—')}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;color:#999">No donations yet.</td></tr>';
  } catch(e) { if (e.message.includes('token')) { showLogin(); } }
}

// ── Content Tab ───────────────────────────────────────
async function loadContentForm() {
  try {
    const c = await apiFetch('/api/content');
    setValue('c_heroTitle',    c.hero?.title);
    setValue('c_heroSubtitle', c.hero?.subtitle);
    setValue('c_heroTagline',  c.hero?.tagline);
    setValue('c_aboutDesc',    c.about?.description);
    setValue('c_vision',       c.about?.vision);
    setValue('c_mission',      c.about?.mission);
    setValue('c_founded',      c.about?.founded);
    setValue('c_registered',   c.about?.registered);
    setValue('c_address',      c.contact?.address);
    setValue('c_phone',        c.contact?.phone);
    setValue('c_email',        c.contact?.email);
    setValue('c_facebook',     c.contact?.facebook);
    setValue('c_instagram',    c.contact?.instagram);
    setValue('c_twitter',      c.contact?.twitter);
    setValue('c_youtube',      c.contact?.youtube);
    // Scholarship
    setValue('c_scholTitle',      c.scholarship?.title);
    setValue('c_scholTagline',    c.scholarship?.tagline);
    setValue('c_scholDesc',       c.scholarship?.description);
    setValue('c_scholLastDate',   c.scholarship?.lastDate);
    setValue('c_scholExamDate',   c.scholarship?.examDate);
    setValue('c_scholResultDate', c.scholarship?.resultDate);
    // Toggle
    const toggle = document.getElementById('c_scholEnabled');
    if (toggle) {
      toggle.checked = c.scholarshipEnabled !== false;
      updateScholToggleLabel(toggle.checked);
    }
    // CEO
    setValue('c_ceoName',  c.ceo?.name);
    setValue('c_ceoRole',  c.ceo?.role);
    setValue('c_ceoPhone', c.ceo?.phone);
    setValue('c_ceoBio',   c.ceo?.bio);
    const ceoPreview = document.getElementById('c_ceoPhotoPreview');
    const ceoImg     = document.getElementById('c_ceoPhotoImg');
    if (c.ceo?.photo && ceoPreview && ceoImg) {
      ceoImg.src = c.ceo.photo;
      ceoPreview.style.display = 'flex';
    }
  } catch(e) { adminToast('Failed to load content', 'error'); }
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val != null) el.value = val;
}

function updateScholToggleLabel(enabled) {
  const lbl = document.getElementById('scholToggleLabel');
  if (lbl) {
    lbl.textContent = enabled ? 'Scholarship Section: Enabled' : 'Scholarship Section: Disabled';
    lbl.style.color = enabled ? '#2e7d32' : '#c62828';
  }
}

document.getElementById('c_scholEnabled')?.addEventListener('change', function() {
  updateScholToggleLabel(this.checked);
});

document.getElementById('saveContentBtn')?.addEventListener('click', async () => {
  const btn    = document.getElementById('saveContentBtn');
  const status = document.getElementById('saveStatus');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  status.textContent = '';

  const payload = {
    hero: {
      title:    document.getElementById('c_heroTitle').value,
      subtitle: document.getElementById('c_heroSubtitle').value,
      tagline:  document.getElementById('c_heroTagline').value
    },
    about: {
      description: document.getElementById('c_aboutDesc').value,
      vision:      document.getElementById('c_vision').value,
      mission:     document.getElementById('c_mission').value,
      founded:     document.getElementById('c_founded').value,
      registered:  document.getElementById('c_registered').value
    },
    contact: {
      address:   document.getElementById('c_address').value,
      phone:     document.getElementById('c_phone').value,
      email:     document.getElementById('c_email').value,
      facebook:  document.getElementById('c_facebook').value,
      instagram: document.getElementById('c_instagram').value,
      twitter:   document.getElementById('c_twitter').value,
      youtube:   document.getElementById('c_youtube').value
    },
    scholarship: {
      title:      document.getElementById('c_scholTitle').value,
      tagline:    document.getElementById('c_scholTagline').value,
      description:document.getElementById('c_scholDesc').value,
      lastDate:   document.getElementById('c_scholLastDate').value,
      examDate:   document.getElementById('c_scholExamDate').value,
      resultDate: document.getElementById('c_scholResultDate').value
    },
    scholarshipEnabled: document.getElementById('c_scholEnabled')?.checked !== false,
    ceo: {
      name:  document.getElementById('c_ceoName')?.value  || '',
      role:  document.getElementById('c_ceoRole')?.value  || '',
      phone: document.getElementById('c_ceoPhone')?.value || '',
      bio:   document.getElementById('c_ceoBio')?.value   || ''
    }
  };

  try {
    await apiFetch('/api/admin/content', 'PUT', payload);
    status.textContent = '✅ Saved successfully!';
    adminToast('Content saved!', 'success');
  } catch(e) {
    adminToast('Save failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save All Changes';
    setTimeout(() => status.textContent = '', 3000);
  }
});

// ── Events Tab ────────────────────────────────────────
async function loadEventsTab() {
  try {
    const events = await apiFetch('/api/admin/events');
    const tbody  = document.querySelector('#eventsTable tbody');
    tbody.innerHTML = events.map(ev => `
      <tr>
        <td>${escHtml(ev.title)}</td>
        <td>${fmtDate(ev.date)}</td>
        <td><span style="background:#FF6B3515;color:#FF6B35;padding:.2rem .6rem;border-radius:50px;font-size:.75rem;font-weight:600">${ev.category||'—'}</span></td>
        <td>${escHtml(ev.venue || '—')}</td>
        <td>
          <button class="table-action-btn edit" onclick="openEditEvent('${ev.id}')"><i class="fas fa-edit"></i></button>
          <button class="table-action-btn del"  onclick="deleteEvent('${ev.id}', this)"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;color:#999">No events yet.</td></tr>';
  } catch(e) { adminToast('Failed to load events', 'error'); }
}

// Add / edit event modal
let editingEventId = null;

document.getElementById('addEventBtn')?.addEventListener('click', () => {
  editingEventId = null;
  document.getElementById('eventModalTitle').textContent = 'Add New Event';
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('eventModal').style.display = 'flex';
});

window.openEditEvent = async (id) => {
  const events = await apiFetch('/api/admin/events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  editingEventId = id;
  document.getElementById('eventModalTitle').textContent = 'Edit Event';
  document.getElementById('eventId').value        = ev.id;
  document.getElementById('evTitle').value        = ev.title || '';
  document.getElementById('evDate').value         = ev.date  || '';
  document.getElementById('evTime').value         = ev.time  || '';
  document.getElementById('evCategory').value     = ev.category || 'Education';
  document.getElementById('evVenue').value        = ev.venue || '';
  document.getElementById('evDescription').value  = ev.description || '';
  document.getElementById('eventModal').style.display = 'flex';
};

[document.getElementById('eventModalClose'), document.getElementById('eventModalCancel')].forEach(btn => {
  btn?.addEventListener('click', () => document.getElementById('eventModal').style.display = 'none');
});

document.getElementById('eventForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    title:       document.getElementById('evTitle').value,
    date:        document.getElementById('evDate').value,
    time:        document.getElementById('evTime').value,
    category:    document.getElementById('evCategory').value,
    venue:       document.getElementById('evVenue').value,
    description: document.getElementById('evDescription').value
  };
  const saveBtn = document.getElementById('eventSaveBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    if (editingEventId) {
      await apiFetch('/api/admin/events/' + editingEventId, 'PUT', payload);
      adminToast('Event updated!', 'success');
    } else {
      await apiFetch('/api/admin/events', 'POST', payload);
      adminToast('Event added!', 'success');
    }
    document.getElementById('eventModal').style.display = 'none';
    loadEventsTab();
  } catch(ex) {
    adminToast('Error: ' + ex.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Event';
  }
});

window.deleteEvent = (id, btn) => {
  showConfirm('Delete this event?', async () => {
    try {
      await apiFetch('/api/admin/events/' + id, 'DELETE');
      adminToast('Event deleted', 'success');
      loadEventsTab();
    } catch(e) { adminToast('Delete failed', 'error'); }
  });
};

// ── Donors Tab ────────────────────────────────────────
async function loadDonorsTab() {
  try {
    const donors = await apiFetch('/api/admin/donors');
    const tbody  = document.querySelector('#donorsTable tbody');
    tbody.innerHTML = donors.map((d, i) => {
      const confirmed = d.confirmed;
      const photoHtml = d.photo
        ? `<img src="${d.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;vertical-align:middle;border:2px solid #FF6B35" alt="photo"/>`
        : `<span style="display:inline-flex;width:36px;height:36px;border-radius:50%;background:#1a1a2e;color:#fff;align-items:center;justify-content:center;font-weight:700;font-size:14px">${(d.name||'?')[0].toUpperCase()}</span>`;
      return `<tr>
        <td>${i+1}</td>
        <td style="display:flex;align-items:center;gap:.6rem;padding-top:.7rem">${photoHtml}<span>${escHtml(d.name)}</span></td>
        <td><strong>₹${d.amount.toLocaleString('en-IN')}</strong></td>
        <td>${escHtml(d.email || '—')}</td>
        <td>${escHtml(d.paymentMethod || 'Online')}</td>
        <td>${fmtDate(d.date)}</td>
        <td><span class="${d.public ? 'badge-yes' : 'badge-no'}">${d.public ? 'Yes' : 'No'}</span></td>
        <td>
          <button class="${confirmed ? 'table-action-btn edit' : 'btn-save'}" style="font-size:.78rem;padding:.35rem .7rem"
            onclick="toggleDonorConfirm('${d.id}', ${confirmed})">
            ${confirmed ? '✅ Confirmed' : '⏳ Confirm'}
          </button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:#999;padding:2rem">No donors yet.</td></tr>';
  } catch(e) { adminToast('Failed to load donors', 'error'); }
}

window.toggleDonorConfirm = async (id, currentState) => {
  const newState = !currentState;
  try {
    await apiFetch('/api/admin/donors/' + id + '/confirm', 'PUT', { confirmed: newState });
    adminToast(newState ? '✅ Donor confirmed — now visible on website!' : 'Donor hidden from website', newState ? 'success' : '');
    loadDonorsTab();
  } catch(e) { adminToast('Update failed', 'error'); }
};

// ── Change Password ───────────────────────────────────
document.getElementById('changePassBtn')?.addEventListener('click', async () => {
  const np  = document.getElementById('newPass').value;
  const cp  = document.getElementById('confirmPass').value;
  if (!np || np.length < 6) { adminToast('Password must be at least 6 characters', 'error'); return; }
  if (np !== cp) { adminToast('Passwords do not match', 'error'); return; }
  try {
    await apiFetch('/api/admin/password', 'PUT', { newPassword: np });
    adminToast('Password changed successfully!', 'success');
    document.getElementById('newPass').value    = '';
    document.getElementById('confirmPass').value = '';
  } catch(e) { adminToast('Error: ' + e.message, 'error'); }
});

// ── Confirm Dialog ────────────────────────────────────
let confirmCallback = null;
function showConfirm(msg, cb) {
  document.getElementById('confirmMsg').textContent = msg;
  confirmCallback = cb;
  document.getElementById('confirmModal').style.display = 'flex';
}
document.getElementById('confirmYes')?.addEventListener('click', () => {
  document.getElementById('confirmModal').style.display = 'none';
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});
document.getElementById('confirmNo')?.addEventListener('click', () => {
  document.getElementById('confirmModal').style.display = 'none';
  confirmCallback = null;
});

// ── Admin Toast ───────────────────────────────────────
function adminToast(msg, type = '') {
  const el = document.getElementById('adminToast');
  el.textContent  = msg;
  el.className    = 'admin-toast show' + (type ? ' ' + type : '');
  setTimeout(() => el.className = 'admin-toast', 3000);
}

// ── Utilities ─────────────────────────────────────────
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return iso; }
}

// ── Applications Tab ──────────────────────────────────
let allApplications = [];
let appFilter = 'all';

async function loadApplicationsTab() {
  try {
    allApplications = await apiFetch('/api/admin/applications');
    renderApplicationsTable();
  } catch(e) { adminToast('Failed to load applications', 'error'); }
}

function renderApplicationsTable() {
  const filtered = appFilter === 'all'
    ? allApplications
    : allApplications.filter(a => a.role === appFilter);

  const tbody = document.querySelector('#applicationsTable tbody');
  if (!tbody) return;

  const roleColors = {
    'Internship':      '#2196F3',
    'Brand Ambassador':'#FF6B35',
    'Volunteer':       '#4CAF50'
  };

  tbody.innerHTML = filtered.length ? filtered.map((a, i) => {
    const col = roleColors[a.role] || '#607D8B';
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(a.name)}</strong></td>
      <td><span style="background:${col}18;color:${col};padding:.2rem .6rem;border-radius:50px;font-size:.75rem;font-weight:600">${escHtml(a.role)}</span></td>
      <td>${escHtml(a.email)}</td>
      <td>${escHtml(a.phone)}</td>
      <td>${escHtml(a.city || '—')}</td>
      <td>${fmtDate(a.date)}</td>
      <td>
        <select class="status-select ${escHtml(a.status || 'New')}" onchange="updateAppStatus('${a.id}', this.value)">
          <option ${a.status==='New'?'selected':''}>New</option>
          <option ${a.status==='Reviewed'?'selected':''}>Reviewed</option>
          <option ${a.status==='Accepted'?'selected':''}>Accepted</option>
          <option ${a.status==='Rejected'?'selected':''}>Rejected</option>
        </select>
      </td>
      <td style="display:flex;gap:.4rem">
        <button class="view-btn" onclick="viewApplication('${a.id}')"><i class="fas fa-eye"></i></button>
        <button class="table-action-btn del" onclick="deleteApplication('${a.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('')
  : `<tr><td colspan="9" style="text-align:center;color:#999;padding:2rem">No applications found.</td></tr>`;
}

// Filter buttons
document.querySelectorAll('.app-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.app-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    appFilter = btn.dataset.filter;
    renderApplicationsTable();
  });
});

window.updateAppStatus = async (id, status) => {
  try {
    await apiFetch('/api/admin/applications/' + id, 'PUT', { status });
    const idx = allApplications.findIndex(a => a.id === id);
    if (idx > -1) allApplications[idx].status = status;
    adminToast('Status updated to ' + status, 'success');
    renderApplicationsTable();
  } catch(e) { adminToast('Update failed', 'error'); }
};

window.viewApplication = (id) => {
  const a = allApplications.find(x => x.id === id);
  if (!a) return;
  const setText = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val || '—'; };
  setText('adName',   a.name);
  setText('adRole',   a.role);
  setText('adEmail',  a.email);
  setText('adPhone',  a.phone);
  setText('adCity',   a.city);
  setText('adQual',   a.qualification);
  setText('adAvail',  a.availability);
  setText('adSocial', a.social);
  setText('adWhy',    a.why);
  document.getElementById('appDetailTitle').textContent = a.name + ' — ' + a.role;
  document.getElementById('appDetailModal').style.display = 'flex';
};

window.deleteApplication = (id) => {
  showConfirm('Delete this application?', async () => {
    try {
      await apiFetch('/api/admin/applications/' + id, 'DELETE');
      allApplications = allApplications.filter(a => a.id !== id);
      renderApplicationsTable();
      adminToast('Application deleted', 'success');
    } catch(e) { adminToast('Delete failed', 'error'); }
  });
};

[document.getElementById('appDetailClose'), document.getElementById('appDetailClose2')].forEach(btn => {
  btn?.addEventListener('click', () => { document.getElementById('appDetailModal').style.display = 'none'; });
});

// ── Gallery Tab ───────────────────────────────────────

let galleryItems = [];

async function loadGalleryTab() {
  const grid  = document.getElementById('galleryAdminGrid');
  const stats = document.getElementById('galStats');
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;color:#999;padding:3rem;grid-column:1/-1"><i class="fas fa-spinner fa-spin" style="font-size:2rem"></i></div>';
  try {
    galleryItems = await apiFetch('/api/admin/gallery');
    if (stats) stats.textContent = galleryItems.length + ' photo' + (galleryItems.length !== 1 ? 's' : '') + ' in gallery';
    renderGalleryGrid();
  } catch(e) {
    grid.innerHTML = '<div style="text-align:center;color:#999;padding:3rem;grid-column:1/-1">Failed to load gallery.</div>';
  }
}

function renderGalleryGrid() {
  const grid = document.getElementById('galleryAdminGrid');
  if (!grid) return;
  if (!galleryItems.length) {
    grid.innerHTML = '<div style="text-align:center;color:#999;padding:3rem;grid-column:1/-1"><i class="fas fa-images" style="font-size:3rem;display:block;margin-bottom:1rem;opacity:.3"></i>No photos yet. Upload one above!</div>';
    return;
  }
  grid.innerHTML = galleryItems.map(g => `
    <div class="gal-card" data-id="${g.id}">
      <div class="gal-img-wrap">
        <span class="gal-cat-badge">${escHtml(g.category || 'General')}</span>
        <img src="${escHtml(g.url)}" alt="${escHtml(g.caption)}" onclick="openLightbox('${g.id}')" loading="lazy"/>
      </div>
      <div class="gal-body">
        <input class="gal-caption-input" data-id="${g.id}" value="${escHtml(g.caption)}" placeholder="Caption..."/>
        <div class="gal-footer">
          <button class="gal-save-btn" onclick="saveGalCaption('${g.id}')"><i class="fas fa-save"></i> Save</button>
          <button class="gal-del-btn"  onclick="deleteGalPhoto('${g.id}')"><i class="fas fa-trash"></i></button>
        </div>
        <div class="gal-date">${fmtDate(g.uploadedAt)}</div>
      </div>
    </div>
  `).join('');
}

// Upload new photo
const dropZone   = document.getElementById('galleryDropZone');
const photoInput = document.getElementById('galleryPhotoInput');
const preview    = document.getElementById('galleryUploadPreview');
const dropInner  = document.getElementById('galleryDropInner');

dropZone?.addEventListener('click', (e) => {
  if (e.target !== preview) photoInput?.click();
});
dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone?.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) showUploadPreview(file);
});

photoInput?.addEventListener('change', () => {
  if (photoInput.files[0]) showUploadPreview(photoInput.files[0]);
});

function showUploadPreview(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    preview.src = ev.target.result;
    preview.style.display = 'block';
    if (dropInner) dropInner.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

document.getElementById('galleryUploadForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!photoInput?.files[0]) { adminToast('Please select a photo first', 'error'); return; }
  const btn = document.getElementById('galUploadBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

  const fd = new FormData();
  fd.append('photo',    photoInput.files[0]);
  fd.append('caption',  document.getElementById('galCaption')?.value || '');
  fd.append('category', document.getElementById('galCategory')?.value || 'General');

  try {
    const res  = await fetch('/api/admin/gallery', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN }, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    adminToast('Photo uploaded to gallery!', 'success');
    // Reset form
    photoInput.value = '';
    preview.style.display = 'none';
    if (dropInner) dropInner.style.display = 'block';
    document.getElementById('galCaption') && (document.getElementById('galCaption').value = '');
    // Reload
    galleryItems.unshift(data);
    const stats = document.getElementById('galStats');
    if (stats) stats.textContent = galleryItems.length + ' photo' + (galleryItems.length !== 1 ? 's' : '') + ' in gallery';
    renderGalleryGrid();
  } catch(err) {
    adminToast('Upload failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-upload"></i> Upload to Gallery';
  }
});

window.saveGalCaption = async (id) => {
  const input = document.querySelector(`.gal-caption-input[data-id="${id}"]`);
  if (!input) return;
  try {
    await apiFetch('/api/admin/gallery/' + id, 'PUT', { caption: input.value });
    const idx = galleryItems.findIndex(g => g.id === id);
    if (idx > -1) galleryItems[idx].caption = input.value;
    adminToast('Caption saved!', 'success');
  } catch(e) { adminToast('Save failed', 'error'); }
};

window.deleteGalPhoto = (id) => {
  showConfirm('Delete this photo from gallery?', async () => {
    try {
      await apiFetch('/api/admin/gallery/' + id, 'DELETE');
      galleryItems = galleryItems.filter(g => g.id !== id);
      const stats = document.getElementById('galStats');
      if (stats) stats.textContent = galleryItems.length + ' photo' + (galleryItems.length !== 1 ? 's' : '') + ' in gallery';
      renderGalleryGrid();
      adminToast('Photo deleted', 'success');
    } catch(e) { adminToast('Delete failed', 'error'); }
  });
};

// Lightbox
window.openLightbox = (id) => {
  const item = galleryItems.find(g => g.id === id);
  if (!item) return;
  const lb = document.createElement('div');
  lb.className = 'gal-lightbox';
  lb.innerHTML = `
    <button class="gal-lightbox-close" onclick="this.closest('.gal-lightbox').remove()">&times;</button>
    <img src="${item.url}" alt="${escHtml(item.caption)}"/>
    ${item.caption ? `<div class="gal-lightbox-caption">${escHtml(item.caption)}</div>` : ''}
  `;
  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
  document.body.appendChild(lb);
};

// ── Videos Tab ────────────────────────────────────────
async function loadVideosTab() {
  try {
    const videos = await apiFetch('/api/admin/videos');
    const tbody  = document.querySelector('#videosTable tbody');
    if (!tbody) return;
    tbody.innerHTML = videos.length ? videos.map(v => `
      <tr>
        <td>${v.thumb ? `<img class="vid-thumb" src="${escHtml(v.thumb)}" onerror="this.style.display='none'" style="cursor:pointer" onclick="window.open('${escHtml(v.url)}','_blank')"/>` : '▶'}</td>
        <td>
          <input type="text" value="${escHtml(v.title || '')}" placeholder="Enter title..."
            style="border:1px solid #ddd;border-radius:6px;padding:.35rem .6rem;font-size:.85rem;width:100%;min-width:140px"
            onchange="updateVideoTitle('${v.id}', this.value)"/>
        </td>
        <td>${v.type === 'short' ? '📱 Short' : '🎬 Video'}</td>
        <td class="vid-url-cell"><a href="${escHtml(v.url)}" target="_blank" title="${escHtml(v.url)}">${escHtml(v.url.replace('https://www.youtube.com/watch?v=','youtu.be/').replace('https://youtube.com/shorts/','Shorts/').slice(0,40))}…</a></td>
        <td>${fmtDate(v.date)}</td>
        <td style="display:flex;gap:.4rem">
          <a href="${escHtml(v.url)}" target="_blank" class="view-btn" title="Preview"><i class="fab fa-youtube"></i></a>
          <button class="table-action-btn del" onclick="deleteVideo('${v.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#999;padding:2rem">No videos yet. Add a YouTube URL above.</td></tr>';
  } catch(e) { adminToast('Failed to load videos', 'error'); }
}

window.updateVideoTitle = async (id, title) => {
  try {
    await apiFetch('/api/admin/videos/' + id, 'PUT', { title });
    adminToast('Title updated!', 'success');
  } catch(e) { adminToast('Update failed', 'error'); }
};

document.getElementById('addVideoBtn')?.addEventListener('click', () => {
  const f = document.getElementById('addVideoForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('cancelVideoBtn')?.addEventListener('click', () => {
  document.getElementById('addVideoForm').style.display = 'none';
});
document.getElementById('saveVideoBtn')?.addEventListener('click', async () => {
  const url   = document.getElementById('videoUrl').value.trim();
  const title = document.getElementById('videoTitle').value.trim();
  const type  = document.getElementById('videoType').value;
  if (!url) { adminToast('Please enter a YouTube URL', 'error'); return; }
  try {
    await apiFetch('/api/admin/videos', 'POST', { url, title, type });
    document.getElementById('videoUrl').value   = '';
    document.getElementById('videoTitle').value = '';
    document.getElementById('addVideoForm').style.display = 'none';
    adminToast('Video added!', 'success');
    loadVideosTab();
  } catch(e) { adminToast('Error: ' + e.message, 'error'); }
});
window.deleteVideo = (id) => {
  showConfirm('Remove this video?', async () => {
    await apiFetch('/api/admin/videos/' + id, 'DELETE');
    adminToast('Video removed', 'success');
    loadVideosTab();
  });
};

// ── Messages Tab ──────────────────────────────────────
let allMessages = [];
async function loadMessagesTab() {
  try {
    allMessages = await apiFetch('/api/admin/messages');
    renderMessagesTable();
    updateMsgBadge();
  } catch(e) { adminToast('Failed to load messages', 'error'); }
}

function updateMsgBadge() {
  const unread = allMessages.filter(m => !m.read).length;
  const badge  = document.getElementById('msgBadge');
  if (badge) { badge.textContent = unread; badge.style.display = unread ? 'inline' : 'none'; }
}

function renderMessagesTable() {
  const tbody = document.querySelector('#messagesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = allMessages.length ? allMessages.map((m, i) => `
    <tr style="${!m.read ? 'font-weight:600;background:#fffbf7' : ''}">
      <td>${i+1}</td>
      <td>${escHtml(m.name)}</td>
      <td>${escHtml(m.phone || '—')}</td>
      <td>${escHtml(m.subject || '—')}</td>
      <td>${fmtDate(m.date)}</td>
      <td><span class="${m.read ? 'badge-read':'badge-unread'}">${m.read ? 'Read':'New'}</span></td>
      <td style="display:flex;gap:.4rem;flex-wrap:wrap">
        <button class="view-btn" onclick="viewMessage('${m.id}')"><i class="fas fa-eye"></i></button>
        <a href="${buildWALink(m)}" target="_blank" class="btn-whatsapp-admin" style="font-size:.75rem;padding:.3rem .6rem"><i class="fab fa-whatsapp"></i></a>
        <button class="table-action-btn del" onclick="deleteMessage('${m.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('')
  : '<tr><td colspan="7" style="text-align:center;color:#999;padding:2rem">No messages yet.</td></tr>';
}

function buildWALink(m) {
  const text = encodeURIComponent(`*Reply to: ${m.name}*\n\nHi ${m.name.split(' ')[0]},\n\nThank you for contacting Anath Shiksha Foundation!`);
  const phone = (m.phone||'').replace(/[^0-9]/g,'');
  if (!phone) return '#';
  return `https://wa.me/${phone.startsWith('91') ? phone : '91'+phone}?text=${text}`;
}

window.viewMessage = async (id) => {
  const m = allMessages.find(x => x.id === id);
  if (!m) return;
  // mark read
  if (!m.read) {
    await apiFetch('/api/admin/messages/' + id + '/read', 'PUT');
    m.read = true; renderMessagesTable(); updateMsgBadge();
  }
  // show in modal
  document.getElementById('confirmMsg').innerHTML = `
    <div style="text-align:left">
      <div class="msg-meta-grid">
        <div class="msg-meta-item"><label>From</label><p>${escHtml(m.name)}</p></div>
        <div class="msg-meta-item"><label>Phone</label><p>${escHtml(m.phone||'—')}</p></div>
        <div class="msg-meta-item"><label>Email</label><p>${escHtml(m.email||'—')}</p></div>
        <div class="msg-meta-item"><label>Subject</label><p>${escHtml(m.subject||'—')}</p></div>
      </div>
      <p style="font-size:.78rem;color:#999;margin-bottom:.5rem">${fmtDate(m.date)}</p>
      <div class="msg-detail-body">${escHtml(m.message)}</div>
    </div>`;
  document.getElementById('confirmYes').style.display = 'none';
  document.getElementById('confirmNo').textContent = 'Close';
  document.getElementById('confirmModal').style.display = 'flex';
};
// Restore confirm modal button on close
document.getElementById('confirmNo')?.addEventListener('click', () => {
  document.getElementById('confirmYes').style.display = '';
  document.getElementById('confirmNo').textContent = 'Cancel';
});

window.deleteMessage = (id) => {
  showConfirm('Delete this message?', async () => {
    await apiFetch('/api/admin/messages/' + id, 'DELETE');
    allMessages = allMessages.filter(m => m.id !== id);
    renderMessagesTable(); updateMsgBadge();
    adminToast('Message deleted', 'success');
  });
};

// ── Payment Settings Tab ──────────────────────────────
async function loadPaymentTab() {
  try {
    const s = await apiFetch('/api/admin/payment-settings');
    const upiEl = document.getElementById('ps_upiId');
    if (upiEl && s.upiId) upiEl.value = s.upiId;
    const preview = document.getElementById('ps_qrPreview');
    const img     = document.getElementById('ps_qrImg');
    if (s.qrImage && preview && img) {
      img.src = s.qrImage; preview.style.display = 'block';
    }
  } catch(e) { adminToast('Failed to load payment settings', 'error'); }
}

document.getElementById('ps_clearQr')?.addEventListener('click', async () => {
  const fd = new FormData();
  fd.append('clearQr', 'true');
  await fetch('/api/admin/payment-settings', { method: 'PUT', body: fd, headers: { Authorization: 'Bearer ' + TOKEN } });
  document.getElementById('ps_qrPreview').style.display = 'none';
  adminToast('Custom QR removed', 'success');
});

document.getElementById('savePaymentBtn')?.addEventListener('click', async () => {
  const upiId  = document.getElementById('ps_upiId')?.value.trim();
  const file   = document.getElementById('ps_qrFile')?.files[0];
  const status = document.getElementById('psStatus');
  const btn    = document.getElementById('savePaymentBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    const fd = new FormData();
    if (upiId) fd.append('upiId', upiId);
    if (file)  fd.append('qrImage', file);
    const res  = await fetch('/api/admin/payment-settings', { method: 'PUT', body: fd, headers: { Authorization: 'Bearer ' + TOKEN } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.settings?.qrImage) {
      document.getElementById('ps_qrImg').src = data.settings.qrImage;
      document.getElementById('ps_qrPreview').style.display = 'block';
    }
    status.textContent = '✅ Saved!';
    setTimeout(() => status.textContent = '', 3000);
    adminToast('Payment settings saved!', 'success');
  } catch(e) { adminToast('Error: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Payment Settings'; }
});

// Load unread badge on dashboard load
const _origLoadDash = loadDashboard;
loadDashboard = async function() {
  await _origLoadDash();
  try {
    const msgs = await apiFetch('/api/admin/messages');
    allMessages = msgs;
    updateMsgBadge();
  } catch(e) {}
};

// ── Scholarships Tab ──────────────────────────────────
let allScholarships = [];

async function loadScholarshipsTab() {
  try {
    allScholarships = await apiFetch('/api/admin/scholarships');
    renderScholarshipsTable();
    renderScholarStats();
  } catch(e) { adminToast('Failed to load scholarships', 'error'); }
}

function renderScholarStats() {
  const total    = allScholarships.length;
  const awarded  = allScholarships.filter(a => a.scholarshipAwarded).length;
  const newApps  = allScholarships.filter(a => a.status === 'New').length;
  const exams    = [...new Set(allScholarships.map(a => a.examApplying))].length;
  const el = document.getElementById('scholAdminStats');
  if (!el) return;
  el.innerHTML = [
    { icon:'fas fa-file-alt', bg:'#FF6B3520', color:'#FF6B35', num: total,   label:'Total Applications' },
    { icon:'fas fa-star',     bg:'#4CAF5020', color:'#4CAF50', num: awarded,  label:'Scholarships Awarded' },
    { icon:'fas fa-bell',     bg:'#2196F320', color:'#2196F3', num: newApps,  label:'New / Pending' },
    { icon:'fas fa-pen-nib',  bg:'#9C27B020', color:'#9C27B0', num: exams,    label:'Exam Categories' }
  ].map(s => `
    <div class="dash-stat">
      <div class="dash-stat-icon" style="background:${s.bg};color:${s.color}"><i class="${s.icon}"></i></div>
      <div><div class="dash-stat-num">${s.num}</div><div class="dash-stat-label">${s.label}</div></div>
    </div>`).join('');
}

function renderScholarshipsTable() {
  const filterExam   = document.getElementById('scholFilterExam')?.value   || '';
  const filterStatus = document.getElementById('scholFilterStatus')?.value || '';
  let list = allScholarships;
  if (filterExam)   list = list.filter(a => a.examApplying === filterExam);
  if (filterStatus) list = list.filter(a => a.status === filterStatus);

  const tbody = document.querySelector('#scholTable tbody');
  if (!tbody) return;

  const statusColors = { New:'#e3f2fd:#1565c0', Shortlisted:'#fff8e1:#e65100', 'Exam Scheduled':'#f3e5f5:#7b1fa2', Awarded:'#e8f5e9:#2e7d32', Rejected:'#ffebee:#c62828' };

  tbody.innerHTML = list.length ? list.map((a, i) => {
    const sc = (statusColors[a.status] || '#f5f5f5:#333').split(':');
    const photo = a.photo ? `<img src="${escHtml(a.photo)}" style="width:36px;height:36px;object-fit:cover;border-radius:50%;border:2px solid #7b1fa2"/>` : `<span style="display:inline-flex;width:36px;height:36px;border-radius:50%;background:#7b1fa2;color:#fff;align-items:center;justify-content:center;font-weight:700">${(a.fullName||'?')[0].toUpperCase()}</span>`;
    return `<tr>
      <td>${i+1}</td>
      <td>${photo}</td>
      <td style="font-weight:600">${escHtml(a.fullName)}</td>
      <td>${escHtml(a.currentClass)}</td>
      <td style="font-size:.78rem;max-width:130px;white-space:normal">${escHtml(a.examApplying)}</td>
      <td style="font-size:.8rem">${escHtml(a.schoolName||'—')}</td>
      <td>${escHtml(a.phone)}</td>
      <td>${escHtml(a.state||'—')}</td>
      <td>${fmtDate(a.submittedAt)}</td>
      <td><input type="number" value="${a.score||''}" placeholder="—" style="width:60px;border:1px solid #ddd;border-radius:4px;padding:.2rem .4rem;font-size:.82rem" onchange="updateScholar('${a.id}',{score:this.value?Number(this.value):null})"/></td>
      <td><input type="number" value="${a.rank||''}" placeholder="—" style="width:55px;border:1px solid #ddd;border-radius:4px;padding:.2rem .4rem;font-size:.82rem" onchange="updateScholar('${a.id}',{rank:this.value?Number(this.value):null})"/></td>
      <td>
        <select class="status-select" style="background:${sc[0]};color:${sc[1]}" onchange="updateScholar('${a.id}',{status:this.value})">
          ${['New','Shortlisted','Exam Scheduled','Awarded','Rejected'].map(s=>`<option ${a.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="display:flex;gap:.3rem">
        <button class="view-btn" onclick="viewScholarship('${a.id}')"><i class="fas fa-eye"></i></button>
        <button class="table-action-btn del" onclick="deleteScholarship('${a.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('')
  : '<tr><td colspan="13" style="text-align:center;color:#999;padding:2rem">No scholarship applications yet.</td></tr>';
}

// Filter listeners
document.getElementById('scholFilterExam')?.addEventListener('change', renderScholarshipsTable);
document.getElementById('scholFilterStatus')?.addEventListener('change', renderScholarshipsTable);

window.updateScholar = async (id, update) => {
  try {
    await apiFetch('/api/admin/scholarships/' + id, 'PUT', update);
    const idx = allScholarships.findIndex(a => a.id === id);
    if (idx > -1) allScholarships[idx] = { ...allScholarships[idx], ...update };
    renderScholarStats();
    adminToast('Updated!', 'success');
  } catch(e) { adminToast('Update failed', 'error'); }
};

window.viewScholarship = (id) => {
  const a = allScholarships.find(x => x.id === id);
  if (!a) return;
  document.getElementById('scholDetailTitle').textContent = a.fullName + ' — ' + a.examApplying;
  document.getElementById('scholDetailBody').innerHTML = `
    ${a.photo ? `<div style="text-align:center;margin-bottom:1.2rem"><img src="${escHtml(a.photo)}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #7b1fa2"/></div>` : ''}
    <div class="app-detail-grid" style="grid-template-columns:1fr 1fr 1fr">
      <div class="app-detail-item"><label>Full Name</label><p>${escHtml(a.fullName)}</p></div>
      <div class="app-detail-item"><label>Date of Birth</label><p>${escHtml(a.dob||'—')}</p></div>
      <div class="app-detail-item"><label>Gender</label><p>${escHtml(a.gender||'—')}</p></div>
      <div class="app-detail-item"><label>Category</label><p>${escHtml(a.category||'—')}</p></div>
      <div class="app-detail-item"><label>Father</label><p>${escHtml(a.fatherName||'—')}</p></div>
      <div class="app-detail-item"><label>Mother</label><p>${escHtml(a.motherName||'—')}</p></div>
      <div class="app-detail-item"><label>Phone</label><p>${escHtml(a.phone)}</p></div>
      <div class="app-detail-item"><label>Email</label><p>${escHtml(a.email||'—')}</p></div>
      <div class="app-detail-item"><label>State</label><p>${escHtml(a.state||'—')}</p></div>
      <div class="app-detail-item"><label>Address</label><p>${escHtml(a.address||'—')}</p></div>
      <div class="app-detail-item"><label>Pincode</label><p>${escHtml(a.pincode||'—')}</p></div>
      <div class="app-detail-item"><label>Current Class</label><p>${escHtml(a.currentClass)}</p></div>
      <div class="app-detail-item"><label>School</label><p>${escHtml(a.schoolName||'—')}</p></div>
      <div class="app-detail-item"><label>Board</label><p>${escHtml(a.boardName||'—')}</p></div>
      <div class="app-detail-item"><label>Last Year %</label><p>${escHtml(a.lastYearPercent||'—')}</p></div>
      <div class="app-detail-item"><label>Exam Applying</label><p><strong>${escHtml(a.examApplying)}</strong></p></div>
      <div class="app-detail-item"><label>Score</label><p>${a.score ?? '—'}</p></div>
      <div class="app-detail-item"><label>Rank</label><p>${a.rank ?? '—'}</p></div>
    </div>
    ${a.achievements ? `<div class="app-detail-item" style="margin-bottom:.8rem"><label>Achievements</label><p>${escHtml(a.achievements)}</p></div>` : ''}
    <div class="app-detail-item" style="margin-bottom:.4rem"><label>Why They Deserve This Scholarship</label></div>
    <div class="app-detail-why">${escHtml(a.whyDeserve)}</div>
    <div style="display:flex;gap:.8rem;align-items:center;flex-wrap:wrap">
      <span style="font-size:.82rem;color:#888">Application ID: <code>${a.id}</code></span>
      <span style="font-size:.82rem;color:#888">Submitted: ${fmtDate(a.submittedAt)}</span>
    </div>`;
  document.getElementById('scholDetailModal').style.display = 'flex';
};

window.deleteScholarship = (id) => {
  showConfirm('Delete this scholarship application?', async () => {
    await apiFetch('/api/admin/scholarships/' + id, 'DELETE');
    allScholarships = allScholarships.filter(a => a.id !== id);
    renderScholarshipsTable();
    renderScholarStats();
    adminToast('Application deleted', 'success');
  });
};

// ── CEO Photo upload ──────────────────────────────────
document.getElementById('c_ceoPhotoFile')?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('photo', file);
  try {
    const res  = await fetch('/api/admin/upload/ceo-photo', { method: 'POST', body: fd, headers: { Authorization: 'Bearer ' + TOKEN } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('c_ceoPhotoImg').src = data.url;
    document.getElementById('c_ceoPhotoPreview').style.display = 'flex';
    adminToast('CEO photo uploaded!', 'success');
  } catch(e) { adminToast('Upload failed: ' + e.message, 'error'); }
});

document.getElementById('c_ceoClearPhoto')?.addEventListener('click', async () => {
  try {
    await fetch('/api/admin/upload/ceo-photo', { method: 'DELETE', headers: { Authorization: 'Bearer ' + TOKEN } });
    document.getElementById('c_ceoPhotoPreview').style.display = 'none';
    document.getElementById('c_ceoPhotoFile').value = '';
    adminToast('CEO photo removed', 'success');
  } catch(e) { adminToast('Remove failed', 'error'); }
});

// ── Scholarship Exam Tiers Editor ────────────────────
let examTiers = [];

function renderExamTiers() {
  const container = document.getElementById('examTiersEditor');
  if (!container) return;
  if (!examTiers.length) {
    container.innerHTML = '<p style="color:#999;font-size:.82rem;text-align:center;padding:.8rem">No exam tiers yet. Click "Add Tier" to create one.</p>';
    return;
  }
  container.innerHTML = examTiers.map((ex, i) => `
    <div class="exam-tier-card" id="exam-tier-${i}">
      <div class="exam-tier-header" onclick="toggleExamCollapse(${i})">
        <div class="exam-tier-title">
          <span style="background:var(--primary);color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem">${i+1}</span>
          ${escHtml(ex.name || 'New Tier')} <span style="font-size:.75rem;color:#999;font-weight:400">${escHtml(ex.classes||'')}</span>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <button class="exam-tier-del" onclick="event.stopPropagation();removeExamTier(${i})"><i class="fas fa-trash"></i></button>
          <i class="fas fa-chevron-down exam-tier-collapse-icon" style="color:#999;font-size:.8rem"></i>
        </div>
      </div>
      <div class="exam-tier-body">
        <div class="field-group"><label>Exam Name</label>
          <input type="text" value="${escHtml(ex.name||'')}" placeholder="e.g. ASF Junior Scholar" oninput="updateExamField(${i},'name',this.value)"/></div>
        <div class="field-group"><label>Classes</label>
          <input type="text" value="${escHtml(ex.classes||'')}" placeholder="e.g. Class 6 – 8" oninput="updateExamField(${i},'classes',this.value)"/></div>
        <div class="field-group"><label>Award Amount</label>
          <input type="text" value="${escHtml(ex.award||'')}" placeholder="e.g. ₹10,000/year" oninput="updateExamField(${i},'award',this.value)"/></div>
        <div class="field-group"><label>No. of Seats</label>
          <input type="number" value="${ex.seats||''}" placeholder="50" oninput="updateExamField(${i},'seats',Number(this.value))"/></div>
        <div class="field-group full"><label>Subjects</label>
          <input type="text" value="${escHtml(ex.subjects||'')}" placeholder="Maths, Science, English..." oninput="updateExamField(${i},'subjects',this.value)"/></div>
        <div class="field-group full"><label>Description</label>
          <textarea rows="2" oninput="updateExamField(${i},'description',this.value)" placeholder="Details about this tier...">${escHtml(ex.description||'')}</textarea></div>
      </div>
    </div>`).join('');
}

window.toggleExamCollapse = (i) => {
  document.getElementById('exam-tier-' + i)?.classList.toggle('collapsed');
};
window.updateExamField = (i, key, val) => { if (examTiers[i]) examTiers[i][key] = val; };
window.removeExamTier  = (i) => { examTiers.splice(i, 1); renderExamTiers(); };

document.getElementById('addExamBtn')?.addEventListener('click', () => {
  examTiers.push({ id: 'E' + Date.now(), name: '', classes: '', award: '', seats: 0, subjects: '', description: '' });
  renderExamTiers();
});

// Load exams when content form loads — hook into loadContentForm
const _origLoadContent = loadContentForm;
loadContentForm = async function() {
  await _origLoadContent();
  try {
    const c = await fetch('/api/content').then(r => r.json());
    examTiers = JSON.parse(JSON.stringify(c.scholarship?.exams || []));
    renderExamTiers();
  } catch(e) {}
};

// Include exams in save — hook into saveContentBtn
const origSaveClick = document.getElementById('saveContentBtn')?._saveHandler;
document.getElementById('saveContentBtn')?.addEventListener('click', async () => {
  // Patch scholarship.exams into the save payload via a separate request
  if (!examTiers) return;
  try {
    const c = await fetch('/api/content').then(r => r.json());
    c.scholarship = { ...(c.scholarship || {}), exams: examTiers };
    await fetch('/api/admin/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify({ scholarship: c.scholarship })
    });
  } catch(e) { console.warn('Exam save issue:', e); }
});

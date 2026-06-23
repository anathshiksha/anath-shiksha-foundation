/* ════════════════════════════════════════
   ADMIN PANEL JAVASCRIPT
   Anath Shiksha Foundation
════════════════════════════════════════ */

'use strict';

// No login required — dashboard is always accessible
let TOKEN = 'no-auth';
let ADMIN_USER = 'Admin';

// ── Init ──────────────────────────────────────────────
(function init() {
  showDash();
})();

// ── (Login kept as no-op for backward compat) ─────────
function showLogin() { showDash(); }
function showDash() {
  const ls = document.getElementById('loginScreen');
  if (ls) ls.style.display = 'none';
  const dash = document.getElementById('adminDash');
  if (dash) dash.style.display = 'flex';
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
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
  btn.disabled  = true;
  err.style.display = 'none';
  try {
    const res = await apiFetch('/api/admin/login', 'POST', {
      username: document.getElementById('loginUser').value,
      password: document.getElementById('loginPass').value
    });
    TOKEN      = res.token;
    ADMIN_USER = res.username;
    localStorage.setItem('asf_admin_token', TOKEN);
    localStorage.setItem('asf_admin_user',  ADMIN_USER);
    showDash();
  } catch(ex) {
    err.textContent   = ex.message || 'Invalid username or password';
    err.style.display = 'block';
  } finally {
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    btn.disabled  = false;
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  TOKEN = ''; ADMIN_USER = 'admin';
  localStorage.removeItem('asf_admin_token');
  localStorage.removeItem('asf_admin_user');
  showLogin();
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
  } catch(e) { adminToast('Failed to load content', 'error'); }
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val != null) el.value = val;
}

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

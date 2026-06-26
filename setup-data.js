/**
 * setup-data.js — runs at Render build time
 * Copies seed data files to persistent disk on first deploy only.
 * On subsequent deploys, existing data (admin edits) is preserved.
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR    = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure directories exist on the persistent disk
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created directory:', dir);
  }
});

// Seed files — only copy if they don't exist yet on disk
const seeds = [
  'content.json',
  'events.json',
  'donors.json',
  'applications.json',
  'gallery.json',
  'messages.json',
  'payment.json',
  'scholarships.json',
  'videos.json',
  'admin.json'
];

seeds.forEach(file => {
  const dest = path.join(DATA_DIR, file);
  const src  = path.join(__dirname, 'data-seed', file);
  if (!fs.existsSync(dest)) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log('✅ Seeded:', file);
    } else {
      // Create empty defaults
      const defaults = {
        'messages.json':     '[]',
        'videos.json':       '[]',
        'scholarships.json': '[]',
        'applications.json': '[]',
        'gallery.json':      '[]',
        'payment.json':      '{"upiId":"anathshikshafoundation@ybl","qrImage":null}'
      };
      if (defaults[file]) {
        fs.writeFileSync(dest, defaults[file]);
        console.log('✅ Created default:', file);
      }
    }
  } else {
    console.log('⏭  Kept existing:', file, '(admin data preserved)');
  }
});

console.log('\n✅ Data setup complete.\n');

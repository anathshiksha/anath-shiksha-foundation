const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const adminFile = path.join(__dirname, 'data', 'admin.json');
const adminData = {
  username: 'admin',
  passwordHash: bcrypt.hashSync('Admin@2024', 10)
};
fs.writeFileSync(adminFile, JSON.stringify(adminData, null, 2));
console.log('✅ Admin credentials set: username=admin, password=Admin@2024');
console.log('⚠️  Please change the password after first login!');

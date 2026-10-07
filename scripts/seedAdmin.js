/** Creates (or promotes) the admin account from ADMIN_* variables in .env */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  let user = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (user) {
    user.role = 'admin';
    user.password = ADMIN_PASSWORD;
    user.isBlocked = false;
    await user.save();
    console.log(`Updated existing user as admin: ${user.email}`);
  } else {
    user = await User.create({ name: ADMIN_NAME || 'Darazify Admin', email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });
    console.log(`Admin created: ${user.email}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });

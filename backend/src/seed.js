// Loads the Ahmars Food menu and creates the first admin.  Run:  npm run seed
import crypto from 'crypto';
import mongoose from 'mongoose';
import { assertEnv } from './config/env.js';
import { connectDB } from './config/db.js';
import Food from './models/Food.js';
import User from './models/User.js';
import { normalizePhone } from './utils/phone.js';

const MENU = [
  ['Amala + Ewedu & Gbegiri', 'Swallow & Soups', 1500, 'Soft amala with a duo of ewedu and gbegiri soup.', 20],
  ['Pounded Yam + Egusi Soup', 'Swallow & Soups', 1800, 'Classic pounded yam, rich egusi with assorted meat.', 25],
  ['Poundo + Ogbono Soup', 'Swallow & Soups', 1700, 'Smooth poundo yam with draw ogbono soup.', 20],
  ['Eba + Vegetable Soup', 'Swallow & Soups', 1500, 'Garri eba served with vegetable soup and fish.', 20],
  ['Jollof Rice + Chicken', 'Rice', 1800, 'Smoky party-style jollof with grilled chicken.', 20],
  ['Fried Rice + Turkey', 'Rice', 2000, 'Vegetable fried rice with a turkey portion.', 20],
  ['Jollof & Fried Rice Combo', 'Rice', 1900, 'Half and half, with a protein of your choice.', 20],
  ['Chicken Shawarma', 'Shawarma', 1500, 'Grilled chicken, veggies and sauce, wrapped fresh.', 12],
  ['Beef Shawarma', 'Shawarma', 1600, 'Seasoned beef strips in a warm tortilla wrap.', 12],
  ['Shawarma Combo', 'Shawarma', 2000, 'Any shawarma plus a chilled drink of your choice.', 12],
  ['Kunu Aya', 'Drinks', 500, 'Chilled, spiced tigernut and cereal drink.', 5],
  ['Yoghurt (Chilled)', 'Drinks', 700, 'Cool, creamy yoghurt, plain or fruit-mixed.', 5],
  ['Arabian Tea', 'Drinks', 600, 'Aromatic spiced tea, served hot or iced.', 8],
];

assertEnv();
await connectDB();

for (const [name, category, price, description, prepTime] of MENU) {
  await Food.updateOne({ name }, { $setOnInsert: { name, category, price, description, prepTime, isAvailable: true } }, { upsert: true });
}
console.log(`Menu ready (${MENU.length} items; existing items were left untouched)`);

const phone = normalizePhone(process.env.ADMIN_PHONE || '');
if (phone && !(await User.findOne({ role: 'admin' }))) {
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  await User.create({ name: process.env.ADMIN_NAME || 'Admin', phone, password, role: 'admin' });
  console.log(`Admin created. Login: ${phone}   Password: ${password}   (change it, this is shown once)`);
} else {
  console.log('Admin step skipped (an admin exists, or ADMIN_PHONE is not set)');
}

await mongoose.disconnect();

// backend/auth.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_for_localdev';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}
function comparePassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function ensureAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Bad Authorization format' });
  const token = parts[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  req.user = payload; // payload should contain at least { id, email }
  next();
}

module.exports = { hashPassword, comparePassword, generateToken, verifyToken, ensureAuth, uuidv4 };

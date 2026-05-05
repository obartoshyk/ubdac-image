import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import passport, { googleEnabled } from '../passport.js';
import { pool } from '../db.js';
import { secret } from '../secrets.js';

const FRONTEND_URL = secret('FRONTEND_URL') || 'http://localhost:5173';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

function makeToken(userId) {
  return jwt.sign({ sub: userId }, secret('JWT_SECRET'), { expiresIn: '7d' });
}

function requireAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  try {
    return jwt.verify(auth.slice(7), secret('JWT_SECRET')).sub;
  } catch {
    res.status(401).json({ error: 'Invalid token' }); return null;
  }
}

// POST /api/auth/register
router.post('/register', upload.single('photo'), async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hash = await bcrypt.hash(password, 12);
    const photo = req.file?.buffer ?? null;
    const photoMime = req.file?.mimetype ?? null;

    const { rows } = await pool.query(
      'INSERT INTO users (email, name, password, photo, photo_mime) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [email, name, hash, photo, photoMime]
    );
    res.json({ token: makeToken(rows[0].id) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    next(e);
  }
});

// GET /api/auth/google  — begin OAuth flow
router.get('/google', (req, res, next) => {
  if (!googleEnabled) return res.status(501).json({ error: 'Google OAuth is not configured' });
  passport.authenticate('google', { scope: ['email', 'profile'], session: false })(req, res, next);
});

// GET /api/auth/google/callback  — Google redirects here with the auth code
router.get('/google/callback', (req, res, next) => {
  if (!googleEnabled) return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=google_failed`,
  })(req, res, next);
}, (req, res) => {
  const token = makeToken(req.user.id);
  // Pass the JWT to the frontend via URL param; the client reads it and removes it from the address bar
  res.redirect(`${FRONTEND_URL}/?token=${token}`);
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];
    if (!user || !user.password)
      return res.status(401).json({ error: 'Invalid email or password' });
    if (!(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ token: makeToken(user.id) });
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { rows } = await pool.query(
      `SELECT id, email, name, balance, (photo IS NOT NULL) AS has_photo, created_at
       FROM users WHERE id=$1`,
      [userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];
    res.json({
      ...user,
      photo_url: user.has_photo ? `/api/auth/photo/${user.id}` : null,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/photo/:id  — public, serves the stored image blob
router.get('/photo/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT photo, photo_mime FROM users WHERE id=$1',
      [req.params.id]
    );
    const user = rows[0];
    if (!user?.photo) return res.status(404).end();

    res.set('Content-Type', user.photo_mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(user.photo);
  } catch (e) {
    next(e);
  }
});

export default router;

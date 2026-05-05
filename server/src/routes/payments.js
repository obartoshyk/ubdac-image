import express from 'express';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { secret } from '../secrets.js';

const FRONTEND_URL    = secret('FRONTEND_URL') || 'http://localhost:5173';
const WEBHOOK_SECRET  = secret('STRIPE_WEBHOOK_SECRET');

export const stripeEnabled = !!secret('STRIPE_SECRET_KEY');

const stripe = stripeEnabled ? new Stripe(secret('STRIPE_SECRET_KEY')) : null;

const router = express.Router();

function getUserId(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  try {
    return jwt.verify(auth.slice(7), secret('JWT_SECRET')).sub;
  } catch {
    res.status(401).json({ error: 'Invalid token' }); return null;
  }
}

// Credits a Stripe session to a user's balance — idempotent via stripe_sessions PK.
async function creditSession(sessionId, userId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') return false;
  if (String(session.metadata?.user_id) !== String(userId)) return false;

  const amount = Number(session.metadata?.amount ?? session.amount_total / 100);

  const { rowCount } = await pool.query(
    `INSERT INTO stripe_sessions (session_id, user_id, amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, userId, amount],
  );

  if (rowCount > 0) {
    await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [amount, userId],
    );
  }
  return true;
}

// POST /api/payments/create-checkout
router.post('/create-checkout', async (req, res, next) => {
  try {
    if (!stripeEnabled) return res.status(501).json({ error: 'Stripe is not configured' });

    const userId = getUserId(req, res);
    if (!userId) return;

    const amount = Number(req.body.amount);
    if (!amount || amount < 1 || amount > 10000)
      return res.status(400).json({ error: 'Amount must be between $1 and $10,000' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Ubdac Soft Limited — Balance top-up' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${FRONTEND_URL}/account?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${FRONTEND_URL}/account?topup=canceled`,
      metadata: { user_id: String(userId), amount: String(amount) },
    });

    res.json({ url: session.url });
  } catch (e) {
    next(e);
  }
});

// POST /api/payments/verify  — called by the client on the success redirect
router.post('/verify', async (req, res, next) => {
  try {
    if (!stripeEnabled) return res.status(501).json({ error: 'Stripe is not configured' });

    const userId = getUserId(req, res);
    if (!userId) return;

    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    await creditSession(session_id, userId);

    const { rows } = await pool.query('SELECT balance FROM users WHERE id=$1', [userId]);
    res.json({ balance: rows[0]?.balance ?? 0 });
  } catch (e) {
    next(e);
  }
});

// GET /api/payments/history
router.get('/history', async (req, res, next) => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { rows } = await pool.query(
      `SELECT session_id, amount, created_at
       FROM stripe_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// POST /api/payments/webhook  — called by Stripe (raw body, mounted before express.json())
export async function webhookHandler(req, res) {
  if (!stripeEnabled || !WEBHOOK_SECRET) return res.status(501).end();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      WEBHOOK_SECRET,
    );
  } catch (e) {
    return res.status(400).send(`Webhook signature error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId  = session.metadata?.user_id;
    if (userId) {
      await creditSession(session.id, Number(userId)).catch(console.error);
    }
  }

  res.json({ received: true });
}

export default router;

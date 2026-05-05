import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { pool } from './db.js';
import { secret } from './secrets.js';

const CALLBACK_URL =
  secret('GOOGLE_CALLBACK_URL') || 'http://localhost:3001/api/auth/google/callback';

const CLIENT_ID     = secret('GOOGLE_CLIENT_ID');
const CLIENT_SECRET = secret('GOOGLE_CLIENT_SECRET');

export const googleEnabled = !!(CLIENT_ID && CLIENT_SECRET);

async function fetchGooglePhoto(url) {
  if (!url) return { buffer: null, mime: null };
  try {
    // Request maximum resolution instead of the default 96px
    const fullUrl = url.replace(/=s\d+(-c)?$/, '=s400-c');
    const res = await fetch(fullUrl);
    if (!res.ok) return { buffer: null, mime: null };
    const mime = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, mime };
  } catch {
    return { buffer: null, mime: null };
  }
}

if (googleEnabled) passport.use(
  new GoogleStrategy(
    {
      clientID:     CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      callbackURL:  CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('Google account has no email'));

        const photoUrl = profile.photos?.[0]?.value ?? null;

        // 1. Account with this google_id exists — always refresh photo on login
        let { rows } = await pool.query(
          'SELECT id FROM users WHERE google_id = $1',
          [profile.id]
        );
        if (rows[0]) {
          if (photoUrl) {
            const { buffer, mime } = await fetchGooglePhoto(photoUrl);
            if (buffer) {
              await pool.query(
                'UPDATE users SET photo = $1, photo_mime = $2 WHERE id = $3',
                [buffer, mime, rows[0].id]
              );
            }
          }
          return done(null, rows[0]);
        }

        // 2. Account with this email exists — link google_id and update photo
        ({ rows } = await pool.query(
          'SELECT id, photo FROM users WHERE email = $1',
          [email]
        ));
        if (rows[0]) {
          if (photoUrl) {
            const { buffer, mime } = await fetchGooglePhoto(photoUrl);
            await pool.query(
              'UPDATE users SET google_id = $1, photo = $2, photo_mime = $3 WHERE id = $4',
              [profile.id, buffer, mime, rows[0].id]
            );
          } else {
            await pool.query(
              'UPDATE users SET google_id = $1 WHERE id = $2',
              [profile.id, rows[0].id]
            );
          }
          return done(null, rows[0]);
        }

        // 3. New user — create record with photo from Google
        const name = profile.displayName || email.split('@')[0];
        const { buffer, mime } = await fetchGooglePhoto(photoUrl);
        ({ rows } = await pool.query(
          `INSERT INTO users (email, name, google_id, photo, photo_mime)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [email, name, profile.id, buffer, mime]
        ));
        done(null, rows[0]);
      } catch (e) {
        done(e);
      }
    }
  )
);

export default passport;

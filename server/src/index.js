import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import passport from './passport.js';
import authRouter from './routes/auth.js';
import { initDb } from './db.js';
import { secret } from './secrets.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: secret('CORS_ORIGIN') || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(passport.initialize());
app.use('/api/auth', authRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

await initDb();
app.listen(PORT, () => console.log(`Server running on :${PORT}`));

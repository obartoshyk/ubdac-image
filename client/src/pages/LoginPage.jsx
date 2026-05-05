import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import GoogleIcon from '../components/GoogleIcon.jsx';
import LangSwitcher from '../components/LangSwitcher.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(
    searchParams.get('error') === 'google_failed' ? 'err_google_failed' : ''
  );
  const [loading, setLoading] = useState(false);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', form);
      await login(data.token);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'err_login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="lang-bar">
          <LangSwitcher />
          <ThemeToggle />
        </div>

        <div className="logo">
          <img src="/PorosenokPetr.png" alt="Ubdac Soft Limited" />
          <h1>Ubdac Soft Limited</h1>
          <span className="tagline">{t('tagline_welcome')}</span>
        </div>

        <h2>{t('signin_title')}</h2>

        <a href="/api/auth/google" className="btn-google">
          <GoogleIcon />
          {t('continue_google')}
        </a>

        <div className="auth-divider">{t('or')}</div>

        <form className="form" onSubmit={submit}>
          {error && <div className="error">{t(error) === error ? error : t(error)}</div>}

          <label>
            {t('email')}
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
              autoFocus
            />
          </label>

          <label>
            {t('password')}
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete="current-password"
              required
            />
          </label>

          <button className="btn" disabled={loading}>
            {loading ? t('btn_signin_loading') : t('btn_signin')}
          </button>
        </form>

        <p className="link-row">
          {t('no_account')} <Link to="/register">{t('create_one')}</Link>
        </p>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import GoogleIcon from '../components/GoogleIcon.jsx';
import LangSwitcher from '../components/LangSwitcher.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function RegisterPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const { t } = useLang();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  function pickPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (photo) fd.append('photo', photo);
      const { data } = await axios.post('/api/auth/register', fd);
      await login(data.token);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || t('err_register'));
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
          <span className="tagline">{t('tagline_register')}</span>
        </div>

        <h2>{t('register_title')}</h2>

        <a href="/api/auth/google" className="btn-google">
          <GoogleIcon />
          {t('continue_google')}
        </a>

        <div className="auth-divider">{t('or')}</div>

        <form className="form" onSubmit={submit}>
          {error && <div className="error">{error}</div>}

          <label>
            {t('full_name')}
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              autoComplete="name"
              required
              autoFocus
            />
          </label>

          <label>
            {t('email')}
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
          </label>

          <label>
            {t('password')}
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder={t('password_hint')}
            />
          </label>

          <label>
            {t('photo')}
            <div
              className="photo-drop"
              onClick={() => fileRef.current.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileRef.current.click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="avatar-preview" />
              ) : (
                <>
                  <span>{t('photo_click')}</span>
                  <div className="hint">{t('photo_hint')}</div>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={pickPhoto}
            />
          </label>

          <button className="btn" disabled={loading}>
            {loading ? t('btn_register_loading') : t('btn_register')}
          </button>
        </form>

        <p className="link-row">
          {t('have_account')} <Link to="/login">{t('btn_signin')}</Link>
        </p>
      </div>
    </div>
  );
}

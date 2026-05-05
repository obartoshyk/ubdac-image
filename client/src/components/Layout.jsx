import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const fmtBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { t }            = useLang();
  const nav              = useNavigate();
  const [open, setOpen]  = useState(false);
  const dropRef          = useRef();

  // close dropdown when clicking outside
  useEffect(() => {
    function onOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="header-brand">
          <img src="/PorosenokPetr.png" alt="logo" className="header-logo" />
          <span className="header-title">Ubdac Soft Limited</span>
        </Link>

        <div className="header-right" ref={dropRef}>
          <LangSwitcher />
          <ThemeToggle />

          <Link to="/account" className="header-balance">
            {fmtBalance.format(user?.balance ?? 0)}
          </Link>

          <button
            className="avatar-btn"
            onClick={() => setOpen(o => !o)}
            aria-label="User menu"
          >
            {user?.photo_url ? (
              <img src={user.photo_url} alt={user.name} className="avatar-img" />
            ) : (
              <span className="avatar-initials">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </button>

          {open && (
            <div className="avatar-dropdown">
              <div className="dropdown-user">
                <span className="dropdown-name">{user?.name}</span>
                <span className="dropdown-email">{user?.email}</span>
              </div>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item"
                onClick={() => { setOpen(false); nav('/account'); }}
              >
                {t('nav_account')}
              </button>
              <button
                className="dropdown-item dropdown-signout"
                onClick={() => { setOpen(false); logout(); }}
              >
                {t('nav_signout')}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}

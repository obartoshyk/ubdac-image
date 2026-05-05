import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const PRESETS = [10, 25, 50, 100];

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export default function AccountPage() {
  const { user, refresh }       = useAuth();
  const { t }                   = useLang();
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const [selected, setSelected] = useState(null);
  const [custom, setCustom]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [alert, setAlert]       = useState(null);
  const [history, setHistory]   = useState([]);

  function fetchHistory() {
    axios.get('/api/payments/history', { headers: authHeaders() })
      .then(r => setHistory(r.data))
      .catch(() => {});
  }

  // Handle Stripe redirect back to this page
  useEffect(() => {
    const status    = searchParams.get('topup');
    const sessionId = searchParams.get('session_id');

    if (status === 'success' && sessionId) {
      setAlert({ type: 'info', msg: t('topup_verifying') });
      axios.post('/api/payments/verify', { session_id: sessionId }, { headers: authHeaders() })
        .then(() => { refresh(); fetchHistory(); setAlert({ type: 'success', msg: t('topup_success') }); })
        .catch(() => { refresh(); fetchHistory(); setAlert({ type: 'success', msg: t('topup_success') }); });
      navigate('/account', { replace: true });
    } else if (status === 'canceled') {
      setAlert({ type: 'error', msg: t('topup_canceled') });
      navigate('/account', { replace: true });
    }

    fetchHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCheckout() {
    const amount = selected ?? Number(custom);
    if (!amount || amount < 1) return;
    setLoading(true);
    try {
      const { data } = await axios.post('/api/payments/create-checkout', { amount }, { headers: authHeaders() });
      window.location.href = data.url;
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.error || 'Error' });
      setLoading(false);
    }
  }

  const payAmount = selected ?? (custom ? Number(custom) : null);

  return (
    <div className="account-page">
      <h1 className="page-title">{t('page_account')}</h1>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="balance-card">
        <span className="balance-label">{t('balance_label')}</span>
        <span className="balance-amount">{fmt.format(user?.balance ?? 0)}</span>
        <span className="balance-currency">USD</span>
      </div>

      <div className="account-info">
        <div className="account-info-row">
          <span className="account-info-label">{t('account_holder')}</span>
          <span className="account-info-value">{user?.name}</span>
        </div>
        <div className="account-info-row">
          <span className="account-info-label">{t('account_email')}</span>
          <span className="account-info-value">{user?.email}</span>
        </div>
        <div className="account-info-row">
          <span className="account-info-label">{t('member_since')}</span>
          <span className="account-info-value">
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : '—'}
          </span>
        </div>
      </div>

      <div className="topup-section">
        <p className="topup-title">{t('topup_title')}</p>

        <div className="topup-amounts">
          {PRESETS.map(p => (
            <button
              key={p}
              className={`topup-amount-btn${selected === p ? ' selected' : ''}`}
              onClick={() => { setSelected(p); setCustom(''); }}
            >
              ${p}
            </button>
          ))}
        </div>

        <input
          type="number"
          className="topup-custom"
          min="1"
          max="10000"
          placeholder={t('topup_custom_placeholder')}
          value={custom}
          onChange={e => { setCustom(e.target.value); setSelected(null); }}
        />

        <button
          className="btn"
          disabled={loading || !payAmount || payAmount < 1}
          onClick={startCheckout}
          style={{ width: '100%' }}
        >
          {loading
            ? t('topup_loading')
            : payAmount
              ? `${t('topup_btn')} — ${fmt.format(payAmount)}`
              : t('topup_btn')}
        </button>
      </div>

      <div className="history-section">
        <p className="history-title">{t('payment_history')}</p>
        {history.length === 0 ? (
          <p className="history-empty">{t('payment_no_history')}</p>
        ) : (
          <div className="history-list">
            {history.map(row => (
              <div key={row.session_id} className="history-row">
                <span className="history-date">
                  {new Date(row.created_at).toLocaleString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span className="history-amount">+{fmt.format(row.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

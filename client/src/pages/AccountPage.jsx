import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function AccountPage() {
  const { user } = useAuth();
  const { t }    = useLang();

  return (
    <div className="account-page">
      <h1 className="page-title">{t('page_account')}</h1>

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
    </div>
  );
}

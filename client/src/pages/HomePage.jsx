import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const { t }    = useLang();

  return (
    <div className="home-page">
      <h1 className="home-greeting">
        {t('welcome', { name: user?.name })}
      </h1>
      <p className="home-sub">{t('signed_in')}</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function DashboardPage() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios
      .get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUser(r.data))
      .catch(() => { localStorage.removeItem('token'); nav('/login'); });
  }, [nav]);

  function logout() {
    localStorage.removeItem('token');
    nav('/login');
  }

  if (!user) return null;

  return (
    <div className="page">
      <div className="card profile-card">
        <div className="logo">
          <img src="/PorosenokPetr.png" alt="Ubdac Soft Limited" />
          <h1>Ubdac Soft Limited</h1>
        </div>

        {user.photo_url ? (
          <img src={user.photo_url} alt={user.name} className="profile-avatar" key={user.id} />
        ) : (
          <div className="profile-initials">
            {user.name[0].toUpperCase()}
          </div>
        )}

        <div className="profile-name">{user.name}</div>
        <div className="profile-email">{user.email}</div>

        <button className="btn-outline" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}

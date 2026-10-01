import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Login from './components/Login.jsx'
import { getStoredUser, signOut } from './auth'

document.addEventListener('wheel', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'number' && document.activeElement === e.target) {
    e.preventDefault();
  }
}, { passive: false });

function Root() {
  const [user, setUser] = useState(getStoredUser);

  if (!user) return <Login onAuth={setUser} />;

  // Revokes the session server-side as well as locally, so the refresh token
  // cannot be used again by anyone who copied it.
  return <App user={user} onLogout={() => { signOut(); setUser(null); }} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

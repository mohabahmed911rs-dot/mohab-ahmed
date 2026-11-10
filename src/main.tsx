import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister any old service workers so the WebApp always runs fresh directly from the server
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    })
    .catch(() => {
      // Ignore service worker cleanup errors
    });
}

createRoot(document.getElementById('root')!).render(<App />);

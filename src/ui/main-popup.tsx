import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import './styles/base.css';
import './styles/components.css';
import './styles/views.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <App surface="popup" />
    </ToastProvider>
  </StrictMode>,
);

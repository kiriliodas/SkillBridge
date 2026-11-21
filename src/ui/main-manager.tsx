import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Manager } from './Manager';
import { ToastProvider } from './components/Toast';
import './styles/base.css';
import './styles/components.css';
import './styles/views.css';
import './styles/manager.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <Manager />
    </ToastProvider>
  </StrictMode>,
);

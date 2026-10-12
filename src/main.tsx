import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootstrap } from './bootstrap';
import './ui/styles.css';

bootstrap().then(
  () => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  },
  (error: unknown) => {
    console.error('Failed to start', error);
  },
);

import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  (window as any).Buffer = (window as any).Buffer || Buffer;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


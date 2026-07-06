import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Configurator from './Configurator.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Configurator />
  </StrictMode>,
);

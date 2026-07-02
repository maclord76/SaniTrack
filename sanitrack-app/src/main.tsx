import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { clearProductCache } from './services/open-food-facts';
import './index.css';

// Vider le cache OpenFoodFacts au démarrage pour forcer le rechargement des données
clearProductCache().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
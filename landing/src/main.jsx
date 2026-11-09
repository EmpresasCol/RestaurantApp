import {createRoot, hydrateRoot} from 'react-dom/client';
import App from './App';

// El HTML ya viene renderizado desde build.cjs; React solo lo hidrata. Sin prerender (desarrollo) renderiza desde cero.
const root = document.getElementById('root');
if (root.hasChildNodes()) hydrateRoot(root, <App />);
else createRoot(root).render(<App />);

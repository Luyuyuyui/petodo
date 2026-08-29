import { createRoot } from 'react-dom/client';
import IconApp from './icon';
import PanelApp from './panel';
import './style.css';

const role = new URLSearchParams(location.search).get('role');
createRoot(document.getElementById('root')!).render(role === 'panel' ? <PanelApp /> : <IconApp />);

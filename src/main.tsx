import ReactDOM from 'react-dom/client';
import React from 'react';
import './styles/index.css';
import { HashRouter } from 'react-router-dom';
import App from './app/App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
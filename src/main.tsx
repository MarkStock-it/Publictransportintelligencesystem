import ReactDOM from 'react-dom/client';
import React from 'react';
import './styles/index.css';
import App from './app/App';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element with id "root" was not found.');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import SoccerPage from './soccer';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <SoccerPage />
  </React.StrictMode>
);

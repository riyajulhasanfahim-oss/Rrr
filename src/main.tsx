import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './lib/theme';
import './lib/i18n';
import { GoogleOAuthProvider } from '@react-oauth/google';
import config from '../firebase-applet-config.json';

const oAuthClientId = (config as any).oAuthClientId || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={oAuthClientId}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);


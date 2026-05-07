import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App.jsx';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7c8cff',
    },
    secondary: {
      main: '#35d0ba',
    },
    background: {
      default: '#0b1020',
      paper: 'rgba(15, 22, 42, 0.88)',
    },
    text: {
      primary: '#eef3ff',
      secondary: '#a4b1d6',
    },
  },
  shape: {
    borderRadius: 20,
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>,
);

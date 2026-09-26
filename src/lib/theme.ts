import { createTheme } from '@mui/material/styles';

// Create a theme instance.
export const theme = createTheme({
  palette: {
    primary: {
      main: '#E91E63', // Requested Primary Color
    },
    secondary: {
      main: '#FF9800', // Requested Secondary Color
    },
    mode: 'light', // Can be toggled to 'dark' for dark mode support
  },
  typography: {
    fontFamily: [
      'Inter',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { zhCN } from '@mui/material/locale';
import { WorkProvider } from './context/WorkContext';
import Layout from './components/Layout';

/**
 * Blue-themed professional MUI theme.
 */
const theme = createTheme(
  {
    palette: {
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#7c3aed',
        light: '#a78bfa',
        dark: '#5b21b6',
      },
      background: {
        default: '#f5f7fa',
      },
    },
    typography: {
      fontFamily: '"Roboto", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h5: {
        fontWeight: 700,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  },
  zhCN,
);

/**
 * Root App component.
 * Sets up MUI theme, then renders the main layout.
 */
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WorkProvider>
        <Layout />
      </WorkProvider>
    </ThemeProvider>
  );
}

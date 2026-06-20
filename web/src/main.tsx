import { createRoot } from 'react-dom/client';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useEffect } from 'react';
import App from './App';
import { useAuthStore } from './store/auth.store';
import * as userApi from './api/user.api';
import { THEME_COLORS } from './utils/constants';
import ToastProvider from './components/common/ToastProvider';

/** 自定义 MUI 主题（雨云风格：蓝/青色系） */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: THEME_COLORS.primary,
      light: THEME_COLORS.primaryLight,
      dark: THEME_COLORS.primaryDark,
    },
    secondary: {
      main: THEME_COLORS.secondary,
    },
    success: {
      main: THEME_COLORS.success,
    },
    error: {
      main: THEME_COLORS.error,
    },
    warning: {
      main: THEME_COLORS.warning,
    },
    background: {
      default: THEME_COLORS.background,
      paper: THEME_COLORS.surface,
    },
    text: {
      primary: THEME_COLORS.textPrimary,
      secondary: THEME_COLORS.textSecondary,
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif',
    fontSize: 14,
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: '1px solid rgba(148, 163, 184, 0.18)',
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92))',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
          transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
            borderColor: 'rgba(37, 99, 235, 0.18)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          boxShadow: '0 8px 18px rgba(37, 99, 235, 0.18)',
          '&:hover': {
            boxShadow: '0 12px 24px rgba(37, 99, 235, 0.22)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 160ms ease',
          '&:hover': {
            backgroundColor: 'rgba(37, 99, 235, 0.035)',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18)',
        },
      },
    },
  },
});

/** React Query 客户端 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** 应用根组件 */
function Root() {
  const restoreFromStorage = useAuthStore((s) => s.restoreFromStorage);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    restoreFromStorage();
  }, [restoreFromStorage]);

  useEffect(() => {
    if (isAuthenticated && !user) {
      userApi.getProfile().then((data) => updateUser(data.user)).catch(() => {});
    }
  }, [isAuthenticated, user, updateUser]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <ToastProvider />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** 将 React 应用挂载到 DOM */
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');
const appRoot = createRoot(rootElement);
appRoot.render(<Root />);


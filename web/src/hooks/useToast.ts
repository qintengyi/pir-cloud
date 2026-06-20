import { useUiStore } from '../store/ui.store';

/**
 * 消息提示 Hook
 */
export function useToast() {
  const { snackbar, showSnackbar, hideSnackbar } = useUiStore();

  return {
    snackbar,
    showSnackbar,
    hideSnackbar,
    success: (message: string) => showSnackbar(message, 'success'),
    error: (message: string) => showSnackbar(message, 'error'),
    warning: (message: string) => showSnackbar(message, 'warning'),
    info: (message: string) => showSnackbar(message, 'info'),
  };
}

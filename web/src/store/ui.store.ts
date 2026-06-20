import { create } from 'zustand';

interface UiState {
  /** 侧边栏折叠状态 */
  sidebarCollapsed: boolean;
  /** Snackbar 消息 */
  snackbar: { open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' };

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showSnackbar: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
  hideSnackbar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  snackbar: { open: false, message: '', severity: 'info' },

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  showSnackbar: (message, severity = 'success') =>
    set({ snackbar: { open: true, message, severity } }),
  hideSnackbar: () => set({ snackbar: { open: false, message: '', severity: 'info' } }),
}));

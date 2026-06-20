import { Snackbar, Alert, Slide } from '@mui/material';
import { useUiStore } from '../../store/ui.store';

function SlideTransition(props: any) {
  return <Slide {...props} direction="up" />;
}

/**
 * 全局 Toast 消息提示组件
 * 通过 useUiStore 的 showSnackbar 方法触发
 */
export default function ToastProvider() {
  const { snackbar, hideSnackbar } = useUiStore();

  return (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={4000}
      onClose={hideSnackbar}
      TransitionComponent={SlideTransition}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={hideSnackbar}
        severity={snackbar.severity}
        variant="filled"
        sx={{ width: '100%', borderRadius: '8px' }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}

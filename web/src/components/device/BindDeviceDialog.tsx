import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../api/client';
import * as deviceApi from '../../api/device.api';
import type { DeviceInfo } from '../../types';

interface BindDeviceDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function BindDeviceDialog({ open, onClose }: BindDeviceDialogProps) {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const [activationCode, setActivationCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [boundDevice, setBoundDevice] = useState<DeviceInfo | null>(null);

  const bindMutation = useMutation({
    mutationFn: (code: string) => deviceApi.bindDevice(code),
    onSuccess: (data) => {
      setBoundDevice(data.device);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      showSuccess('设备绑定成功');
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('绑定失败，请稍后重试');
      }
    },
  });

  const handleSubmit = () => {
    setErrorMsg('');
    setBoundDevice(null);
    if (!activationCode.trim()) {
      setErrorMsg('请输入激活码');
      return;
    }
    bindMutation.mutate(activationCode.trim());
  };

  const handleClose = () => {
    setActivationCode('');
    setErrorMsg('');
    setBoundDevice(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>绑定设备</DialogTitle>
      <DialogContent>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
            {errorMsg}
          </Alert>
        )}

        {boundDevice ? (
          <Box>
            <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>
              设备绑定成功！
            </Alert>
            <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: '8px' }}>
              <Typography variant="body2" color="text.secondary">设备名称</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>{boundDevice.name}</Typography>
              <Typography variant="body2" color="text.secondary">设备 Token</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                {boundDevice.deviceToken}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                请妥善保存设备 Token，设备上报数据时需携带此 Token
              </Typography>
            </Box>
          </Box>
        ) : (
          <TextField
            fullWidth
            label="激活码"
            value={activationCode}
            onChange={(e) => setActivationCode(e.target.value)}
            placeholder="WB-XXXX-XXXX-XXXX"
            sx={{ mt: 1 }}
            helperText="输入管理员提供的激活码进行设备绑定"
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          {boundDevice ? '关闭' : '取消'}
        </Button>
        {!boundDevice && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={bindMutation.isPending}
          >
            {bindMutation.isPending ? '绑定中...' : '绑定'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

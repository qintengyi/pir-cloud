import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Switch,
  Slider,
  TextField,
  InputAdornment,
  FormControl,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast';
import { useDeviceConfig } from '../../hooks/useDevices';
import { DEBOUNCE_RANGE, ONLINE_REMIND_RANGE, NOTIFY_CHANNEL_MAP } from '../../utils/constants';
import { formatSeconds } from '../../utils/format';
import * as deviceApi from '../../api/device.api';
import type { DeviceInfo, NotifyChannel } from '../../types';

interface DeviceConfigDialogProps {
  open: boolean;
  device: DeviceInfo;
  onClose: () => void;
}

export default function DeviceConfigDialog({ open, device, onClose }: DeviceConfigDialogProps) {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const { data: configData } = useDeviceConfig(device.id);

  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [debounceInterval, setDebounceInterval] = useState(30);
  const [notifyChannels, setNotifyChannels] = useState<NotifyChannel[]>(['email']);
  const [onlineRemindEnabled, setOnlineRemindEnabled] = useState(false);
  const [onlineRemindIntervalMinutes, setOnlineRemindIntervalMinutes] = useState(ONLINE_REMIND_RANGE.default);

  useEffect(() => {
    if (configData?.config) {
      setNotifyEnabled(configData.config.notifyEnabled);
      setDebounceInterval(configData.config.debounceInterval);
      setNotifyChannels(configData.config.notifyChannels);
      setOnlineRemindEnabled(configData.config.onlineRemindEnabled);
      setOnlineRemindIntervalMinutes(configData.config.onlineRemindIntervalMinutes);
    }
  }, [configData]);

  const mutation = useMutation({
    mutationFn: (cfg: any) => deviceApi.updateDeviceConfig(device.id, cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceConfig', device.id] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      showSuccess('配置保存成功');
      onClose();
    },
    onError: (err: any) => showError(err.message || '保存失败'),
  });

  const handleSave = () => {
    mutation.mutate({ notifyEnabled, debounceInterval, notifyChannels, onlineRemindEnabled, onlineRemindIntervalMinutes });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>设备配置 - {device.name}</DialogTitle>
      <DialogContent>

        <FormControlLabel
          control={
            <Switch
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
              color="primary"
            />
          }
          label="启用通知"
          sx={{ mb: 2, mt: 1 }}
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          防抖间隔：{formatSeconds(debounceInterval)}
        </Typography>
        <Slider
          value={debounceInterval}
          onChange={(_, val) => setDebounceInterval(val as number)}
          min={DEBOUNCE_RANGE.min}
          max={DEBOUNCE_RANGE.max}
          step={DEBOUNCE_RANGE.step}
          valueLabelDisplay="auto"
          valueLabelFormat={(val) => formatSeconds(val)}
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          通知渠道
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={notifyChannels.includes('email')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setNotifyChannels([...notifyChannels, 'email']);
                  } else {
                    setNotifyChannels(notifyChannels.filter((c) => c !== 'email'));
                  }
                }}
              />
            }
            label={NOTIFY_CHANNEL_MAP.email.label}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={notifyChannels.includes('qq_bot')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setNotifyChannels([...notifyChannels, 'qq_bot']);
                  } else {
                    setNotifyChannels(notifyChannels.filter((c) => c !== 'qq_bot'));
                  }
                }}
              />
            }
            label={NOTIFY_CHANNEL_MAP.qq_bot.label + '（需付费会员）'}
          />
        </FormGroup>

        <Divider sx={{ my: 2 }} />

        <FormControlLabel
          control={
            <Switch
              checked={onlineRemindEnabled}
              onChange={(e) => setOnlineRemindEnabled(e.target.checked)}
              color="primary"
            />
          }
          label="持续在线提醒"
          sx={{ mb: 1 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          设备持续在线达到设定时长时，按通知渠道定期提醒一次。
        </Typography>
        <FormControl fullWidth size="small" disabled={!onlineRemindEnabled}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              提醒间隔
            </Typography>
            <TextField
              type="number"
              value={onlineRemindIntervalMinutes}
              onChange={(e) => {
                const value = Number(e.target.value);
                setOnlineRemindIntervalMinutes(Number.isFinite(value) ? value : ONLINE_REMIND_RANGE.default);
              }}
              inputProps={{
                min: ONLINE_REMIND_RANGE.min,
                max: ONLINE_REMIND_RANGE.max,
                step: ONLINE_REMIND_RANGE.step,
              }}
              InputProps={{ endAdornment: <InputAdornment position="end">分钟</InputAdornment> }}
              size="small"
              sx={{ flex: 1 }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            可输入 {ONLINE_REMIND_RANGE.min} - {ONLINE_REMIND_RANGE.max} 分钟。
          </Typography>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">取消</Button>
        <Button onClick={handleSave} variant="contained" disabled={mutation.isPending}>
          {mutation.isPending ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
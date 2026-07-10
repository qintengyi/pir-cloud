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
  Alert,
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
  const [stableAfterOnlineEnabled, setStableAfterOnlineEnabled] = useState(false);

  useEffect(() => {
    if (configData?.config) {
      setNotifyEnabled(configData.config.notifyEnabled);
      setDebounceInterval(configData.config.debounceInterval);
      setNotifyChannels(configData.config.notifyChannels);
      setOnlineRemindEnabled(configData.config.onlineRemindEnabled);
      setOnlineRemindIntervalMinutes(configData.config.onlineRemindIntervalMinutes);
      setStableAfterOnlineEnabled(configData.config.stableAfterOnlineEnabled ?? false);
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
    mutation.mutate({ notifyEnabled, debounceInterval, notifyChannels, onlineRemindEnabled, onlineRemindIntervalMinutes, stableAfterOnlineEnabled });
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

        <Divider sx={{ my: 2 }} />

        <FormControlLabel
          control={
            <Switch
              checked={stableAfterOnlineEnabled}
              onChange={(e) => setStableAfterOnlineEnabled(e.target.checked)}
              color="primary"
            />
          }
          label="稳定后推送模式"
          sx={{ mb: 1 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          开启后设备上线仍照常推送在线；有人信息需等设备连续 3 分钟无再次“无人”上报后才开始正常推送，期间屏蔽有人告警并显示“正在预热”。预热完成后会推送一次通知。
        </Typography>
        {stableAfterOnlineEnabled && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            开启后请保持传感器前无人，静置三分钟，避免预热期间误触发。预热完成后将推送“预热完成”通知。
          </Alert>
        )}
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
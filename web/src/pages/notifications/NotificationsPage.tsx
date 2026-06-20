import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import { Notifications as NotificationIcon, Edit as EditIcon } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDevices, useDeviceConfig } from '../../hooks/useDevices';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store/auth.store';
import EmptyState from '../../components/common/EmptyState';
import { DEBOUNCE_RANGE, NOTIFY_CHANNEL_MAP, ROUTE_PATHS } from '../../utils/constants';
import { formatSeconds } from '../../utils/format';
import * as deviceApi from '../../api/device.api';
import type { DeviceInfo, NotifyChannel } from '../../types';

export default function NotificationsPage() {
  const { data: deviceData } = useDevices(1, 100);
  const devices = deviceData?.list || [];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        通知配置
      </Typography>

      {devices.length === 0 ? (
        <Card sx={{ borderRadius: '12px' }}>
          <EmptyState
            icon={<NotificationIcon sx={{ fontSize: 48 }} />}
            title="暂无设备"
            description="绑定设备后可在此处配置通知规则"
          />
        </Card>
      ) : (
        <Grid container spacing={3}>
          {devices.map((device) => (
            <Grid item xs={12} sm={6} md={4} key={device.id}>
              <NotificationCard device={device} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

/** 通知配置卡片 */
function NotificationCard({ device }: { device: DeviceInfo }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: configData } = useDeviceConfig(device.id);
  const config = configData?.config;

  return (
    <>
      <Card sx={{ p: 3, borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {device.name}
          </Typography>
          <Button size="small" startIcon={<EditIcon />} onClick={() => setDialogOpen(true)}>
            编辑
          </Button>
        </Box>

        {config ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">通知开关：</Typography>
              <Chip
                size="small"
                label={config.notifyEnabled ? '已开启' : '已关闭'}
                color={config.notifyEnabled ? 'success' : 'default'}
                variant={config.notifyEnabled ? 'filled' : 'outlined'}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">防抖间隔：</Typography>
              <Typography variant="body2">{formatSeconds(config.debounceInterval)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">通知渠道：</Typography>
              {config.notifyChannels.map((ch: NotifyChannel) => (
                <Chip key={ch} size="small" label={NOTIFY_CHANNEL_MAP[ch]?.label || ch} variant="outlined" />
              ))}
            </Box>
          </Box>
        ) : (
          <Typography color="text.secondary">加载中...</Typography>
        )}
      </Card>

      <NotificationEditDialog
        open={dialogOpen}
        device={device}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

/** 通知配置编辑弹窗 */
function NotificationEditDialog({
  open,
  device,
  onClose,
}: {
  open: boolean;
  device: DeviceInfo;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();
  const { data: configData } = useDeviceConfig(device.id);
  const config = configData?.config;

  const isPremium =
    user?.membershipLevel === 'premium' &&
    (!user?.membershipExpireAt || new Date(user.membershipExpireAt) > new Date());

  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [debounceInterval, setDebounceInterval] = useState(30);
  const [notifyChannels, setNotifyChannels] = useState<NotifyChannel[]>(['email']);

  useEffect(() => {
    if (config) {
      setNotifyEnabled(config.notifyEnabled);
      setDebounceInterval(config.debounceInterval);
      setNotifyChannels(config.notifyChannels);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (cfg: any) => deviceApi.updateDeviceConfig(device.id, cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceConfig', device.id] });
      showSuccess('保存成功');
      onClose();
    },
    onError: (err: any) => showError(err.message || '保存失败'),
  });

  const handleSave = () => {

    const channelsToSave = isPremium ? notifyChannels : notifyChannels.filter((c) => c !== 'qq_bot');
    mutation.mutate({ notifyEnabled, debounceInterval, notifyChannels: channelsToSave });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>编辑通知配置 - {device.name}</DialogTitle>
      <DialogContent>
        <FormControlLabel
          control={<Switch checked={notifyEnabled} onChange={(e) => setNotifyEnabled(e.target.checked)} color="primary" />}
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>通知渠道</Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={notifyChannels.includes('email')}
                onChange={(e) => {
                  if (e.target.checked) setNotifyChannels([...notifyChannels, 'email']);
                  else setNotifyChannels(notifyChannels.filter((c) => c !== 'email'));
                }}
              />
            }
            label={NOTIFY_CHANNEL_MAP.email.label}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={isPremium && notifyChannels.includes('qq_bot')}
                disabled={!isPremium}
                onChange={(e) => {
                  if (e.target.checked) {
                    if (!isPremium) {
                      showError('需开通会员后可使用 QQ 通知');
                      navigate(ROUTE_PATHS.PROFILE);
                      return;
                    }
                    setNotifyChannels([...notifyChannels, 'qq_bot']);
                  } else {
                    setNotifyChannels(notifyChannels.filter((c) => c !== 'qq_bot'));
                  }
                }}
              />
            }
            label={NOTIFY_CHANNEL_MAP.qq_bot.label + '（需付费会员）'}
          />
          {!isPremium && (
            <Alert severity="info" sx={{ mt: 1, borderRadius: '8px', fontSize: '0.75rem' }}>
              {'QQ 通知为付费会员功能，'}
              <Box
                component="span"
                sx={{ color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigate(ROUTE_PATHS.PROFILE)}
              >
                {'点击开通会员'}
              </Box>
            </Alert>
          )}
        </FormGroup>
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

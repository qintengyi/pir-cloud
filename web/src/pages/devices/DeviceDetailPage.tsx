import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  Grid,
  Switch,
  Slider,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Divider,
  CircularProgress,
} from '@mui/material';
import { ArrowBack, Devices as DevicesIcon } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDeviceDetail } from '../../hooks/useDevices';
import { useDeviceConfig } from '../../hooks/useDevices';
import { useToast } from '../../hooks/useToast';
import StatusBadge from '../../components/common/StatusBadge';
import { DEVICE_STATUS_MAP, DEBOUNCE_RANGE, NOTIFY_CHANNEL_MAP } from '../../utils/constants';
import { formatDateTime, formatSeconds } from '../../utils/format';
import * as deviceApi from '../../api/device.api';
import type { NotifyChannel } from '../../types';

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const deviceId = parseInt(id || '0', 10);

  const { data: detail, isLoading } = useDeviceDetail(deviceId);
  const { data: configData } = useDeviceConfig(deviceId);

  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [debounceInterval, setDebounceInterval] = useState(30);
  const [notifyChannels, setNotifyChannels] = useState<NotifyChannel[]>(['email']);

  useEffect(() => {
    if (configData?.config) {
      setNotifyEnabled(configData.config.notifyEnabled);
      setDebounceInterval(configData.config.debounceInterval);
      setNotifyChannels(configData.config.notifyChannels);
    }
  }, [configData]);

  const updateConfigMutation = useMutation({
    mutationFn: (config: Parameters<typeof deviceApi.updateDeviceConfig>[1]) =>
      deviceApi.updateDeviceConfig(deviceId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceConfig', deviceId] });
      showSuccess('配置保存成功');
    },
    onError: (err: any) => showError(err.message || '保存失败'),
  });

  const handleSave = () => {
    updateConfigMutation.mutate({
      notifyEnabled,
      debounceInterval,
      notifyChannels,
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!detail) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/devices')} sx={{ mb: 2 }}>
          返回设备列表
        </Button>
        <Typography color="text.secondary">设备不存在</Typography>
      </Box>
    );
  }

  const { device } = detail;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/devices')} sx={{ mb: 2 }}>
        返回设备列表
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        {device.name}
      </Typography>

      <Grid container spacing={3}>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, borderRadius: '12px' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              设备信息
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <InfoRow label="设备 ID" value={`#${device.id}`} />
              <InfoRow label="设备名称" value={device.name} />
              <InfoRow label="设备状态" value={<StatusBadge status={device.status} map={DEVICE_STATUS_MAP} />} />
              <InfoRow label="最后上报" value={formatDateTime(device.lastReportAt)} />
              <InfoRow label="最后心跳" value={formatDateTime(device.lastHeartbeatAt)} />
              <InfoRow label="创建时间" value={formatDateTime(device.createdAt)} />
              <InfoRow label="设备Token" value={device.deviceToken} mono />
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, borderRadius: '12px' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              通知配置
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label="启用通知"
              sx={{ mb: 2 }}
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

            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3, borderRadius: '8px' }}
              onClick={handleSave}
              disabled={updateConfigMutation.isPending}
            >
              {updateConfigMutation.isPending ? '保存中...' : '保存配置'}
            </Button>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          fontFamily: mono ? 'monospace' : 'inherit',
          fontSize: mono ? 12 : 14,
          maxWidth: '60%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

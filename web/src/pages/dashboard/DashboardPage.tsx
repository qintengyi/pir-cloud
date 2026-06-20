import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Devices as DevicesIcon,
  WifiTethering as OnlineIcon,
  WifiOff as OfflineIcon,
  NotificationsActive as AlarmIcon,
} from '@mui/icons-material';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import BindDeviceDialog from '../../components/device/BindDeviceDialog';
import StatusBadge from '../../components/common/StatusBadge';
import { useDevices } from '../../hooks/useDevices';
import { useAlarmStats } from '../../hooks/useAlarms';
import { listAlarms as fetchAlarms } from '../../api/alarm.api';
import { ROUTE_PATHS, EVENT_TYPE_MAP, POLL_INTERVALS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/format';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [bindDialogOpen, setBindDialogOpen] = useState(false);
  const { data: deviceData, isLoading: devicesLoading } = useDevices(1, 100);
  const { data: statsData } = useAlarmStats(7);

  const devices = deviceData?.list || [];
  const totalDevices = deviceData?.total || 0;
  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const offlineDevices = totalDevices - onlineDevices;
  const todayAlarms = statsData?.stats.today || 0;

  const { data: recentAlarms } = useQuery({
    queryKey: ['recentAlarms'],
    queryFn: () => fetchAlarms({ page: 1, pageSize: 10 }),
    refetchInterval: POLL_INTERVALS.DASHBOARD,
    staleTime: 30 * 1000,
  });

  const recentList = recentAlarms?.list || [];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        控制台概览
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="设备总数" value={totalDevices} icon={<DevicesIcon />} color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="在线设备" value={onlineDevices} icon={<OnlineIcon />} color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="离线设备" value={offlineDevices} icon={<OfflineIcon />} color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="今日告警" value={todayAlarms} icon={<AlarmIcon />} color="error" />
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            最近告警
          </Typography>
        </Box>

        {recentList.length === 0 ? (
          <EmptyState
            icon={<AlarmIcon sx={{ fontSize: 48 }} />}
            title="暂无告警记录"
            description="设备检测到人体活动时，告警记录将显示在这里"
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.50' }}>
                  <TableCell>设备名称</TableCell>
                  <TableCell>事件类型</TableCell>
                  <TableCell>时间</TableCell>
                  <TableCell>详情</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentList.map((alarm) => (
                  <TableRow key={alarm.id} hover>
                    <TableCell>{alarm.deviceName || `设备#${alarm.deviceId}`}</TableCell>
                    <TableCell>
                      <StatusBadge status={alarm.type} map={EVENT_TYPE_MAP} />
                    </TableCell>
                    <TableCell>{formatRelativeTime(alarm.createdAt)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {alarm.detail?.message || '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {totalDevices === 0 && !devicesLoading && (
        <Card sx={{ mt: 3, borderRadius: '12px' }}>
          <EmptyState
            icon={<DevicesIcon sx={{ fontSize: 48 }} />}
            title="绑定你的第一台设备"
            description="输入激活码即可绑定红外感应设备，开始接收告警通知"
            actionText="去绑定设备"
            onAction={() => setBindDialogOpen(true)}
          />
        </Card>
      )}

      <BindDeviceDialog open={bindDialogOpen} onClose={() => setBindDialogOpen(false)} />
    </Box>
  );
}

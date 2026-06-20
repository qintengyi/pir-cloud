import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Grid, CircularProgress } from '@mui/material';
import {
  People as PeopleIcon,
  Devices as DevicesIcon,
  NotificationsActive as AlarmIcon,
} from '@mui/icons-material';
import StatCard from '../../components/common/StatCard';
import { listAdminUsers } from '../../api/admin.api';
import { listDevices } from '../../api/device.api';
import { getAlarmStats } from '../../api/alarm.api';

export default function AdminDashboardPage() {
  const { data: usersData } = useQuery({
    queryKey: ['adminUsers', { page: 1, pageSize: 1 }],
    queryFn: () => listAdminUsers({ page: 1, pageSize: 1 }),
  });

  const { data: devicesData } = useQuery({
    queryKey: ['adminDevices'],
    queryFn: () => listDevices(1, 1),
  });

  const { data: alarmStats } = useQuery({
    queryKey: ['adminAlarmStats'],
    queryFn: () => getAlarmStats(1),
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        管理后台概览
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="注册用户"
            value={usersData?.total ?? '-'}
            icon={<PeopleIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="设备总数"
            value={devicesData?.total ?? '-'}
            icon={<DevicesIcon />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="今日告警"
            value={alarmStats?.stats.today ?? '-'}
            icon={<AlarmIcon />}
            color="error"
          />
        </Grid>
      </Grid>
    </Box>
  );
}

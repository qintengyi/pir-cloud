import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Button,
  Grid,
  Collapse,
  IconButton,
} from '@mui/material';
import { Search, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useAlarms } from '../../hooks/useAlarms';
import { useDevices } from '../../hooks/useDevices';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { EVENT_TYPE_MAP, PAGE_SIZE_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';

export default function AlarmsPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [deviceId, setDeviceId] = useState('');
  const [type, setType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { data: deviceData } = useDevices(1, 100);
  const devices = deviceData?.list || [];

  const queryParams: any = {
    page: page + 1,
    pageSize,
  };
  if (deviceId) queryParams.deviceId = parseInt(deviceId, 10);
  if (type) queryParams.type = type;
  if (startDate) queryParams.startDate = startDate;
  if (endDate) queryParams.endDate = endDate;

  const { data, isLoading } = useAlarms(queryParams);
  const alarms = data?.list || [];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        告警历史
      </Typography>

      <Card sx={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        <Box sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="选择设备"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                <MenuItem value="">全部设备</MenuItem>
                {devices.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="事件类型"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <MenuItem value="">全部类型</MenuItem>
                <MenuItem value="online">上线</MenuItem>
                <MenuItem value="offline">离线</MenuItem>
                <MenuItem value="alarm">告警</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                type="date"
                fullWidth
                size="small"
                label="开始日期"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                type="date"
                fullWidth
                size="small"
                label="结束日期"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                startIcon={<Search />}
                fullWidth
                onClick={() => setPage(0)}
                sx={{ borderRadius: '8px' }}
              >
                查询
              </Button>
            </Grid>
          </Grid>
        </Box>

        {alarms.length === 0 && !isLoading ? (
          <EmptyState title="暂无告警记录" description="尝试调整筛选条件查看更多" />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell>时间</TableCell>
                    <TableCell>设备名称</TableCell>
                    <TableCell>事件类型</TableCell>
                    <TableCell>详情</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alarms.map((alarm) => (
                    <React.Fragment key={alarm.id}>
                      <TableRow hover>
                        <TableCell>{formatDateTime(alarm.createdAt)}</TableCell>
                        <TableCell>{alarm.deviceName || `设备#${alarm.deviceId}`}</TableCell>
                        <TableCell>
                          <StatusBadge status={alarm.type} map={EVENT_TYPE_MAP} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                            {alarm.detail?.message || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => setExpandedRow(expandedRow === alarm.id ? null : alarm.id)}
                          >
                            {expandedRow === alarm.id ? <ExpandLess /> : <ExpandMore />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={5} sx={{ py: 0, borderBottom: expandedRow === alarm.id ? '1px solid' : 'none' }}>
                          <Collapse in={expandedRow === alarm.id} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, backgroundColor: 'grey.50' }}>
                              <Typography variant="body2" color="text.secondary" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(alarm.detail, null, 2)}
                              </Typography>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data?.total || 0}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={PAGE_SIZE_OPTIONS}
              labelRowsPerPage="每页"
            />
          </>
        )}
      </Card>
    </Box>
  );
}

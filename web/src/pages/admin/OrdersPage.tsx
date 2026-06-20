import { useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Add as AddIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import StatusBadge from '../../components/common/StatusBadge';
import { useToast } from '../../hooks/useToast';
import { ORDER_STATUS_MAP } from '../../utils/constants';
import { formatDateTime, formatAmount } from '../../utils/format';
import * as adminApi from '../../api/admin.api';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({ userId: '', plan: '', amount: '' });

  const queryParams: any = { page: page + 1, pageSize };
  if (statusFilter) queryParams.status = statusFilter;

  const { data } = useQuery({
    queryKey: ['orders', queryParams],
    queryFn: () => adminApi.listOrders(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: ({ userId, plan, amount }: { userId: number; plan: string; amount: number }) =>
      adminApi.createOrder(userId, plan, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showSuccess('订单创建成功');
      setCreateOpen(false);
      setNewOrder({ userId: '', plan: '', amount: '' });
    },
    onError: (err: any) => showError(err.message || '创建失败'),
  });

  const handleExport = () => {
    const url = adminApi.exportOrdersUrl(statusFilter || undefined);
    const token = localStorage.getItem('pir_cloud_access_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `orders_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      })
      .catch(() => showError('导出失败'));
  };

  const handleCreate = () => {
    createMutation.mutate({
      userId: parseInt(newOrder.userId, 10),
      plan: newOrder.plan,
      amount: parseFloat(newOrder.amount),
    });
  };

  const orders = data?.list || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          订单管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
            导出CSV
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            手动创建
          </Button>
        </Box>
      </Box>

      <Card sx={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Box sx={{ p: 2 }}>
          <TextField
            select
            size="small"
            label="状态筛选"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ width: 200 }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="pending">待支付</MenuItem>
            <MenuItem value="paid">已支付</MenuItem>
            <MenuItem value="cancelled">已取消</MenuItem>
            <MenuItem value="refunded">已退款</MenuItem>
          </TextField>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell>订单号</TableCell>
                <TableCell>用户邮箱</TableCell>
                <TableCell>套餐</TableCell>
                <TableCell>金额</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>支付时间</TableCell>
                <TableCell>创建时间</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{order.orderNo}</TableCell>
                  <TableCell>{order.userEmail || `用户#${order.userId}`}</TableCell>
                  <TableCell>{order.plan}</TableCell>
                  <TableCell>{formatAmount(Number(order.amount))}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} map={ORDER_STATUS_MAP} />
                  </TableCell>
                  <TableCell>{order.paidAt ? formatDateTime(order.paidAt) : '-'}</TableCell>
                  <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                </TableRow>
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
          onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[20, 50, 100]}
          labelRowsPerPage="每页"
        />
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>手动创建订单</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="number"
            label="用户 ID"
            value={newOrder.userId}
            onChange={(e) => setNewOrder({ ...newOrder, userId: e.target.value })}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="套餐名称"
            value={newOrder.plan}
            onChange={(e) => setNewOrder({ ...newOrder, plan: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="number"
            label="金额（元）"
            value={newOrder.amount}
            onChange={(e) => setNewOrder({ ...newOrder, amount: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} color="inherit">取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={createMutation.isPending || !newOrder.userId || !newOrder.plan || !newOrder.amount}
          >
            {createMutation.isPending ? '创建中...' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

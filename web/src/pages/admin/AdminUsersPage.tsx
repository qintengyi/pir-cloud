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
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from '@mui/material';
import { Search, Person as PersonIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import StatusBadge from '../../components/common/StatusBadge';
import { useToast } from '../../hooks/useToast';
import { MEMBERSHIP_MAP } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';
import * as adminApi from '../../api/admin.api';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [membershipDialog, setMembershipDialog] = useState<{ userId: number; email: string } | null>(null);
  const [memberLevel, setMemberLevel] = useState<'free' | 'premium'>('free');
  const [expireDays, setExpireDays] = useState(30);

  const { data } = useQuery({
    queryKey: ['adminUsers', { search, page: page + 1, pageSize }],
    queryFn: () => adminApi.listAdminUsers({ search: search || undefined, page: page + 1, pageSize }),
  });

  const updateMembershipMutation = useMutation({
    mutationFn: ({ userId, level, expireAt }: { userId: number; level: 'free' | 'premium'; expireAt?: string }) =>
      adminApi.updateAdminUserMembership(userId, level, expireAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      showSuccess('会员修改成功');
      setMembershipDialog(null);
    },
    onError: (err: any) => showError(err.message || '修改失败'),
  });

  const handleSaveMembership = () => {
    if (!membershipDialog) return;
    const expireAt = memberLevel === 'premium'
      ? new Date(Date.now() + expireDays * 86400000).toISOString()
      : undefined;
    updateMembershipMutation.mutate({
      userId: membershipDialog.userId,
      level: memberLevel,
      expireAt,
    });
  };

  const users = data?.list || [];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        用户管理
      </Typography>

      <Card sx={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Box sx={{ p: 2 }}>
          <TextField
            placeholder="搜索邮箱或昵称..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            size="small"
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell>邮箱</TableCell>
                <TableCell>昵称</TableCell>
                <TableCell>设备数</TableCell>
                <TableCell>会员状态</TableCell>
                <TableCell>注册时间</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.nickname}</TableCell>
                  <TableCell>{u.deviceCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={u.membershipLevel} map={MEMBERSHIP_MAP} />
                  </TableCell>
                  <TableCell>{formatDateTime(u.createdAt)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<PersonIcon />}
                      onClick={() => {
                        setMembershipDialog({ userId: u.id, email: u.email });
                        setMemberLevel(u.membershipLevel);
                      }}
                    >
                      管理会员
                    </Button>
                  </TableCell>
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

      <Dialog open={!!membershipDialog} onClose={() => setMembershipDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>管理会员 - {membershipDialog?.email}</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="会员等级"
            value={memberLevel}
            onChange={(e) => setMemberLevel(e.target.value as 'free' | 'premium')}
            sx={{ mt: 1, mb: 2 }}
          >
            <MenuItem value="free">免费用户</MenuItem>
            <MenuItem value="premium">付费会员</MenuItem>
          </TextField>
          {memberLevel === 'premium' && (
            <TextField
              fullWidth
              type="number"
              label="有效天数"
              value={expireDays}
              onChange={(e) => setExpireDays(parseInt(e.target.value) || 30)}
              helperText="从今天起计算有效期"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMembershipDialog(null)} color="inherit">取消</Button>
          <Button
            variant="contained"
            onClick={handleSaveMembership}
            disabled={updateMembershipMutation.isPending}
          >
            {updateMembershipMutation.isPending ? '保存中...' : '确认'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

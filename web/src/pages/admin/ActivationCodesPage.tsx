import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Download as DownloadIcon, Block as BlockIcon, Sensors as SensorsIcon, Radar as RadarIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { ACTIVATION_CODE_STATUS_MAP, DEVICE_TYPE_MAP } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';
import * as adminApi from '../../api/admin.api';
import type { DeviceType } from '../../types';

export default function ActivationCodesPage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateDeviceType, setGenerateDeviceType] = useState<DeviceType>('infrared');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [disableId, setDisableId] = useState<number | null>(null);

  const queryParams: any = { page: page + 1, pageSize };
  if (statusFilter) queryParams.status = statusFilter;
  if (deviceTypeFilter) queryParams.deviceType = deviceTypeFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['activationCodes', queryParams],
    queryFn: () => adminApi.listActivationCodes(queryParams),
  });

  const generateMutation = useMutation({
    mutationFn: ({ count, prefix, deviceType }: { count: number; prefix?: string; deviceType: DeviceType }) =>
      adminApi.generateActivationCodes(count, prefix, deviceType),
    onSuccess: (data) => {
      setGeneratedCodes(data.codes);
      queryClient.invalidateQueries({ queryKey: ['activationCodes'] });
      showSuccess(`成功生成 ${data.codes.length} 个激活码`);
    },
    onError: (err: any) => showError(err.message || '生成失败'),
  });

  const disableMutation = useMutation({
    mutationFn: (id: number) => adminApi.disableActivationCode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activationCodes'] });
      showSuccess('禁用成功');
      setDisableId(null);
    },
    onError: (err: any) => showError(err.message || '禁用失败'),
  });

  const handleExport = () => {
    const exportParams: { status?: string; deviceType?: DeviceType } = {};
    if (statusFilter) exportParams.status = statusFilter;
    if (deviceTypeFilter) exportParams.deviceType = deviceTypeFilter as DeviceType;
    const url = adminApi.exportActivationCodesUrl(exportParams);
    const token = localStorage.getItem('pir_cloud_access_token');

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `activation_codes_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      })
      .catch(() => showError('导出失败'));
  };

  const codes = data?.list || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          激活码管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
            导出CSV
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenerateOpen(true)}>
            生成激活码
          </Button>
        </Box>
      </Box>

      <Card sx={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
          <TextField
            select
            size="small"
            label="状态筛选"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ width: 200 }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="unused">未使用</MenuItem>
            <MenuItem value="bound">已绑定</MenuItem>
            <MenuItem value="disabled">已禁用</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="设备类型"
            value={deviceTypeFilter}
            onChange={(e) => { setDeviceTypeFilter(e.target.value); setPage(0); }}
            sx={{ width: 140 }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="infrared">红外</MenuItem>
            <MenuItem value="microwave">微波</MenuItem>
          </TextField>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell>激活码</TableCell>
                <TableCell>设备类型</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>绑定用户</TableCell>
                <TableCell>绑定设备</TableCell>
                <TableCell>生成时间</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {codes.map((code) => (
                <TableRow key={code.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{code.code}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      icon={code.deviceType === 'microwave' ? <RadarIcon /> : <SensorsIcon />}
                      label={DEVICE_TYPE_MAP[code.deviceType]?.label || code.deviceType}
                      color={DEVICE_TYPE_MAP[code.deviceType]?.color || 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={code.status} map={ACTIVATION_CODE_STATUS_MAP} />
                  </TableCell>
                  <TableCell>{code.boundUser?.email || '-'}</TableCell>
                  <TableCell>{code.boundDevice?.name || '-'}</TableCell>
                  <TableCell>{formatDateTime(code.createdAt)}</TableCell>
                  <TableCell align="right">
                    {code.status === 'unused' && (
                      <IconButton size="small" color="error" onClick={() => setDisableId(code.id)} title="禁用">
                        <BlockIcon fontSize="small" />
                      </IconButton>
                    )}
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

      <Dialog open={generateOpen} onClose={() => { setGenerateOpen(false); setGeneratedCodes([]); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>生成激活码</DialogTitle>
        <DialogContent>
          {generatedCodes.length === 0 ? (
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                type="number"
                label="生成数量（1-100）"
                value={generateCount}
                onChange={(e) => setGenerateCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                sx={{ mb: 2 }}
              />
              <TextField
                select
                fullWidth
                label="设备类型"
                value={generateDeviceType}
                onChange={(e) => setGenerateDeviceType(e.target.value as DeviceType)}
                sx={{ mb: 2 }}
              >
                <MenuItem value="infrared">红外</MenuItem>
                <MenuItem value="microwave">微波</MenuItem>
              </TextField>
              <Button
                variant="contained"
                fullWidth
                onClick={() => generateMutation.mutate({ count: generateCount, deviceType: generateDeviceType })}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? '生成中...' : '确认生成'}
              </Button>
            </Box>
          ) : (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>成功生成 {generatedCodes.length} 个激活码</Alert>
              <Box sx={{ maxHeight: 300, overflow: 'auto', p: 1, backgroundColor: 'grey.50', borderRadius: '8px' }}>
                {generatedCodes.map((code, i) => (
                  <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace', py: 0.3 }}>
                    {code}
                  </Typography>
                ))}
              </Box>
              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => {
                  navigator.clipboard.writeText(generatedCodes.join('\n'));
                  showSuccess('已复制到剪贴板');
                }}
              >
                复制全部
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setGenerateOpen(false); setGeneratedCodes([]); }} color="inherit">
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={disableId !== null}
        title="禁用激活码"
        content="确定要禁用此激活码吗？禁用后不可恢复。"
        confirmText="禁用"
        confirmColor="error"
        onConfirm={() => disableId && disableMutation.mutate(disableId)}
        onCancel={() => setDisableId(null)}
      />
    </Box>
  );
}

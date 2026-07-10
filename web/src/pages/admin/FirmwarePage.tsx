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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Download as DownloadIcon,
  Star as StarIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { formatDateTime, truncate } from '../../utils/format';
import * as firmwareApi from '../../api/firmware.api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FirmwarePage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // 上传对话框状态
  const [uploadOpen, setUploadOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [isLatest, setIsLatest] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const queryParams = { page: page + 1, pageSize };

  const { data, isLoading } = useQuery({
    queryKey: ['adminFirmwares', queryParams],
    queryFn: () => firmwareApi.listFirmwares(queryParams),
  });

  const uploadMutation = useMutation({
    mutationFn: () =>
      firmwareApi.uploadFirmware({
        version,
        changelog: changelog || undefined,
        isLatest,
        file: file!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFirmwares'] });
      queryClient.invalidateQueries({ queryKey: ['latestFirmware'] });
      showSuccess('固件上传成功');
      resetUploadForm();
      setUploadOpen(false);
    },
    onError: (err: any) => showError(err.message || '上传失败'),
  });

  const setLatestMutation = useMutation({
    mutationFn: (id: number) => firmwareApi.setLatestFirmware(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFirmwares'] });
      queryClient.invalidateQueries({ queryKey: ['latestFirmware'] });
      showSuccess('已设为最新版本');
    },
    onError: (err: any) => showError(err.message || '操作失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => firmwareApi.deleteFirmware(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFirmwares'] });
      queryClient.invalidateQueries({ queryKey: ['latestFirmware'] });
      showSuccess('删除成功');
      setDeleteId(null);
    },
    onError: (err: any) => showError(err.message || '删除失败'),
  });

  const resetUploadForm = () => {
    setVersion('');
    setChangelog('');
    setIsLatest(true);
    setFile(null);
  };

  const handleUploadSubmit = () => {
    if (!file) {
      showError('请选择固件文件');
      return;
    }
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      showError('版本号格式错误（如 1.0.0）');
      return;
    }
    uploadMutation.mutate();
  };

  const handleDownload = (id: number, originalName: string) => {
    const url = firmwareApi.downloadFirmwareUrl(id);
    const token = localStorage.getItem('pir_cloud_access_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = originalName;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      })
      .catch(() => showError('下载失败'));
  };

  const firmwares = data?.list || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          固件管理
        </Typography>
        <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}>
          上传固件
        </Button>
      </Box>

      <Card sx={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell>版本</TableCell>
                <TableCell>文件名</TableCell>
                <TableCell>大小</TableCell>
                <TableCell>SHA256</TableCell>
                <TableCell>最新</TableCell>
                <TableCell>更新日志</TableCell>
                <TableCell>上传时间</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {firmwares.map((fw) => (
                <TableRow key={fw.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>v{fw.version}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{fw.originalName}</TableCell>
                  <TableCell>{formatBytes(fw.fileSize)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>
                    {truncate(fw.checksum, 16)}
                  </TableCell>
                  <TableCell>
                    {fw.isLatest ? (
                      <Chip size="small" color="primary" label="最新" />
                    ) : (
                      <Chip size="small" variant="outlined" label="-" />
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200, fontSize: 13 }}>
                    {fw.changelog ? truncate(fw.changelog, 40) : '-'}
                  </TableCell>
                  <TableCell>{formatDateTime(fw.createdAt)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(fw.id, fw.originalName)}
                      title="下载"
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    {!fw.isLatest && (
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => setLatestMutation.mutate(fw.id)}
                        title="设为最新"
                      >
                        <StarIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteId(fw.id)}
                      title="删除"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && firmwares.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    暂无固件版本，点击右上角上传
                  </TableCell>
                </TableRow>
              )}
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
          rowsPerPageOptions={[20, 50, 100]}
          labelRowsPerPage="每页"
        />
      </Card>

      {/* 上传对话框 */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>上传固件版本</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="版本号（如 1.0.0）"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="更新日志（可选）"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
            />
            <Button variant="outlined" component="label" fullWidth>
              {file ? file.name : '选择固件文件 (.bin)'}
              <input
                type="file"
                accept=".bin,application/octet-stream"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Button>
            <FormControlLabel
              control={
                <Switch checked={isLatest} onChange={(e) => setIsLatest(e.target.checked)} />
              }
              label="设为最新版本（用户刷写时默认下载此版本）"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadOpen(false)} color="inherit">
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleUploadSubmit}
            disabled={uploadMutation.isPending || !file || !version}
          >
            {uploadMutation.isPending ? '上传中...' : '确认上传'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除固件版本"
        content="确定要删除此固件版本吗？删除后不可恢复，关联的磁盘文件也会一并删除。"
        confirmText="删除"
        confirmColor="error"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Search,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDevices } from '../../hooks/useDevices';
import { useToast } from '../../hooks/useToast';
import { useDebounce } from '../../hooks/useDebounce';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import BindDeviceDialog from '../../components/device/BindDeviceDialog';
import DeviceConfigDialog from '../../components/device/DeviceConfigDialog';
import { DEVICE_STATUS_MAP, ROUTE_PATHS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/format';
import * as deviceApi from '../../api/device.api';
import type { DeviceInfo } from '../../types';

export default function DevicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [bindDialogOpen, setBindDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceInfo | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = useDevices(page + 1, pageSize);
  const devices = data?.list || [];

  const filteredDevices = debouncedSearch
    ? devices.filter((d) => d.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : devices;

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => deviceApi.renameDevice(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      showSuccess('重命名成功');
    },
    onError: (err: any) => showError(err.message || '重命名失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deviceApi.deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      showSuccess('删除成功');
      setDeleteDialogOpen(false);
    },
    onError: (err: any) => showError(err.message || '删除失败'),
  });

  const handleRename = (device: DeviceInfo, newName: string) => {
    renameMutation.mutate({ id: device.id, name: newName });
  };

  const handleDelete = (device: DeviceInfo) => {
    setDeviceToDelete(device);
    setDeleteDialogOpen(true);
  };

  const handleConfig = (device: DeviceInfo) => {
    setSelectedDevice(device);
    setConfigDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deviceToDelete) {
      deleteMutation.mutate(deviceToDelete.id);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          设备管理
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setBindDialogOpen(true)}>
          绑定设备
        </Button>
      </Box>

      <Card sx={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        <Box sx={{ p: 2 }}>
          <TextField
            placeholder="搜索设备名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        {filteredDevices.length === 0 ? (
          <EmptyState
            icon={<AddIcon sx={{ fontSize: 48 }} />}
            title={search ? '未找到匹配的设备' : '暂无设备'}
            description={search ? '尝试更换搜索关键词' : '点击"绑定设备"按钮添加你的第一台设备'}
            actionText={!search ? '绑定设备' : undefined}
            onAction={!search ? () => setBindDialogOpen(true) : undefined}
          />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell>设备名称</TableCell>
                    <TableCell>激活码 ID</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell>最后上报</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDevices.map((device) => (
                    <DeviceRow
                      key={device.id}
                      device={device}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onConfig={handleConfig}
                      onView={(id) => navigate(ROUTE_PATHS.DEVICE_DETAIL.replace(':id', String(id)))}
                    />
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
              rowsPerPageOptions={[20, 50, 100]}
              labelRowsPerPage="每页"
            />
          </>
        )}
      </Card>

      <BindDeviceDialog open={bindDialogOpen} onClose={() => setBindDialogOpen(false)} />

      {selectedDevice && (
        <DeviceConfigDialog
          open={configDialogOpen}
          device={selectedDevice}
          onClose={() => setConfigDialogOpen(false)}
        />
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        title="删除设备"
        content={`确定要删除设备"${deviceToDelete?.name}"吗？删除后不可恢复。`}
        confirmText="删除"
        confirmColor="error"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}

/** 设备行组件（支持内联编辑） */
function DeviceRow({
  device,
  onRename,
  onDelete,
  onConfig,
  onView,
}: {
  device: DeviceInfo;
  onRename: (device: DeviceInfo, name: string) => void;
  onDelete: (device: DeviceInfo) => void;
  onConfig: (device: DeviceInfo) => void;
  onView: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(device.name);

  const handleSave = () => {
    if (editName.trim() && editName !== device.name) {
      onRename(device, editName.trim());
    }
    setEditing(false);
  };

  return (
    <TableRow hover>
      <TableCell>
        {editing ? (
          <TextField
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setEditName(device.name);
                setEditing(false);
              }
            }}
            size="small"
            autoFocus
            sx={{ width: 200 }}
          />
        ) : (
          <Typography variant="body2" sx={{ cursor: 'pointer' }} onClick={() => setEditing(true)}>
            {device.name}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          #{device.activationCodeId}
        </Typography>
      </TableCell>
      <TableCell>
        <StatusBadge status={device.status} map={DEVICE_STATUS_MAP} />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {formatRelativeTime(device.lastReportAt)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <IconButton size="small" onClick={() => onView(device.id)} title="详情">
          <VisibilityIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => setEditing(true)} title="重命名">
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => onConfig(device)} title="配置">
          <SettingsIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" onClick={() => onDelete(device)} title="删除">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

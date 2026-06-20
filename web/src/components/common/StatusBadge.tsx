import { Chip } from '@mui/material';

interface StatusBadgeProps {
  status: string;
  map: Record<string, { label: string; color: 'success' | 'error' | 'default' | 'warning' | 'primary' | 'info' }>;
  size?: 'small' | 'medium';
}

/**
 * 状态标签组件
 * 根据状态映射显示对应颜色和文本
 */
export default function StatusBadge({ status, map, size = 'small' }: StatusBadgeProps) {
  const config = map[status] || { label: status, color: 'default' as const };
  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      variant={config.color === 'default' ? 'outlined' : 'filled'}
      sx={{ borderRadius: '6px', fontWeight: 500 }}
    />
  );
}

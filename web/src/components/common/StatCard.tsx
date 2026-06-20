import { Card, Box, Typography, Avatar } from '@mui/material';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color?: 'primary' | 'success' | 'error' | 'warning' | 'info';
  trend?: string;
}

const colorMap = {
  primary: { bg: '#dbeafe', fg: '#2563eb' },
  success: { bg: '#dcfce7', fg: '#16a34a' },
  error: { bg: '#fee2e2', fg: '#dc2626' },
  warning: { bg: '#fef3c7', fg: '#d97706' },
  info: { bg: '#e0f2fe', fg: '#0284c7' },
};

export default function StatCard({ title, value, icon, color = 'primary', trend }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <Card
      sx={{
        p: 3,
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {value}
          </Typography>
          {trend && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {trend}
            </Typography>
          )}
        </Box>
        <Avatar
          sx={{
            width: 48,
            height: 48,
            bgcolor: colors.bg,
            color: colors.fg,
          }}
        >
          {icon}
        </Avatar>
      </Box>
    </Card>
  );
}

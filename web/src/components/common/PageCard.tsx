import { Card, Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: number;
}

/**
 * 页面卡片容器
 * 统一的卡片样式，带标题和操作区域
 */
export default function PageCard({ title, action, children, padding = 3 }: PageCardProps) {
  return (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        overflow: 'visible',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
          borderColor: 'rgba(37, 99, 235, 0.18)',
        },
      }}
    >
      {(title || action) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
          }}
        >
          {title && (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          )}
          {action}
        </Box>
      )}
      <Box sx={{ p: padding }}>{children}</Box>
    </Card>
  );
}

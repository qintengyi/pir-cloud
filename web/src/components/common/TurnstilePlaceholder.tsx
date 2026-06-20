import { Box, Paper, Typography } from '@mui/material';
import { VerifiedUser } from '@mui/icons-material';

/**
 * Turnstile 占位组件
 *
 * 当前状态：尚未接入真实 Cloudflare Turnstile（使用测试密钥）
 *
 * 设计说明：
 *   - 现在只展示一个"未启用"状态的友好占位 UI，避免用户看到无效的验证框
 *   - 当后端 TURNSTILE_SECRET_KEY 配置为真实 key 时，
 *     后端会自动启用验证（前端无需改动，登录请求中不带 token 即可）
 *   - 未来接入真实 Turnstile 时，将本组件替换为 Cloudflare 官方 Widget 即可
 */
export default function TurnstilePlaceholder() {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'action.hover',
        borderColor: 'divider',
        borderRadius: '8px',
      }}
    >
      <VerifiedUser color="disabled" fontSize="small" />
      <Typography variant="body2" color="text.secondary">
        人机验证未启用
      </Typography>
    </Paper>
  );
}

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Tabs,
  Tab,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
} from '@mui/material';
import { Mail as MailIcon, SmartToy as BotIcon, Send as SendIcon } from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast';
import * as adminApi from '../../api/admin.api';
import type { SmtpConfig, OneBotConfig } from '../../types';

export default function SettingsPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [tab, setTab] = useState(0);

  const { data: configs, refetch } = useQuery({
    queryKey: ['systemConfigs'],
    queryFn: () => adminApi.getSystemConfigs(),
  });

  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: '',
    port: 465,
    username: '',
    password: '',
    from: '',
    secure: true,
  });

  const [onebot, setOnebot] = useState<OneBotConfig>({
    wsUrl: '',
    token: '',
  });

  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (configs) {
      setSmtp(configs.smtp);
      setOnebot(configs.onebot);
    }
  }, [configs]);

  const updateSmtpMutation = useMutation({
    mutationFn: (cfg: SmtpConfig) => adminApi.updateSmtpConfig(cfg),
    onSuccess: () => showSuccess('SMTP配置保存成功'),
    onError: (err: any) => showError(err.message || '保存失败'),
  });

  const updateOneBotMutation = useMutation({
    mutationFn: (cfg: OneBotConfig) => adminApi.updateOneBotConfig(cfg),
    onSuccess: () => showSuccess('OneBot配置保存成功'),
    onError: (err: any) => showError(err.message || '保存失败'),
  });

  const testSmtpMutation = useMutation({
    mutationFn: (to: string) => adminApi.testSmtp(to),
    onSuccess: () => showSuccess('测试邮件已发送'),
    onError: (err: any) => showError(err.message || '发送失败'),
  });

  const testOneBotMutation = useMutation({
    mutationFn: () => adminApi.testOneBot(),
    onSuccess: () => showSuccess('OneBot连接成功'),
    onError: (err: any) => showError(err.message || '连接失败'),
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        系统配置
      </Typography>

      <Card sx={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderBottomColor: 'divider', px: 2 }}>
          <Tab icon={<MailIcon />} iconPosition="start" label="SMTP 配置" />
          <Tab icon={<BotIcon />} iconPosition="start" label="OneBot 配置" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    label="SMTP 服务器地址"
                    value={smtp.host}
                    onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                    placeholder="smtp.example.com"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="端口"
                    value={smtp.port}
                    onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 465 })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="用户名"
                    value={smtp.username}
                    onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="password"
                    label="密码"
                    value={smtp.password}
                    onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="发件人地址"
                    value={smtp.from}
                    onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
                    placeholder="noreply@example.com"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={smtp.secure}
                        onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
                        color="primary"
                      />
                    }
                    label="使用 SSL（端口465时通常启用）"
                  />
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={() => updateSmtpMutation.mutate(smtp)}
                  disabled={updateSmtpMutation.isPending}
                >
                  {updateSmtpMutation.isPending ? '保存中...' : '保存配置'}
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" sx={{ mb: 2 }}>测试发送</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="测试收件邮箱"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button
                  variant="outlined"
                  startIcon={<SendIcon />}
                  onClick={() => testSmtpMutation.mutate(testEmail)}
                  disabled={testSmtpMutation.isPending || !testEmail}
                >
                  发送测试
                </Button>
              </Box>
            </Box>
          )}

          {tab === 1 && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="WebSocket 地址"
                    value={onebot.wsUrl}
                    onChange={(e) => setOnebot({ ...onebot, wsUrl: e.target.value })}
                    placeholder="ws://127.0.0.1:8080"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Token（可选）"
                    value={onebot.token}
                    onChange={(e) => setOnebot({ ...onebot, token: e.target.value })}
                  />
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={() => updateOneBotMutation.mutate(onebot)}
                  disabled={updateOneBotMutation.isPending}
                >
                  {updateOneBotMutation.isPending ? '保存中...' : '保存配置'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => testOneBotMutation.mutate()}
                  disabled={testOneBotMutation.isPending}
                >
                  {testOneBotMutation.isPending ? '测试中...' : '测试连接'}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Card>
    </Box>
  );
}

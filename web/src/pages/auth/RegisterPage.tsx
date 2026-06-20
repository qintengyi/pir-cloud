import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  Tabs,
  Tab,
  InputAdornment,
  Alert,
  IconButton,
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff, HowToReg } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ROUTE_PATHS, TURNSTILE_SITE_KEYS } from '../../utils/constants';
import { ApiError } from '../../api/client';
import * as authApi from '../../api/auth.api';
import TurnstileWidget from '../../components/common/TurnstileWidget';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { error: showError, success: showSuccess } = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string>('');

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  /** 发送验证码 */
  const handleSendCode = useCallback(async () => {
    if (!email) {
      setErrorMsg('请先输入邮箱');
      return;
    }
    if (!turnstileToken) {
      setErrorMsg('请先完成人机验证');
      return;
    }
    setErrorMsg('');
    setSendingCode(true);
    try {
      await authApi.sendCode(email, 'register', turnstileToken);
      showSuccess('验证码已发送到邮箱');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('验证码发送失败');
      }
    } finally {
      setSendingCode(false);
    }
  }, [email, turnstileToken, showSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await register(email, code, password, nickname || undefined);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4f8 0%, #e0f2fe 100%)',
        py: 4,
      }}
    >
      <Card sx={{ width: 400, maxWidth: '90vw', p: 4, borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
            pir-cloud
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            创建账号
          </Typography>
        </Box>

        <Tabs value={1} variant="fullWidth" sx={{ mb: 3 }}>
          <Tab label="登录" component={Link} to={ROUTE_PATHS.LOGIN} />
          <Tab label="注册" />
        </Tabs>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
            {errorMsg}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="邮箱"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              label="验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              inputProps={{ maxLength: 6 }}
            />
            <Button
              variant="outlined"
              onClick={handleSendCode}
              disabled={sendingCode || countdown > 0 || !turnstileToken}
              sx={{ minWidth: 120, borderRadius: '8px', whiteSpace: 'nowrap' }}
            >
              {countdown > 0 ? `${countdown}s` : '发送验证码'}
            </Button>
          </Box>

          <TextField
            fullWidth
            label="密码（至少8位，含字母和数字）"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="昵称（可选）"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEYS.register}
            onVerify={handleTurnstileVerify}
            onExpire={handleTurnstileExpire}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={<HowToReg />}
            sx={{ borderRadius: '8px', py: 1.2, textTransform: 'none' }}
          >
            {loading ? '注册中...' : '注册'}
          </Button>
        </form>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            已有账号？{' '}
            <Link to={ROUTE_PATHS.LOGIN}>
              <Typography component="span" variant="body2" color="primary.main" sx={{ cursor: 'pointer' }}>
                立即登录
              </Typography>
            </Link>
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}

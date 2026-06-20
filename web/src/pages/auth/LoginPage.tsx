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
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ROUTE_PATHS, TURNSTILE_SITE_KEYS } from '../../utils/constants';
import { ApiError } from '../../api/client';
import TurnstileWidget from '../../components/common/TurnstileWidget';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { error: showError } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string>('');

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!turnstileToken) {
      setErrorMsg('请先完成人机验证');
      return;
    }

    setLoading(true);
    try {
      await login(email, password, turnstileToken);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('登录失败，请稍后重试');
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
            物联网人体感应云端告警面板
          </Typography>
        </Box>

        <Tabs value={0} variant="fullWidth" sx={{ mb: 3 }}>
          <Tab label="登录" />
          <Tab label="注册" component={Link} to={ROUTE_PATHS.REGISTER} />
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
          <TextField
            fullWidth
            label="密码"
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
                  <Box
                    component="span"
                    sx={{ cursor: 'pointer', display: 'flex' }}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </Box>
                </InputAdornment>
              ),
            }}
          />

          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEYS.login}
            onVerify={handleTurnstileVerify}
            onExpire={handleTurnstileExpire}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading || !turnstileToken}
            sx={{ borderRadius: '8px', py: 1.2, textTransform: 'none' }}
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link to={ROUTE_PATHS.FORGOT_PASSWORD}>
            <Typography variant="body2" color="primary.main" sx={{ cursor: 'pointer' }}>
              忘记密码？
            </Typography>
          </Link>
        </Box>
      </Card>
    </Box>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  Grid,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  Security as SecurityIcon,
  CardMembership as MemberIcon,
  ContentCopy as ContentCopyIcon,
  Verified as VerifiedIcon,
  ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { useToast } from '../../hooks/useToast';
import { MEMBERSHIP_MAP, BOT_QQ } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';
import * as userApi from '../../api/user.api';
import * as qqVerifyApi from '../../api/qq-verify.api';
import { ApiError } from '../../api/client';
import MembershipUpgradeDialog from '../../components/profile/MembershipUpgradeDialog';

const QQ_VERIFY_POLL_INTERVAL = 5 * 1000;

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();
  const queryClient = useQueryClient();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [qqNumber, setQqNumber] = useState(user?.qqNumber || '');
  const [passwordError, setPasswordError] = useState('');
  const [searchParams] = useSearchParams();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [qqVerifyCode, setQqVerifyCode] = useState('');
  const [qqVerifyExpiresAt, setQqVerifyExpiresAt] = useState('');
  const [qqVerifyActive, setQqVerifyActive] = useState(false);
  const [qqVerifyError, setQqVerifyError] = useState('');
  const [qqVerifyCopied, setQqVerifyCopied] = useState(false);

  useEffect(() => {
    if (searchParams.get('pay') === 'success') {
      userApi.getProfile().then((data) => {
        updateUser(data.user);
      }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      showSuccess('支付成功，会员已开通');
    }
  }, [searchParams, queryClient, showSuccess, updateUser]);

  const { data: membershipData } = useQuery({
    queryKey: ['membership'],
    queryFn: () => userApi.getMembership(),
  });

  const { data: qqVerifyStatus } = useQuery({
    queryKey: ['qq-verify-status'],
    queryFn: () => qqVerifyApi.getQqVerifyStatus(),
    enabled: qqVerifyActive,
    refetchInterval: qqVerifyActive ? QQ_VERIFY_POLL_INTERVAL : false,
  });

  useEffect(() => {
    if (!qqVerifyStatus) {
      return;
    }

    if (qqVerifyStatus.verified) {
      setQqVerifyActive(false);
      setQqVerifyError('');
      // 验证成功后保留验证码信息，方便用户查看有效期
      showSuccess('QQ 验证成功，已开通 QQ 推送');
      // 同步更新 auth store 的 user 对象，确保 qqVerified 等字段与后端一致，
      // 避免刷新后 localStorage 中 user 状态过期导致的不一致问题
      userApi.getProfile().then((data) => updateUser(data.user)).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['membership'] });
    }
  }, [qqVerifyStatus, queryClient, showSuccess, updateUser]);

  const updateProfileMutation = useMutation({
    mutationFn: (name: string) => userApi.updateProfile(name),
    onSuccess: (data) => {
      updateUser(data.user);
      showSuccess('昵称修改成功');
    },
    onError: (err: any) => showError(err.message || '修改失败'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ oldPwd, newPwd }: { oldPwd: string; newPwd: string }) =>
      userApi.changePassword(oldPwd, newPwd),
    onSuccess: () => {
      showSuccess('密码修改成功，请重新登录');
      setOldPassword('');
      setNewPassword('');
      setPasswordError('');
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError('修改失败');
      }
    },
  });

  const updateQQMutation = useMutation({
    mutationFn: (qq: string) => userApi.updateQQ(qq),
    onSuccess: (data) => {
      updateUser(data.user);
      setQqVerifyActive(false);
      setQqVerifyCode('');
      setQqVerifyExpiresAt('');
      setQqVerifyError('');
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      showSuccess('QQ绑定成功，请重新验证归属后再启用 QQ 推送');
    },
    onError: (err: any) => showError(err.message || '绑定失败'),
  });

  const requestQqVerifyMutation = useMutation({
    mutationFn: (qq: string) => qqVerifyApi.requestQqVerify(qq),
    onSuccess: (data) => {
      setQqVerifyCode(data.code);
      setQqVerifyExpiresAt(data.expiresAt);
      setQqVerifyActive(true);
      setQqVerifyError('');
      setQqVerifyCopied(false);
      showSuccess('验证码已生成，请在 QQ 私聊机器人发送');
    },
    onError: (err: any) => {
      setQqVerifyError(err.message || '获取验证码失败');
    },
  });

  const handleNicknameSave = () => {
    if (nickname.trim()) {
      updateProfileMutation.mutate(nickname.trim());
    }
  };

  const handlePasswordSave = () => {
    setPasswordError('');
    if (!oldPassword || !newPassword) {
      setPasswordError('请填写完整');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('新密码至少8位');
      return;
    }
    changePasswordMutation.mutate({ oldPwd: oldPassword, newPwd: newPassword });
  };

  const handleQQSave = () => {
    if (qqNumber.trim()) {
      updateQQMutation.mutate(qqNumber.trim());
    }
  };

  const handleRequestVerify = () => {
    setQqVerifyError('');
    if (!qqNumber.trim()) {
      setQqVerifyError('请先填写 QQ 号');
      return;
    }
    requestQqVerifyMutation.mutate(qqNumber.trim());
  };

  const handleCopyVerifyCode = async () => {
    if (!qqVerifyCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(qqVerifyCode);
      setQqVerifyCopied(true);
      showSuccess('验证码已复制');
    } catch {
      showError('复制失败，请手动复制验证码');
    }
  };

  const handleUpgradeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['membership'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  // 准备渲染时的状态信息
  const membership = membershipData?.membership;
  const isPremiumMember = membership?.level === 'premium' && !membership?.isExpired;
  const isQqVerified = membership?.qqVerified ?? user?.qqVerified ?? false;
  const verifiedAt = membership?.qqVerifiedAt ?? user?.qqVerifiedAt ?? null;
  const canVerifyQq = isPremiumMember && !!membership?.qqBound;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        个人中心
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 24 }}>
                {user?.nickname?.charAt(0) || 'U'}
              </Avatar>
              <Box>
                <Typography variant="h6">{user?.nickname}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              修改昵称
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <Button variant="contained" onClick={handleNicknameSave} disabled={updateProfileMutation.isPending}>
                保存
              </Button>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                注册时间
              </Typography>
              <Typography variant="body2">{formatDateTime(user?.createdAt)}</Typography>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MemberIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                会员信息
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <InfoRow label="当前等级" value={MEMBERSHIP_MAP[membership?.level || user?.membershipLevel || 'free']?.label || '-'} />
              <InfoRow label="到期时间" value={membership?.expireAt ? formatDateTime(membership.expireAt) : '永久'} />
              <InfoRow label="QQ绑定" value={membership?.qqBound ? '已绑定' : '未绑定'} />
              <InfoRow label="QQ验证" value={isQqVerified ? '已验证' : '未验证'} />
              {verifiedAt && (
                <InfoRow label="验证时间" value={formatDateTime(verifiedAt)} />
              )}
              {membership?.isExpired && (
                <Alert severity="warning" sx={{ borderRadius: '8px' }}>
                  会员已过期，QQ通知功能已关闭
                </Alert>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              绑定QQ号
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="输入QQ号"
                value={qqNumber}
                onChange={(e) => setQqNumber(e.target.value)}
              />
              <Button variant="contained" onClick={handleQQSave} disabled={updateQQMutation.isPending}>
                {user?.qqNumber ? '更新' : '绑定'}
              </Button>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                QQ 验证
              </Typography>
              {!canVerifyQq ? (
                <Alert severity="info" sx={{ borderRadius: '8px' }}>
                  请先开通会员并绑定 QQ 号，再进行归属验证。
                </Alert>
              ) : isQqVerified ? (
                <Alert
                  severity="success"
                  icon={<VerifiedIcon fontSize="inherit" />}
                  sx={{ borderRadius: '8px' }}
                >
                  QQ 归属已验证，通知功能已启用。
                </Alert>
              ) : (
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip label="状态：未验证" color="warning" variant="outlined" />
                    <Chip label={`机器人 QQ：${BOT_QQ}`} variant="outlined" />
                  </Stack>
                  {qqVerifyError && (
                    <Alert severity="error" icon={<ErrorOutlineIcon fontSize="inherit" />} sx={{ borderRadius: '8px' }}>
                      {qqVerifyError}
                    </Alert>
                  )}
                  {qqVerifyCode ? (
                    <Alert severity="info" sx={{ borderRadius: '8px' }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        请先将机器人 QQ <strong>{BOT_QQ}</strong> 加为好友，然后私聊发送以下 6 位验证码：
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 2 }}>
                        {qqVerifyCode}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {qqVerifyExpiresAt ? `有效期至 ${formatDateTime(qqVerifyExpiresAt)}` : '验证码已生成'}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ContentCopyIcon />}
                        onClick={handleCopyVerifyCode}
                        sx={{ mt: 1 }}
                      >
                        {qqVerifyCopied ? '已复制' : '复制验证码'}
                      </Button>
                    </Alert>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleRequestVerify}
                      disabled={requestQqVerifyMutation.isPending}
                    >
                      {requestQqVerifyMutation.isPending ? '生成中...' : '获取验证码'}
                    </Button>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    向机器人发送验证码后，页面会自动轮询验证状态。
                  </Typography>
                </Stack>
              )}
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MemberIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {'会员升级'}
              </Typography>
            </Box>
            {isPremiumMember ? (
              <Alert severity="success" sx={{ borderRadius: '8px' }}>
                {'当前为“付费会员”，QQ通知功能已开启。'}
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {'开通永久会员后可接收 QQ 机器人告警消息。'}
                </Typography>
                <Button variant="contained" fullWidth onClick={() => setUpgradeOpen(true)}>
                  {'开通永久会员（¥1）'}
                </Button>
              </>
            )}
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SecurityIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                修改密码
              </Typography>
            </Box>
            {passwordError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                {passwordError}
              </Alert>
            )}
            <TextField
              fullWidth
              size="small"
              type="password"
              label="旧密码"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              size="small"
              type="password"
              label="新密码（至少8位，含字母和数字）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              fullWidth
              onClick={handlePasswordSave}
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? '修改中...' : '修改密码'}
            </Button>
          </Card>
        </Grid>
      </Grid>

      <MembershipUpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onSuccess={handleUpgradeSuccess}
      />
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}

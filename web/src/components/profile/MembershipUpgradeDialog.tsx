import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import * as paymentApi from '../../api/payment.api';
import { useToast } from '../../hooks/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Membership upgrade dialog
 * Lets user choose wxpay/alipay, creates order and redirects to epay.
 */
export default function MembershipUpgradeDialog({ open, onClose, onSuccess }: Props) {
  const { error: showError } = useToast();
  const [payType, setPayType] = useState<'wxpay' | 'alipay'>('wxpay');

  const mutation = useMutation({
    mutationFn: (type: 'wxpay' | 'alipay') => paymentApi.createPayment(type),
    onSuccess: (data) => {

      window.location.href = data.payUrl;
    },
    onError: (err: any) => showError(err.message || 'create order failed'),
  });

  const handlePay = () => {
    mutation.mutate(payType);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>开通永久会员</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
            ¥1 <Typography component="span" variant="body2" color="text.secondary">永久会员</Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            开通后可永久使用 QQ 机器人告警通知功能。
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          选择支付方式
        </Typography>
        <RadioGroup value={payType} onChange={(e) => setPayType(e.target.value as 'wxpay' | 'alipay')}>
          <FormControlLabel value="wxpay" control={<Radio />} label="微信支付" />
          <FormControlLabel value="alipay" control={<Radio />} label="支付宝" />
        </RadioGroup>
        <Alert severity="info" sx={{ mt: 2, borderRadius: '8px' }}>
          点击去支付后将跳转到支付页面，完成支付后会员将自动开通。
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">取消</Button>
        <Button onClick={handlePay} variant="contained" disabled={mutation.isPending} startIcon={mutation.isPending ? <CircularProgress size={16} /> : null}>
          {mutation.isPending ? '创建订单中...' : '去支付'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

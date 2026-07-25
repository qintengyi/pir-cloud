import { useState, useRef, useCallback } from 'react';
import { Box, Button, LinearProgress, Typography, Alert, Paper } from '@mui/material';
import { Usb as UsbIcon } from '@mui/icons-material';
import { useToast } from '../../hooks/useToast';
import { getLatestFirmware } from '../../api/firmware.api';
import type { DeviceType } from '../../types';

type Status = 'idle' | 'connecting' | 'connected' | 'downloading' | 'flashing' | 'done' | 'error';

const STATUS_LABEL: Record<Status, string> = {
  idle: '待机',
  connecting: '连接设备中...',
  connected: '设备已连接',
  downloading: '下载固件中...',
  flashing: '刷写中（请勿断开 USB）...',
  done: '刷写完成',
  error: '出错',
};

/** 刷写参数映射表 */
const FLASH_PARAMS: Record<DeviceType, {
  serialLabel: string;
  chipRegex: RegExp;
  flashMode: string;
  flashFreq: string;
  flashSize: string;
  apHotspot: string;
}> = {
  infrared: {
    serialLabel: 'ESP8266 串口',
    chipRegex: /8266/i,
    flashMode: 'dio',
    flashFreq: '40m',
    flashSize: '4MB',
    apHotspot: 'PirCloud-Setup-XXXX',
  },
  microwave: {
    serialLabel: 'ESP32-S3 串口',
    chipRegex: /S3/i,
    flashMode: 'dio',
    flashFreq: '80m',
    flashSize: '8MB',
    apHotspot: 'PirCloud-MW-Setup-XXXX',
  },
};

interface EsptoolFlasherProps {
  deviceType: DeviceType;
  flashSize?: string;
}

/**
 * Plan A: 浏览器内 Web Serial 刷写（仅 Chrome/Edge 支持）。
 * 流程：请求串口 → ESPLoader 连接并识别芯片 → 下载云端最新固件 → 擦除全片 + 写 0x0 → hard_reset。
 * 根据 deviceType 切换刷写参数（flashSize/flashMode/flashFreq）、芯片识别正则、日志文案和配网热点名。
 */
export default function EsptoolFlasher({ deviceType, flashSize }: EsptoolFlasherProps) {
  const { success: showSuccess, error: showError } = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const portRef = useRef<SerialPort | null>(null);

  const params = FLASH_PARAMS[deviceType];
  const effectiveFlashSize = flashSize || params.flashSize;

  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg].slice(-200));
  }, []);

  const handleFlash = useCallback(async () => {
    if (!navigator.serial) {
      showError('当前浏览器不支持 Web Serial，请用 Chrome/Edge，或使用下方 Windows 刷机器');
      return;
    }

    setStatus('connecting');
    setProgress(0);
    setProgressLabel('');
    setLogs([]);
    log(`请选择 ${params.serialLabel}设备...`);

    try {
      // 1. 请求串口（用户在浏览器弹窗中选择）
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      log(`串口已打开，正在连接 ${deviceType === 'microwave' ? 'ESP32-S3' : 'ESP8266'}...`);

      // 2. 动态加载 esptool-js（按需加载，减小主包体积）
      const { ESPLoader, Transport } = await import('esptool-js');

      const transport = new (Transport as any)(port, true);
      const terminal = {
        clean() {},
        writeLine: (data: string) => log(data),
        write: (data: string) => log(data),
      };

      const esploader = new (ESPLoader as any)({
        transport,
        baudrate: 115200,
        terminal,
        debugLogging: false,
      });

      // 3. 连接并识别芯片（会复位设备）
      const chipName = await esploader.main();
      log(`已连接: ${chipName}`);
      if (!params.chipRegex.test(String(chipName))) {
        log(`⚠️ 检测到非预期芯片（${chipName}），仍尝试继续...`);
      }
      setStatus('connected');

      // 4. 下载云端最新固件（按设备类型拉取）
      setStatus('downloading');
      log('正在从云端下载最新固件...');
      const latest = await getLatestFirmware(deviceType);
      // downloadUrl 形如 /api/firmware/download/latest?deviceType=xxx，同源直接 fetch
      const resp = await fetch(latest.downloadUrl);
      if (!resp.ok) throw new Error(`固件下载失败: HTTP ${resp.status}`);
      const fwArrayBuffer = await resp.arrayBuffer();
      const fwData = new Uint8Array(fwArrayBuffer);
      log(`固件下载完成: v${latest.version}, ${fwData.length} 字节`);

      // 校验 sha256（可选，浏览器 SubtleCrypto）
      try {
        const hashBuf = await crypto.subtle.digest('SHA-256', fwArrayBuffer);
        const hashHex = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        if (hashHex === latest.checksum) {
          log('SHA256 校验通过 ✓');
        } else {
          log(`⚠️ SHA256 不匹配（期望 ${latest.checksum.slice(0, 12)}..., 实际 ${hashHex.slice(0, 12)}...）`);
        }
      } catch {
        log('（SHA256 校验跳过）');
      }

      // 5. 擦除全片 + 写 0x0
      setStatus('flashing');
      log('开始擦除全片并刷写固件（约 10-30 秒）...');
      setProgress(0);
      setProgressLabel('准备刷写...');

      await esploader.writeFlash({
        fileArray: [{ data: fwData, address: 0x0 }],
        flashMode: params.flashMode,
        flashFreq: params.flashFreq,
        flashSize: effectiveFlashSize,
        eraseAll: true,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const percent = total > 0 ? (written / total) * 100 : 0;
          setProgress(percent);
          setProgressLabel(`${written} / ${total} 字节 (${percent.toFixed(1)}%)`);
        },
        calculateMD5Hash: (image: Uint8Array) => '',
      });

      // 6. 硬复位
      await esploader.after('hard_reset');
      log('设备已复位，刷写完成 ✓');
      setProgress(100);
      setProgressLabel('完成');
      setStatus('done');
      showSuccess(`固件刷写成功！请连接 ${params.apHotspot} 热点进行配网`);

      // 关闭串口（释放设备）
      try {
        await transport.disconnect();
        await port.close();
      } catch {
        // 忽略关闭错误
      }
      portRef.current = null;
    } catch (err: any) {
      log(`✗ 错误: ${err?.message || String(err)}`);
      setStatus('error');
      showError(err?.message || '刷写失败');
      // 尝试关闭串口
      if (portRef.current) {
        try {
          await portRef.current.close();
        } catch {
          // ignore
        }
        portRef.current = null;
      }
    }
  }, [log, showSuccess, showError, deviceType, params, effectiveFlashSize]);

  const busy = ['connecting', 'connected', 'downloading', 'flashing'].includes(status);

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<UsbIcon />}
          onClick={handleFlash}
          disabled={busy}
          fullWidth
        >
          {busy ? STATUS_LABEL[status] : '连接设备并刷写'}
        </Button>
      </Box>

      {busy && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {progressLabel || STATUS_LABEL[status]}
          </Typography>
        </Box>
      )}

      {status === 'done' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          刷写成功！设备已重启并进入配网模式：连接 WiFi 热点 <strong>{params.apHotspot}</strong>，然后访问 <strong>http://192.168.4.1</strong> 配置 WiFi 和激活码。
        </Alert>
      )}

      {status === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          刷写失败。常见原因：① 用了只能充电的 USB 线（换数据线）；② 设备无自动复位电路（按住 FLASH，点 RESET 后松开）；③ 选错了串口。详见下方日志。
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 220, overflow: 'auto', backgroundColor: 'grey.50' }}>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 11 }}>
          {logs.length > 0 ? logs.join('\n') : '（日志将显示在此处）'}
        </Typography>
      </Paper>
    </Box>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Chip, Alert, Divider, Link, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Download as DownloadIcon, Memory as MemoryIcon, Sensors as SensorsIcon, Radar as RadarIcon } from '@mui/icons-material';
import EsptoolFlasher from '../../components/flash/EsptoolFlasher';
import { getLatestFirmware } from '../../api/firmware.api';
import { formatDateTime } from '../../utils/format';
import { DEVICE_TYPE_MAP } from '../../utils/constants';
import type { DeviceType } from '../../types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FlashPage() {
  const webSerialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;
  const [deviceType, setDeviceType] = useState<DeviceType>('infrared');
  const [flashVariant, setFlashVariant] = useState<'8MB' | '16MB'>('8MB');

  const isMicrowave = deviceType === 'microwave';
  const chipName = isMicrowave ? 'ESP32-S3' : 'ESP8266';
  const apPrefix = isMicrowave ? 'PirCloud-MW-Setup-XXXX' : 'PirCloud-Setup-XXXX';

  const { data: latest } = useQuery({
    queryKey: ['latestFirmware', deviceType],
    queryFn: () => getLatestFirmware(deviceType),
    retry: false,
  });

  const handleDeviceTypeChange = (_: any, value: DeviceType | null) => {
    if (value !== null) {
      setDeviceType(value);
    }
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        刷写固件
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        用 USB 数据线将 {chipName} 设备连接到电脑，点击下方按钮即可从云端拉取最新固件并自动刷入。
      </Typography>

      {/* 设备类型选择器 */}
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={deviceType}
          exclusive
          onChange={handleDeviceTypeChange}
          size="small"
        >
          <ToggleButton value="infrared">
            <SensorsIcon sx={{ mr: 0.5, fontSize: 18 }} /> 红外 (ESP8266)
          </ToggleButton>
          <ToggleButton value="microwave">
            <RadarIcon sx={{ mr: 0.5, fontSize: 18 }} /> 微波 (ESP32-S3)
          </ToggleButton>
        </ToggleButtonGroup>
        {isMicrowave && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Flash 变体：</Typography>
            <ToggleButtonGroup
              value={flashVariant}
              exclusive
              onChange={(_, val) => val && setFlashVariant(val)}
              size="small"
            >
              <ToggleButton value="8MB">8MB (N8R2)</ToggleButton>
              <ToggleButton value="16MB">16MB (N15R8)</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
      </Box>

      {/* 最新固件信息 */}
      <Card sx={{ borderRadius: '12px', mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <MemoryIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {latest ? `最新固件 v${latest.version}` : '加载中...'}
            </Typography>
            {latest && (
              <>
                <Chip size="small" color="primary" label="latest" sx={{ mr: 0.5 }} />
                <Chip
                  size="small"
                  icon={latest.deviceType === 'microwave' ? <RadarIcon /> : <SensorsIcon />}
                  label={DEVICE_TYPE_MAP[latest.deviceType]?.label || latest.deviceType}
                  color={DEVICE_TYPE_MAP[latest.deviceType]?.color || 'default'}
                  variant="outlined"
                />
              </>
            )}
          </Box>
          {latest && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, color: 'text.secondary', fontSize: 13 }}>
              <Typography variant="body2">大小：{formatBytes(latest.fileSize)}</Typography>
              <Typography variant="body2">SHA256：{latest.checksum.slice(0, 24)}...</Typography>
              <Typography variant="body2">发布时间：{formatDateTime(latest.createdAt)}</Typography>
              {latest.changelog && <Typography variant="body2">更新日志：{latest.changelog}</Typography>}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Plan A: 浏览器内刷写 */}
      <Card sx={{ borderRadius: '12px', mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            方式一：浏览器内刷写（推荐）
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            需使用 <strong>Chrome</strong> 或 <strong>Edge</strong> 浏览器（支持 Web Serial API）。
            点击按钮后，浏览器会弹出串口选择窗口，选择你的 {chipName} 设备即可。
          </Alert>
          {webSerialSupported ? (
            <EsptoolFlasher deviceType={deviceType} flashSize={isMicrowave ? flashVariant : '4MB'} />
          ) : (
            <Alert severity="warning">
              当前浏览器不支持 Web Serial API，请改用 Chrome/Edge，或使用下方「Windows 刷机器」。
            </Alert>
          )}
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }}>
        <Chip label="或" size="small" />
      </Divider>

      {/* Plan B: 本地 helper */}
      <Card sx={{ borderRadius: '12px' }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            方式二：Windows 刷机器
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            适用于不支持 Web Serial 的浏览器，或刷写失败时。下载后解压，双击运行即可自动拉取最新固件刷写。
          </Typography>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            component="a"
            href="/flasher/PirCloudFlasher.zip"
            download
          >
            下载 PirCloudFlasher.zip
          </Button>
        </CardContent>
      </Card>

      {/* 刷写后指引 */}
      <Alert severity="success" sx={{ mt: 3, borderRadius: '12px' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          刷写成功后如何配网？
        </Typography>
        <Typography variant="body2" component="div">
          1. 设备重启后会自动创建 WiFi 热点 <strong>{apPrefix}</strong>
          <br />
          2. 用手机或电脑连接该热点
          <br />
          3. 浏览器访问 <Link href="http://192.168.4.1">http://192.168.4.1</Link>，填写 WiFi 和激活码
          <br />
          4. 设备联网后即可在「设备管理」中看到
        </Typography>
      </Alert>
    </Box>
  );
}

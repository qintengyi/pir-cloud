# pir-cloud ESP8266 固件 — 对接与修复报告

| 字段 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 日期 | 2025-06-18 |
| 范围 | 服务端对接确认 + P1/P2/P3 全部修复 + 编译验证 |

---

## 一、服务端对接确认

### 1.1 设备直连激活接口（已对接）

固件 `Reporter::activateDevice()` 与服务端 `POST /api/device/activate` 完成对接：

| 维度 | 固件端 | 服务端 |
|------|--------|--------|
| 路径 | `SERVER_PATH_ACTIVATE = "/api/device/activate"` | `device.routes.ts:29` |
| 鉴权 | `X-Activation-Code` header（doPost 自动添加） | `device.controller.ts:116` 优先读 header |
| 请求体 | `{"activationCode":"WB-XXXX-XXXX-XXXX"}` | `device.schema.ts:59` body 可选（header 已带） |
| 限流 | — | 10 次/分钟（`deviceActivateRateLimit`） |
| 响应 | 手撸字符串解析 `deviceToken` 字段 | `{code:0,data:{deviceToken,deviceId,deviceName}}` |
| 持久化 | `Storage::saveDeviceToken()` → EEPROM + CRC8 | — |

### 1.2 上报与心跳接口（已对接）

| 接口 | 固件 | 服务端 |
|------|------|--------|
| `POST /api/report` | `reportStatus()` | `report.service.ts:23` |
| `POST /api/report/heartbeat` | `sendHeartbeat()` | `report.service.ts:115` |
| 鉴权 | device_token 优先 / activation_code fallback | `report.service.ts:153` validateDevice |
| 防抖 | 固件 30s + 服务端 30s（可配置） | `report.service.ts:62` DebounceService |
| 离线判定 | 60s 心跳 | 5min 无心跳标记离线（heartbeat job） |

### 1.3 服务端配置

- `SERVER_HOST = "your-server.example.com"`（部署时改为你的域名）
- `SERVER_PORT = 80`（Nginx 反代 HTTPS → HTTP:<your-port>）
- 设备激活流程：管理员生成激活码 → 用户在控制台绑定（`/api/devices/bind`）→ 设备启动时用激活码换 token（`/api/device/activate`）→ 后续上报用 token

---

## 二、修复清单

### P1 — 影响稳定性（3 项，全部修复）

#### P1-1：HTTP 同步阻塞导致单轮 loop 远超 50ms

**问题**：PIR 上报、离线回放、心跳三处 HTTP 同步阻塞。`replayOfflineOnce` 缺 `isBusy` 检查，可能单轮连发两个 HTTP 请求。

**修复**：
- `main.cpp`：新增 `g_httpDoneThisLoop` 标志，PIR 上报后置 true，replay 和心跳本轮跳过
- `reporter.cpp`：`replayOfflineOnce()` 开头增加 `if (s_busy) return false;` 检查
- loop 末尾重置标志

**效果**：单轮 loop 最多一个 HTTP 请求，避免连续阻塞。

#### P1-2：dropOfflineEvent 逐字节 String 拼接产生堆碎片

**问题**：`storage.cpp` 的 `dropOfflineEvent` 用 `rest += (char)f.read()` 逐字节追加，最坏 1.5KB 数据可能触发多次 realloc。

**修复**：改为临时文件方案：
1. 打开原文件，跳过第一行
2. 逐块（128B buffer）拷贝剩余内容到临时文件 `/_offline_tmp.txt`
3. 删除原文件，重命名临时文件

**效果**：零堆分配，栈 buffer 仅 128B。

#### P1-3：WifiManager AP 模式动态分配

**问题**：`new DNSServer()` / `new ESP8266WebServer(80)` 在 AP 配网时（内存压力最大时刻）动态分配，失败无降级。

**修复**：
- 改为文件级静态对象 `static DNSServer g_dns;` / `static ESP8266WebServer g_portal(80);`
- 新增 `g_portalStarted` 标志：首次进入 AP 模式注册 routes，后续复用
- `exitApConfig()` 改为 `stop()` 而非 `delete`

**效果**：零动态分配，AP 模式内存预算可预测。

---

### P2 — 可靠性（2 项，全部修复）

#### P2-1：HTTP body 改静态 buffer 零堆分配

**问题**：`buildReportBody` / `buildHeartbeatBody` / `activateDevice` 用 `String` + `reserve()` 构造 JSON body，与文档"手撸字符串避免堆分配"不一致。

**修复**：
```cpp
static const char* buildReportBody(const char* status, uint32_t ts) {
  static char buf[64];
  snprintf(buf, sizeof(buf), "{\"status\":\"%s\",\"timestamp\":%lu}",
           status, (unsigned long)ts);
  return buf;
}
```
三处 body 构造全部改为 `static char[]` + `snprintf`。单 loop 协作式调度中结果立即消费，不会被覆盖。

#### P2-5：PIR 预热时间不足

**问题**：HC-SR501 上电需 1-2s 稳定，但 `PirSensor::begin()` 只 `delay(100)`，初始状态可能误判。

**修复**：`delay(100)` → `delay(2000)`。setup 中阻塞可接受（loop 尚未开始）。

---

### P3 — 代码质量（4 项，全部修复）

| # | 文件 | 修复内容 |
|---|------|---------|
| P3-1 | storage.cpp | 删除 4 处冗余 `LittleFS.begin()` 调用（`Storage::begin()` 已初始化） |
| P3-2 | diagnostics.cpp | `level_map[]` 改 `static constexpr`，避免每次调用构造 |
| P3-5 | wifi_manager.cpp | Captive Portal 重定向 `4.4.4.4` → `192.168.4.1`（设备自身 IP） |
| 平台版本 | platformio.ini | `espressif8266@4.2.2` → `@4.2.1`（4.2.2 不存在，4.2.1 是最新可用） |

---

## 三、修改文件清单

| 文件 | 改动类型 | 行数变化 |
|------|---------|---------|
| `firmware/src/reporter.cpp` | P1-1 + P2-1 | buildXxxBody 静态化、replayOfflineOnce isBusy、activateDevice body 静态化 |
| `firmware/src/storage.cpp` | P1-2 + P3-1 | dropOfflineEvent 临时文件方案、删除冗余 LittleFS.begin |
| `firmware/src/wifi_manager.cpp` | P1-3 + P3-5 | AP 对象静态化、Captive Portal IP 修复 |
| `firmware/src/main.cpp` | P1-1 | 单轮 HTTP 互斥标志 g_httpDoneThisLoop |
| `firmware/src/pir_sensor.cpp` | P2-5 | delay(100) → delay(2000) |
| `firmware/src/diagnostics.cpp` | P3-2 | level_map static constexpr |
| `firmware/platformio.ini` | 平台版本 | @4.2.2 → @4.2.1 |

---

## 四、未实现项（已知限制）

| 功能 | 状态 | 说明 |
|------|------|------|
| NTP 时间同步 | 未实现 | timestamp 用 millis()/1000，服务端用 Date.now() 覆盖 |
| OTA 远程升级 | 未实现 | platformio.ini 预留 env:esp12e_ota |
| HTTPS 端到端 | 未实现 | 依赖 Nginx 反代 TLS，设备端走 HTTP |
| HTTP 真正非阻塞 | 未实现 | 当前 6s 超时兜底 + 单轮互斥缓解，长期可改状态机 |

这些是明确的"未来扩展"项，不影响当前功能正确性。

---

## 五、设备部署流程

1. **管理员生成激活码**：管理后台 → 激活码管理 → 生成
2. **用户绑定设备**：控制台 → 设备管理 → 输入激活码绑定（`/api/devices/bind`）
3. **固件烧录**：`pio run -t upload`（USB）或 OTA
4. **设备配网**：首次启动无 WiFi 凭据 → 自动进入 AP 模式 → 手机连接 `PirCloud-Setup-XXXX` → 浏览器输入 WiFi 密码
5. **自动激活**：WiFi 连上后，固件自动用 activation_code 调 `/api/device/activate` 换取 device_token
6. **正常工作**：PIR 检测到人体 → 上报 → 60s 心跳 → 离线缓存回放

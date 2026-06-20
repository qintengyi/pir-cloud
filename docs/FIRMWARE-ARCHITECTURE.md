# pir-cloud ESP8266 固件架构设计文档

| 字段 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 编写人 | 嵌入式固件工程师 |
| 日期 | 2025-06-18 |
| 适用项目 | pir-cloud-panel |
| 目标硬件 | ESP-12E / NodeMCU 1.0（ESP8266EX, Tensilica L106 80MHz, 80KB 用户 RAM, 4MB Flash） |
| 框架 | PlatformIO + Arduino Core 3.x（espressif8266@4.2.2） |
| 工程位置 | `D:\pir\firmware\` |

---

## 一、需求与约束

### 1.1 业务需求

对接 pir-cloud 后端（`D:\pir\workbody\server`），实现：

1. **红外人体感应**：检测"无人→有人"边沿，触发上报
2. **HTTP 上报**：`POST /api/report`，携带状态
3. **心跳保活**：`POST /api/report/heartbeat`，60s 周期（服务端 5min 判离线）
4. **凭据持久化**：device_token + WiFi 凭据断电不丢
5. **AP 配网**：用户无屏，需 Captive Portal 配 WiFi
6. **离线缓存**：网络异常时本地缓存上报事件，恢复后回放

### 1.2 服务端协议要点（来自源码分析）

| 项 | 协议 | 备注 |
|----|------|------|
| 上报接口 | `POST /api/report` | Body: `{"status":"presence"\|"absence","timestamp":int}` |
| 心跳接口 | `POST /api/report/heartbeat` | Body: `{"timestamp":int}`（可空） |
| 鉴权 Header | `X-Device-Token`（64字符 hex）| 优先 |
| Fallback Header | `X-Activation-Code`（`WB-XXXX-XXXX-XXXX`）| token 缺失时用 |
| 响应 | `{"code":0,"message":"..."}` 或 `{"code":2005,"message":"设备未授权"}` | 200=成功 |
| 服务端防抖 | 单设备 30s（可配置 5-3600s）| 重复上报静默丢弃 |
| 服务端限流 | reportRateLimit | 触发 429 |
| 离线判定 | 5min 无心跳 | status → offline |

### 1.3 硬件约束

| 维度 | 数值 | 影响 |
|------|------|------|
| CPU | 单核 80MHz（可超 160MHz）| 算力有限，禁复杂运算 |
| 用户 RAM | ~80KB（其中 ~50KB 可用）| 禁用大对象、禁用 malloc 在 loop |
| Flash | 4MB（典型）| 充裕 |
| WiFi | 内置，单 2.4GHz | 必须有 WiFi stack，loop 必须 yield |
| GPIO | 仅 GPIO0/2/4/5/12/13/14/15/16 可用 | 启动电平约束：GPIO0/2/15 |
| 任务模型 | Non-OS SDK + 协作式 loop | **无真正的多线程**，ISR 极简 |
| Soft WDT | 默认 ~3.2s | loop 内不可阻塞 > 3s（实际 < 50ms 安全） |

---

## 二、整体架构

### 2.1 分层

固件分四层，自下而上：

1. **硬件抽象层**：ESP8266 Arduino Core（GPIO/WiFi/HTTPClient/EEPROM/LittleFS/Ticker）
2. **调度与持久化层**：`main.cpp` 单 loop 时间片调度 + `Storage` 持久化
3. **核心服务层**：`WifiManager`、`PirSensor`、`Reporter`、`Heartbeat`
4. **外部对接层**：pir-cloud Server

### 2.2 模块清单

```
firmware/
├── platformio.ini              # PlatformIO 配置（库版本全部锁定）
├── README.md                   # 使用说明
├── data/                       # LittleFS 数据目录（OTA 占位）
└── src/
    ├── main.cpp                # 入口 + loop 调度
    ├── config.h                # 编译期配置（魔法数字集中）
    ├── pins.h                  # 引脚定义（含启动电平约束说明）
    ├── diagnostics.h/.cpp      # 日志 + 运行时统计
    ├── led_indicator.h/.cpp    # LED 状态指示（非阻塞）
    ├── storage.h/.cpp          # EEPROM 镜像 + LittleFS 离线缓存
    ├── wifi_manager.h/.cpp     # WiFi 连接 + AP 配网 Portal
    ├── pir_sensor.h/.cpp       # PIR 驱动 + 中断 + 本地防抖
    ├── reporter.h/.cpp         # HTTP 上报 + 重试 + 离线缓存
    └── heartbeat.h/.cpp        # 60s 心跳调度
```

### 2.3 关键设计决策

#### 决策 1：单 loop 协作式调度，不用 FreeRTOS

**理由**：
- ESP8266 Arduino Core 虽然内部跑的是 Non-OS SDK + 协作式 loop，**没有真正的多线程**
- 民间 FreeRTOS-on-ESP8266 移植成熟度不足，与 WiFi stack 抢资源时易死锁
- 单 loop + `millis()` 时间片调度是 ESP8266 业界最稳方案
- 模块间通过函数调用通信，无共享状态竞争

**代价**：每个模块的 `tick()` 必须非阻塞，开发者自律要求高

#### 决策 2：HTTP 短连接，每请求一连接

**理由**：
- ESP8266WiFi 的 keep-alive 长连接在高频请求下容易内存碎片化
- 短连接 + `setReuse(false)` 显式释放，最稳
- 心跳 60s 一次、上报偶尔一次，连接开销可接受

#### 决策 3：device_token + activation_code 双鉴权

**理由**：
- 服务端 `validateDevice()` 实现：token 优先，activation_code fallback
- 设备首次部署无 token，用 activation_code 也能上报成功
- token 由服务端在用户 Web 面板绑定时生成（64字符 hex），需通过 OTA 或串口写入设备
- 当前固件策略：**优先用 activation_code 跑通业务**，token 直连是后续优化项

#### 决策 4：PIR 中断只置 flag

**理由**：
- ESP8266 ISR 中禁用浮点、禁用 String、禁用 WiFi API
- ISR 内做 `millis()` 时间戳 + 置 `volatile bool flag`，loop 中消费
- 二次电平确认（消抖 5ms + settle 50ms）放 loop 中做

#### 决策 5：双端防抖

**理由**：
- 服务端 30s 防抖是最终防线，但每次 HTTP 请求都耗电、占带宽、可能触发限流
- 固件端 30s 本地防抖，在 PIR 抖动场景下避免无效 HTTP
- 两端窗口一致（默认 30s），固件端是优化，服务端是兜底

#### 决策 6：离线缓存走 LittleFS，不走 EEPROM

**理由**：
- EEPROM 写入有磨损限制（虽然底层是 LittleFS 镜像，但频繁写仍不利）
- LittleFS 文件直接 append，磨损均衡更好
- 缓存上限 50 条（每条 ~30 字节，总 ~1.5KB），不会写满

---

## 三、运行时状态机

### 3.1 WiFi 状态机

```
Disconnected ──enterConnecting()──> Connecting ──(WL_CONNECTED)──> Connected
                                       │                                │
                                       │ timeout                        │ WiFi lost
                                       ▼                                ▼
                                  BackoffWait <──┐                Disconnected
                                       │          │
                                  failCount++    │
                                       │          │
                                       └──────────┘
                                       │
                                  failCount >= 5
                                       ▼
                                   ApConfig ──(用户提交凭据 / 5min 超时)──> Connecting
```

### 3.2 PIR 状态机

```
                ┌── (HIGH) ──────────────┐
                │                        ▼
              Unknown ──────────> Presence
                │                        │
                └── (LOW) ──> Absence <──┘
                                  │
                                  │ (HIGH) + 防抖通过
                                  ▼
                              上报 presence
```

### 3.3 完整 loop 调度

```
loop() {
  1. wifiManager.tick()       // 维持 WiFi 连接
  2. pirSensor.tick()         // 消费中断、二次确认、本地防抖
     └─> 触发 → Reporter.reportStatus("presence")
                  ├─ WiFi 不通：cacheOfflineEvent()
                  ├─ 200：success
                  ├─ 401/4xx：不重试（业务错误）
                  └─ 5xx/网络错：cacheOfflineEvent()
  3. reporter.replayOnce()    // 每 5s 回放一条缓存
  4. heartbeat.tick()         // 60s 周期 + 失败指数退避
  5. configButton.tick()      // 长按 FLASH 5s 进 AP
  6. led.tick()               // LED 状态机
  7. stats.tick()             // 统计更新
  8. yield()                  // 关键！feed Soft WDT
}
```

单轮目标 < 50ms，超时打印警告。

---

## 四、模块详细设计

### 4.1 Storage（持久化）

**数据结构**（256B，单页 EEPROM）：

```c
struct DeviceConfig {
  uint16_t magic;            // 0x5742 ('WB')
  uint8_t  version;          // schema 版本
  char     device_token[65]; // hex64 + '\0'
  char     activation_code[17]; // "WB-XXXX-XXXX-XXXX"
  char     wifi_ssid[64];
  char     wifi_pass[64];
  uint8_t  crc;              // CRC8
};
```

**校验流程**：
1. 启动时读 EEPROM 镜像到 RAM
2. 校验 magic + version
3. CRC8 校验失败 → 清空（视为首次启动）

**离线缓存文件**：`/offline_events.txt`，行格式 `"<status> <ts>\n"`

### 4.2 WifiManager

**关键 API**：
- `begin(ssid, pass)`：初始化，凭据非空则 `enterConnecting()`，否则 `enterApConfig()`
- `tick()`：状态机推进
- `enterApConfig()`：开 AP + DNS 劫持 + HTTP Portal
- `applyNewCredentials()`：用户提交后保存到 EEPROM + 触发重连

**AP Portal 实现**：
- SoftAP SSID：`PirCloud-Setup-XXXX`（MAC 后 4 位）
- DNS Server：所有域名解析到 `192.168.4.1`（Captive Portal）
- HTTP Server：`GET /` 返回表单，`POST /set` 接收凭据
- 5min 无客户端连接自动退出，重试 STA

### 4.3 PirSensor

**中断处理**（IRAM_ATTR）：
```c
void IRAM_ATTR isr() {
  uint32_t now = millis();
  if (now - s_lastIrqMs < 5) return;  // 硬件消抖
  s_lastIrqMs = now;
  s_irqFlag = true;
}
```

**主 loop 消费**：
1. 检查 `s_irqFlag`，置 false
2. 等 `PIR_SETTLE_MS`（50ms）让电平稳定
3. `digitalRead()` 二次确认
4. 状态无变化 → 丢弃
5. `Absence → Presence` 边沿 + 防抖通过 → 返回 true 触发上报
6. `Presence → Absence` → 仅更新状态，不上报

### 4.4 Reporter

**请求构造**：
- URL：`http://<SERVER_HOST>:<SERVER_PORT><PATH>`
- Header：`X-Device-Token` 或 `X-Activation-Code`
- Body：手撸 JSON 字符串（不用 ArduinoJson，避免堆分配）

**响应处理矩阵**：

| HTTP 码 | 含义 | 处理 |
|---------|------|------|
| 200/201 | 成功 | 计数 success |
| 401/403 | 鉴权失败 | 计数 fail + 缓存事件 + 日志告警 |
| 429 | 限流 | 计数 fail + 缓存事件 |
| 5xx | 服务端错 | 计数 fail + 缓存事件 |
| 其他 4xx | 业务错 | 计数 fail + 不缓存（重发也错）|
| <=0 | 网络错 | 计数 fail + 缓存事件 |

**离线缓存回放**：
- `replayOfflineOnce()`：每次调用回放一条
- 主 loop 每 5s 调用一次
- 回放成功 → `dropOfflineEvent()`

### 4.5 Heartbeat

- 60s 周期
- 失败指数退避：5s → 10s → 20s → 40s → 60s（上限）
- 不与 Reporter 并发：`if (Reporter::isBusy()) return;`
- WiFi 不通时挂起，连上后立即触发

### 4.6 LedIndicator

8 种状态，非阻塞时间片驱动：

| 状态 | 模式 |
|------|------|
| Booting | 1Hz 慢闪 |
| Connecting | 4Hz 快闪 |
| Online | 常亮 |
| Reporting | 100ms 单脉冲 |
| Heartbeat | 30ms 单脉冲 |
| ApConfig | 2 短闪 + 长灭（1.5s 周期） |
| ErrorWifi | 长灭 1s + 3 短闪 |
| ErrorServer | 长灭 1s + 5 短闪 |

---

## 五、稳定性保证

### 5.1 防 WDT

- 所有 `loop()` 单轮目标 < 50ms
- `yield()` 在 loop 末尾必须调用
- `delay()` 仅在 setup 中使用，loop 中禁用
- `HTTPClient` 设超时 6s，绝不无限等待

### 5.2 防内存碎片

- 所有 buffer 静态分配（`static char[]`、`static DeviceConfig`）
- `String` 仅在函数内栈分配，且 `reserve()` 预留容量
- 不使用 `new`/`malloc` 在 loop 中
- HTTP 短连接，请求结束立即 `client.stop()` + `http.end()`

### 5.3 防网络抖动

- WiFi 自动重连 + 指数退避（2s → 4s → 8s ... 60s 上限）
- 5 次失败转 AP 配网，给用户介入机会
- 心跳失败也指数退避，不轰炸服务端
- 上报失败写离线缓存，恢复后异步回放

### 5.4 防误触发

- PIR 中断 5ms 硬件消抖
- 主 loop 50ms settle 后二次确认电平
- 本地 30s 防抖（可配置 `PIR_LOCAL_DEBOUNCE_MS`）
- 服务端 30s 防抖兜底

### 5.5 防配置丢失

- EEPROM magic + version + CRC8 三重校验
- 配置变更立即 `commit()` 落盘
- WiFi.persistent(false) + 手动 EEPROM，避免双重写入冲突

### 5.6 防身份失效

- device_token 失效（401）→ 自动 fallback 到 activation_code
- activation_code 也失效 → 缓存事件 + LED ErrorServer
- 用户可长按 FLASH 重配网，重新走激活流程

---

## 六、性能预算

### 6.1 RAM 占用估算

| 项 | 占用 |
|----|------|
| 全局变量 + BSS | ~8KB |
| WiFi stack + LWIP | ~20KB |
| HTTPClient 临时 | ~4KB（请求期） |
| ArduinoJson（未启用，预留） | 0 |
| 离线缓存读取 | ~1KB（峰值） |
| **合计峰值** | **~33KB** |
| **剩余可用** | **~47KB**（远高于 20% 安全水位） |

### 6.2 Flash 占用估算

| 项 | 占用 |
|----|------|
| Bootloader | ~8KB |
| Firmware（编译后预估） | ~380KB |
| LittleFS 数据分区 | 2MB |
| EEPROM 镜像 | 4KB |
| OTA 备份分区 | ~1MB（预留） |
| **合计** | < 4MB |

### 6.3 时序预算

| 操作 | 耗时 |
|------|------|
| 单次 loop | < 50ms |
| PIR 中断响应 | < 100µs（仅置 flag） |
| HTTP 请求（含网络） | 200-2000ms |
| WiFi 重连 | 1-15s（指数退避） |
| 心跳周期 | 60s |

---

## 七、烧录与部署

### 7.1 编译烧录

```bash
cd firmware
pio run                    # 编译
pio run -t upload          # USB 烧录
pio device monitor         # 串口监控
```

### 7.2 配置服务端地址

修改 `src/config.h`：

```c
#define SERVER_HOST "your-server.com"
#define SERVER_PORT 80
```

### 7.3 用户部署流程

1. 烧录固件
2. 通电，设备自动进入 AP 模式（首次启动）
3. 手机接入 `PirCloud-Setup-XXXX` WiFi
4. 浏览器自动弹出配网页面，输入家庭 WiFi 凭据
5. 设备重启连接 WiFi，LED 变常亮（Online）
6. 管理员后台生成激活码 `WB-XXXX-XXXX-XXXX`
7. **设备激活码写入 EEPROM**（当前需通过 OTA 或串口指令，未来提供配置工具）
8. PIR 检测到人体 → 设备上报 → Web 面板显示告警

### 7.4 重新配网

长按板载 FLASH 按钮 5 秒，LED 转 AP 模式（2 短闪 + 长灭），重新配网。

---

## 八、对接协议（与 pir-cloud 后端）

### 8.1 上报请求

```http
POST /api/report HTTP/1.1
Host: pir-cloud.example.com
X-Device-Token: <64字符 hex>
X-Activation-Code: WB-XXXX-XXXX-XXXX  (fallback，token 缺失时用)
Content-Type: application/json
User-Agent: PirCloud/1.0 (ESP8266)
Accept: application/json

{"status":"presence","timestamp":1718700000}
```

### 8.2 心跳请求

```http
POST /api/report/heartbeat HTTP/1.1
Host: pir-cloud.example.com
X-Device-Token: <64字符 hex>
Content-Type: application/json

{"timestamp":1718700000}
```

### 8.3 响应

成功：
```json
{"code":0,"message":"上报成功","data":null}
```

失败（激活码未绑定）：
```json
{"code":2005,"message":"设备未授权","data":null}
```
HTTP 状态码 401。

---

## 九、未来扩展

### 9.1 OTA 升级

`platformio.ini` 已预留 `env:esp12e_ota`，需要：
- 服务端实现 `GET /api/ota/version` 和 `GET /api/ota/firmware.bin`
- 设备端集成 `ESP8266httpUpdate`，启动时检查版本

### 9.2 设备直连激活

`POST /api/devices/bind` 接口固件已留入口（`Storage::updateToken`），需要：
- 服务端补全该接口（接收 activation_code，返回 device_token）
- 固件在 setup 阶段调用一次激活，拿到 token 后写入 EEPROM

### 9.3 HTTPS 端到端加密

当前依赖服务端 Nginx + Let's Encrypt 反代 TLS。若需端到端 HTTPS：
- 切换到 `BearSSL::WiFiClientSecure`
- 写入根证书（约 22KB RAM 占用）
- 调整 `HTTP_TIMEOUT_MS` 至 8s（TLS 握手更慢）

### 9.4 NTP 时间同步

当前 `timestamp` 用 `millis()/1000`，服务端会用 `Date.now()` 覆盖。
若需精确本地时间戳，集成 `NtpClientLib`，启动后同步一次写入 RTC RAM。

### 9.5 多传感器扩展

预留 GPIO12/13/14（D6/D7/D5），可扩展：
- 温湿度传感器（DHT22 / SHT3x）
- 光照传感器（BH1750）
- 继电器输出（控制其他设备）

---

## 十、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| ESP8266 WiFi stack 偶发崩溃 | 设备掉线 | Soft WDT + 硬件 WDT 自动复位 |
| 服务端限流触发 429 | 上报丢失 | 本地缓存 + 60s 周期回放 |
| PIR 误触发 | 假告警 | 双端防抖（30s）+ settle 二次确认 |
| 路由器 DHCP 失败 | 设备无法联网 | 指数退避重连 + AP 配网兜底 |
| EEPROM 写入失败 | 配置丢失 | CRC8 校验 + commit 失败保留 RAM 镜像 |
| 设备 token 失效 | 上报 401 | 自动 fallback 到 activation_code |
| Flash 写入磨损 | 长期可靠性 | 离线缓存走 LittleFS（磨损均衡），EEPROM 仅写关键配置 |
| AP Portal 被劫持 | 配网被中间人 | 仅本机局域网，无敏感信息，接受风险 |

---

## 附录 A：编译产物验证

部署前建议：
1. `pio run` 编译无 warning
2. `pio run -t upload` 烧录后串口能看到启动日志
3. 通电 30s 内 LED 进入 Online 常亮
4. 手动遮挡 PIR 后放开，应触发一次上报，串口看到 `HTTP 200`
5. 拔电源重启，配置应保留，无需重新配网
6. 拔路由器电源 30s，设备 LED 转 ErrorWifi，恢复后自动转 Online
7. 上报期间拔路由器，LED 转 ErrorWifi，事件进入离线缓存，恢复后自动回放

## 附录 B：调试命令

```bash
# 查看串口输出（带时间戳）
pio device monitor --filter time

# 查看编译后的 RAM/Flash 占用
pio run -v | grep -E "(RAM|Flash)"

# 烧录 LittleFS 数据分区（如需）
pio run -t uploadfs
```

## 附录 C：故障排查

| 现象 | 可能原因 | 排查 |
|------|----------|------|
| LED 一直 1Hz 慢闪 | 启动卡住 | 看串口日志，检查 setup 各步 |
| LED 一直 4Hz 快闪 | WiFi 连不上 | 检查 SSID/密码，路由器是否 2.4GHz |
| LED 2 短闪 + 长灭 | AP 模式 | 接入 `PirCloud-Setup-XXXX` 重新配网 |
| LED 长灭 + 3 短闪 | WiFi 失败重连 | 路由器问题，等待自动恢复 |
| LED 长灭 + 5 短闪 | 服务端错 | 检查 SERVER_HOST、激活码有效性 |
| PIR 不触发 | 接线/传感器 | 用万用表测 PIR OUT 引脚电平变化 |
| 上报一直 401 | token/激活码无效 | 长按 FLASH 重新配网，检查激活码是否已绑定 |

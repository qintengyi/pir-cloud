# pir-cloud ESP8266 固件 — 架构评审报告

| 字段 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 评审人 | 嵌入式固件工程师（接手） |
| 日期 | 2025-06-18 |
| 评审范围 | `firmware/src/` 全部 9 模块 + `platformio.ini` + `FIRMWARE-ARCHITECTURE.md` |
| 总体评分 | **8 / 10** — 架构专业，代码质量高，主要风险在 HTTP 同步阻塞 |

---

## 一、接手声明

本文档为嵌入式固件工程师正式接手 ESP8266 pir-cloud固件项目的架构评审。评审基于对全部源码（9 个模块、约 1200 行）的逐行审查，对照 ESP8266 硬件约束和嵌入式最佳实践，给出实时性/稳定性评估与改进建议。

---

## 二、现有架构评估 — 做得好的地方

| # | 设计决策 | 评价 |
|---|---------|------|
| 1 | 单 loop 协作式调度，不用 FreeRTOS | ✅ 正确。ESP8266 Arduino Core 无真正多线程，民间 FreeRTOS 移植与 WiFi stack 抢资源易死锁 |
| 2 | ISR 只置 `volatile bool flag` + `millis()` | ✅ 符合规则。ISR 内无浮点、无 String、无 WiFi API |
| 3 | PIR 中断 5ms 硬件消抖 + loop 50ms settle 二次确认 | ✅ 双重防误触发 |
| 4 | 双端防抖（固件 30s + 服务端 30s） | ✅ 减少无效 HTTP，服务端兜底 |
| 5 | 离线缓存走 LittleFS（磨损均衡），不走 EEPROM | ✅ 正确。EEPROM 频繁写不利 |
| 6 | device_token + activation_code 双鉴权 fallback | ✅ 首次部署友好 |
| 7 | EEPROM magic + version + CRC8 三重校验 | ✅ 断电保护完善 |
| 8 | 库版本全部 pin（espressif8266@4.2.2, ArduinoJson@6.21.5） | ✅ 生产环境正确做法 |
| 9 | WiFi 指数退避重连（2s→4s→...→60s），5 次失败转 AP 配网 | ✅ 防路由器 AP 表刷爆 |
| 10 | LED 6 种状态编码 + 一次性脉冲 | ✅ 无屏可诊断 |
| 11 | HTTP 短连接 + `setReuse(false)` + 请求结束立即 `end()` | ✅ 防长连接内存碎片化 |
| 12 | `fno-exceptions` 关闭 C++ 异常 | ✅ 减 flash + 防 OOM 抛异常 |
| 13 | loop 单轮 > 50ms 打印警告 | ✅ 阻塞检测 |
| 14 | `WiFi.persistent(false)` + 手动 EEPROM | ✅ 避免 WiFi 库每次 boot 重写 flash |

---

## 三、发现的问题

### P1 — 影响稳定性，建议优先修复

#### P1-1：HTTP 同步阻塞导致单轮 loop 远超 50ms 目标

**现象**：步骤 2（PIR 触发上报）、步骤 3（离线回放）、步骤 4（心跳）的 HTTP 请求都是同步阻塞的。单个 HTTP 请求正常耗时 200-2000ms，超时 6s。

**风险**：
- 空载 loop < 10ms ✅，但 HTTP 触发时单轮可达 6s
- HTTP 期间 `yield()` 不会被调用，WiFi stack 无法得到 CPU 时间
- 虽然 `HTTPClient` 内部 `WiFiClient` 在等待数据时会调用 `delay(1)` 间接 feed Soft WDT，不会触发 WDT 复位，但 WiFi 连接可能因缺乏维护而中断
- `Heartbeat::tick()` 有 `if (Reporter::isBusy()) return;` 防并发，但 `replayOfflineOnce()` 没有此检查 — PIR 上报后 isBusy 已清 false，replay 可能紧接着再发一个 HTTP，单轮两个请求

**建议**：
1. 在 `replayOfflineOnce()` 调用前增加 `if (Reporter::isBusy())` 检查
2. 增加全局"本轮已发 HTTP"标志，确保单轮最多一个 HTTP 请求
3. 长期方案：将 HTTP 拆分为状态机（connect → poll → read），每轮 loop 推进一步，真正非阻塞。ESP8266 上可用 `WiFiClient` 的 `connect()` 非阻塞模式 + `connected()`/`available()` 轮询实现

#### P1-2：`dropOfflineEvent()` 逐字节 String 拼接产生堆碎片

**位置**：`storage.cpp:171-173`
```cpp
String rest;
while (f.available()) {
  rest += (char)f.read();  // 每次可能 realloc
}
```

**风险**：最坏情况 49 条缓存 × 30 字节 ≈ 1.5KB，`String::operator+=` 每次追加可能触发 `realloc`，在 ESP8266 有限的堆上产生碎片。长期运行后可能导致 `malloc` 失败。

**建议**：
```cpp
size_t restLen = f.size() - firstLen;
String rest;
rest.reserve(restLen + 1);
while (f.available()) {
  rest += (char)f.read();
}
```
或更优：用临时文件重写（写新文件 → 删旧文件 → 重命名），避免全量读入内存。

#### P1-3：WifiManager AP 模式 `new` 动态分配

**位置**：`wifi_manager.cpp:114, 118`
```cpp
if (!g_dns) g_dns = new DNSServer();
if (!g_portal) g_portal = new ESP8266WebServer(80);
```

**风险**：违反"无动态分配"原则。虽然 `exitApConfig()` 中 `delete` 了（配对生命周期管理），但 AP 配网时 ESP8266 同时跑 SoftAP + DNS + HTTPServer，内存压力最大，`new` 失败会导致配网功能不可用且无降级处理。

**建议**：改为静态对象（`static DNSServer s_dns;` / `static ESP8266WebServer s_portal(80);`），避免堆分配。

---

### P2 — 可靠性改进

#### P2-1：`buildReportBody` / `buildHeartbeatBody` 用 String 而非静态 buffer

**位置**：`reporter.cpp:18-36`

文档声明"手撸 JSON 字符串避免堆分配"，但实现用了 `String` + `reserve()`。虽然栈上使用且立即释放，碎片风险可控，但与设计文档不一致。

**建议**：改用 `static char buf[64]` + `snprintf`，真正零堆分配。

#### P2-2：无 NTP 时间同步

`timestamp` 用 `millis()/1000`，服务端用 `Date.now()` 覆盖。PRD 要求端到端 ≤ 5s 延迟，时间戳精度影响告警时序准确性。若服务端时钟与设备感知时间偏差大，告警历史的时间线会混乱。

**建议**：集成 `NtpClientLib`，WiFi 连上后同步一次，写入 RTC RAM。

#### P2-3：无 OTA 升级

`platformio.ini` 预留了 `env:esp12e_ota`，但代码无 OTA 检查逻辑。生产部署后固件更新需物理接触设备，维护成本高。

**建议**：集成 `ESP8266httpUpdate`，启动时检查 `/api/ota/version`。

#### P2-4：无 HTTPS，激活码明文传输

PRD 风险表已提到。当前依赖 Nginx 反代 TLS，设备到服务器间走 HTTP。若部署在非可信网络，激活码可被抓包。

**建议**：长期切 `BearSSL::WiFiClientSecure` + 根证书（约 22KB RAM）。短期确保 Nginx 与设备同机房/同 VPC。

#### P2-5：`PirSensor::begin()` 中 `delay(100)` 读取初始状态

注释说 HC-SR501 上电 1-2s 稳定，但只 delay 100ms。初始状态可能误判为 Absence（实际有人），首次 Presence 边沿会延迟到下次状态变化。

**影响**：低 — 后续中断会纠正，但首次上报可能延迟。

**建议**：delay 改为 2000ms（setup 中可接受阻塞），或改为启动后 2s 内不触发上报。

---

### P3 — 代码质量

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| P3-1 | `storage.cpp:116,139,161,187` | 每次 `cacheOfflineEvent`/`peek`/`drop`/`count` 都调 `LittleFS.begin()` | `begin()` 在 `Storage::begin()` 已调，后续冗余 |
| P3-2 | `diagnostics.cpp:28` | `uint8_t level_map[]` 每次调用构造 | 改 `static constexpr` |
| P3-3 | `heartbeat.cpp:45` | `min<uint8_t>(s_failCount, 4)` 可读性差 | 加注释说明退避序列 5s/10s/20s/40s/60s |
| P3-4 | `config.h:24` | `SERVER_HOST` 是占位符 `pir-cloud.example.com` | 部署前必须改 |
| P3-5 | `wifi_manager.cpp:137` | `onNotFound` 重定向到 `4.4.4.4` | Captive Portal 应重定向到 `192.168.4.1`，`4.4.4.4` 是公网 IP，DNS 劫持后可能不通 |

---

## 四、实时性评估

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 空载 loop 周期 | < 50ms | < 10ms | ✅ |
| PIR 中断响应 | < 100µs | < 100µs（仅置 flag） | ✅ |
| PIR 边沿到上报发起 | < 100ms | ~50ms（settle）+ 1 轮 loop | ✅ |
| HTTP 请求耗时 | — | 200-2000ms（正常），6s（超时） | ⚠️ 阻塞 loop |
| WiFi 重连 | — | 1-15s（指数退避），期间 loop 正常 | ✅ |
| 心跳周期 | 60s | 60s ± 1 轮 loop | ✅ |

**结论**：空载实时性优秀。HTTP 同步阻塞是唯一实时性短板，但 6s 超时兜底防死锁，且 PIR 检测本身是秒级业务（非毫秒级硬实时），可接受。

---

## 五、稳定性评估

| 维度 | 措施 | 状态 |
|------|------|------|
| 防 WDT 复位 | loop 末尾 `yield()`，HTTP 6s 超时 | ✅ |
| 防内存碎片 | 静态 buffer 为主，HTTP 短连接 | ⚠️ dropOfflineEvent String 拼接 |
| 防网络抖动 | 指数退避 + 离线缓存回放 | ✅ |
| 防误触发 | 双端防抖 + settle 二次确认 | ✅ |
| 防配置丢失 | CRC8 + magic + version | ✅ |
| 防身份失效 | token → activation_code fallback | ✅ |
| 防 Flash 磨损 | 离线缓存走 LittleFS | ✅ |

---

## 六、改进建议优先级

| 优先级 | 项目 | 工作量 | 收益 |
|--------|------|--------|------|
| P1 | replayOfflineOnce 增加 isBusy 检查 + 单轮单 HTTP 标志 | 0.5h | 防连续 HTTP 阻塞 |
| P1 | dropOfflineEvent 改 reserve 或临时文件 | 1h | 防堆碎片 |
| P1 | WifiManager AP 对象改静态 | 1h | 防 AP 模式 OOM |
| P2 | buildReportBody 改静态 buffer | 0.5h | 零堆分配 |
| P2 | 集成 NTP | 2h | 时间戳准确性 |
| P2 | 实现 OTA | 4h | 远程维护能力 |
| P2 | PIR begin delay 改 2000ms | 0.1h | 首次状态准确性 |
| P3 | 清理冗余 LittleFS.begin() | 0.5h | 代码整洁 |
| P3 | 修复 onNotFound 重定向 IP | 0.1h | Captive Portal 可靠性 |

---

## 七、下一步建议

1. **编译验证**：当前 `SERVER_HOST` 是占位符，需确认服务端地址后 `pio run` 验证编译通过
2. **P1 修复**：3 个 P1 问题工作量约 2.5h，建议优先修复
3. **硬件测试**：在真实 ESP-12E 上验证 PIR 触发上报全链路
4. **功能扩展**：按需推进 OTA / NTP / HTTPS

---

## 附录：模块文件清单

| 模块 | 文件 | 行数 | 职责 |
|------|------|------|------|
| 入口 | main.cpp | 182 | setup + loop 调度 |
| 配置 | config.h | 128 | 编译期参数 |
| 引脚 | pins.h | 48 | GPIO 映射 |
| 持久化 | storage.h/cpp | 198 | EEPROM + LittleFS 离线缓存 |
| WiFi | wifi_manager.h/cpp | 326 | 连接管理 + AP 配网 Portal |
| PIR | pir_sensor.h/cpp | 144 | 人体感应驱动 + 防抖 |
| 上报 | reporter.h/cpp | 283 | HTTP 上报 + 离线回放 |
| 心跳 | heartbeat.h/cpp | 71 | 60s 心跳调度 |
| LED | led_indicator.h/cpp | 142 | 状态指示 |
| 诊断 | diagnostics.h/cpp | 102 | 日志 + 统计 |
| **合计** | **11 文件** | **~1624** | |

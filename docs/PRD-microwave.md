# PRD — pir-cloud 微波人体检测分支

## 1. 项目信息

| 项 | 值 |
|---|---|
| **项目名称** | pir_cloud_microwave |
| **语言** | 中文 |
| **编程语言/技术栈** | 后端 Node.js + Fastify 4 + Prisma + MySQL 8；前端 React 18 + Vite + MUI 5 + Tailwind CSS + Zustand + React Query；固件 PlatformIO + Arduino（ESP32-S3） |
| **原始需求复述** | 在现有红外人体检测云平台 pir-cloud 基础上新增"微波人体检测"分支：硬件从 ESP8266 + AM312 红外模块升级为 ESP32-S3 + RCWL-0515 微波雷达模块。需在固件层面和对接面板层面同时开发，优先完成面板侧设备类型区分与新固件开发。要求把需求想清楚想全，无时间限制。 |

---

## 2. 产品目标

| # | 目标 | 衡量标准 |
|---|------|---------|
| G1 | **建立设备类型体系**：在数据库、后端 API、前端全链路引入 `DeviceType`（infrared/microwave）概念，使同一套平台能同时管理红外与微波两类人体检测设备，且对存量红外设备和数据零破坏 | DeviceType 枚举上线后，存量 Device/ActivationCode/FirmwareVersion 数据默认回填为 `infrared`，现有红外设备上报、绑定、告警、刷写功能行为不变 |
| G2 | **面板侧完成设备类型区分**：用户与管理员在 Web 面板能直观区分两类设备——设备列表/详情/绑定/告警/固件管理/固件刷写/通知文案全面按类型呈现或筛选，告警文案不再一律写死"红外/人体检测告警" | 所有"红外"专属文案改造完成并按类型动态显示；设备列表、固件列表支持类型筛选；刷写页按类型拉取对应最新固件并适配 ESP32-S3 参数 |
| G3 | **交付 ESP32-S3 微波固件**：移植旧 ESP8266 固件的配网/激活/上报/心跳/离线缓存能力到 ESP32-S3，适配 RCWL-0515 微波传感器驱动，并补齐设备内 OTA 短板 | 微波设备能完成"配网→激活→上报 presence/absence→接收告警通知"全链路；支持设备内 OTA 自升级；AP 热点、上报协议与平台完全对接 |

---

## 3. 用户故事

### 面板侧（用户）

**US-1：用户区分查看两类设备**
> 作为一名同时拥有红外和微波设备的用户，我想在设备列表页看到每台设备的类型标签（红外/微波）并能按类型筛选，这样我能快速定位某类设备，而不是混在一起难以分辨。

**US-2：用户绑定微波设备**
> 作为一名拿到微波设备激活码的用户，我想在绑定设备时系统自动识别该激活码对应的设备类型是"微波"，并给出对应的配网指引，这样我不会拿着微波设备的码却去看红外设备的配网说明。

**US-3：用户收到差异化的告警文案**
> 作为一名微波设备用户，当设备检测到有人时，我想收到的告警邮件和 QQ 通知明确写明"微波人体检测告警"，而不是笼统的"人体检测告警"，这样我能立刻知道是哪类设备、什么原理触发的告警。

**US-3a：用户在控制台看到通用引导**
> 作为一名新用户，当我没有绑定任何设备时，控制台空状态提示我"输入激活码即可绑定人体检测设备"，而不是只写"红外感应设备"——因为系统现在支持多种设备类型。

### 面板侧（管理员）

**US-4：管理员按类型管理固件**
> 作为管理员，我想在上传固件时选择它属于"红外"还是"微波"设备类型，并在固件列表按类型筛选，这样两类设备的固件不会混在一起，也不会出现把微波固件刷到红外设备上的错误。

**US-4a：管理员为每类设备独立设最新固件**
> 作为管理员，我想为红外设备和微波设备分别设置各自的"最新固件"，而不是全局只能有一个最新版本——因为两类芯片（ESP8266 vs ESP32-S3）固件完全不通用。

**US-5：管理员生成带类型的激活码**
> 作为管理员，我在批量生成激活码时能指定这批码用于红外还是微波设备，并在激活码列表/导出中看到类型列，这样发货时不会把红外码和微波码搞混。

**US-6：管理员按类型刷写固件**
> 作为管理员/用户，我在固件刷写页选择设备类型（红外/微波）后，页面自动拉取该类型的最新固件并以对应芯片参数（ESP8266 vs ESP32-S3 的 flashSize/flashMode）刷写，配网指引也按类型显示对应的热点名。

### 固件侧（设备）

**US-7：微波设备完成配网与上报**
> 作为一台 ESP32-S3 微波设备，我上电后能创建专属 AP 热点（PirCloud-MW-Setup-XXXX）引导用户配网，配网后用激活码换取 device_token，随后通过 `POST /api/report` 上报 presence/absence 状态，与平台协议完全一致。

**US-8：微波设备支持设备内 OTA**
> 作为一台微波设备，我能在运行时主动查询云端是否有该设备类型的新固件，若有则下载并自升级，而不必每次更新都让用户用 USB 线连电脑刷写。

---

## 4. 需求池

> 优先级说明：**P0 = Must Have**（必须有，阻塞主流程）；**P1 = Should Have**（应该有，提升完整度）；**P2 = Nice to Have**（锦上添花，可后续迭代）。
>
> 实施顺序建议：**P0 面板侧设备类型体系 → P0 固件类型管理 → P0 文案差异化 → P0 刷写页适配 → P0 微波固件开发**。其中"面板侧设备类型区分"用户明确要求优先。

### P0 — Must Have（必须有）

#### A. 设备类型体系（全链路打通）

| ID | 需求描述 |
|----|---------|
| TYPE-P0-1 | **新增 Prisma 枚举 `DeviceType { infrared microwave }`**。在 `Device`、`ActivationCode`、`FirmwareVersion` 三张表各新增 `device_type DeviceType @default(infrared)` 字段（带索引）。生成迁移并回填存量数据为 `infrared`，保证存量零破坏 |
| TYPE-P0-2 | **激活码生成支持设备类型**：`POST /api/admin/activation/generate` body 新增可选 `deviceType`（默认 `infrared`）；`ActivationCode` 写入时带类型。`generateCodesSchema` 增加该字段枚举校验 |
| TYPE-P0-3 | **设备绑定自动带入类型**：`POST /api/devices/bind` 时，Device 的 `device_type` 从所绑定的 ActivationCode 的 `device_type` 继承（绑定接口无需用户额外选类型，由激活码决定）。`bindDevice` service 创建 Device 时写入 `device_type` |
| TYPE-P0-4 | **设备列表/详情返回类型**：`listDevices`、`getDevice` 返回字段新增 `deviceType`；前端 `DeviceInfo` 类型新增 `deviceType: DeviceType` |
| TYPE-P0-5 | **激活码列表/导出返回类型**：`listCodes`、`exportCodes` 返回/导出 `deviceType` 列；前端 `ActivationCodeInfo` 新增 `deviceType` |
| TYPE-P0-6 | **前端类型定义与常量**：`web/src/types/index.ts` 新增 `export type DeviceType = 'infrared' \| 'microwave'`；`web/src/utils/constants.ts` 新增 `DEVICE_TYPE_MAP`（含 label、color、icon 映射）|

#### B. 面板功能 — 设备类型区分（用户侧优先）

| ID | 需求描述 |
|----|---------|
| UI-P0-1 | **设备列表页（DevicesPage）**：表格新增"设备类型"列，用 Chip + 图标区分（红外/微波）；表头筛选区新增类型下拉筛选（全部/红外/微波）。筛选为前端本地过滤（当前数据已全量拉取）或后端 query 参数（建议后端支持 `deviceType` query）|
| UI-P0-2 | **设备详情页（DeviceDetailPage）**：设备信息卡片新增"设备类型"行，用 Chip 展示 |
| UI-P0-3 | **绑定设备弹窗（BindDeviceDialog）**：绑定成功后展示设备类型；输入激活码后可考虑显示该码对应的类型（需后端加轻量查询接口或绑定返回时携带，**建议绑定结果直接返回 deviceType 即可**，无需额外接口）|
| UI-P0-4 | **控制台概览空状态文案（DashboardPage）**：将"输入激活码即可绑定红外感应设备，开始接收告警通知"改为通用文案"输入激活码即可绑定人体检测设备，开始接收告警通知" |

#### C. 固件管理（管理员侧）

| ID | 需求描述 |
|----|---------|
| FW-P0-1 | **`FirmwareVersion` 加 `device_type` 字段**（见 TYPE-P0-1）。`version` 唯一约束改为 `(version, device_type)` 联合唯一——允许红外与微波各有一个相同版本号的固件。需调整 Prisma `@unique` 为 `@@unique([version, device_type])` |
| FW-P0-2 | **上传固件选类型**：`POST /api/admin/firmware/upload` multipart 新增 `deviceType` 字段（必填，枚举）；`uploadFirmware` service 写入 `device_type`；前端 FirmwarePage 上传对话框新增类型选择（默认红外）|
| FW-P0-3 | **`is_latest` 改为"每类型下唯一最新"**：`setLatest` 和 `uploadFirmware(isLatest=true)` 时，清除最新标记的范围从"全局所有"改为"同 `device_type` 下所有"。即 `updateMany({ where: { is_latest: true, device_type } })` |
| FW-P0-4 | **固件列表返回类型 + 筛选**：`listFirmwares` 返回 `deviceType`；新增 `deviceType` query 筛选。前端 FirmwarePage 表格新增"设备类型"列 + 类型筛选下拉 |
| FW-P0-5 | **公开固件接口支持按类型查询**：`GET /api/firmware/latest` 新增可选 query `?deviceType=microwave`（不传时保持向后兼容，返回红外最新——因存量设备均为红外）；`GET /api/firmware/download/latest` 同理支持 `?deviceType=`。`getLatest`/`getLatestRecord` service 按 `device_type` 过滤 |

#### D. 固件刷写页适配

| ID | 需求描述 |
|----|---------|
| FLASH-P0-1 | **刷写页（FlashPage）按类型选择**：页面顶部新增设备类型选择器（红外/微波，默认红外）。选择后调用 `getLatestFirmware({ deviceType })` 拉取对应最新固件元数据 |
| FLASH-P0-2 | **esptool-js 刷写参数适配 ESP32-S3**：微波（ESP32-S3）使用 `flashSize: '8MB'`（N8R2）或可选 `'16MB'`（N15R8）、`flashMode: 'dio'`、`flashFreq: '80m'`；红外（ESP8266）保持现有 `'4MB'/'dio'/'40m'`。参数随所选类型动态切换 |
| FLASH-P0-3 | **芯片识别提示适配**：EsptoolFlasher 连接后识别芯片，微波分支校验 `/S3/i` 而非 `/8266/i`；提示文案随类型动态（"ESP8266 串口"/"ESP32-S3 串口"）|
| FLASH-P0-4 | **配网指引文案区分类型**：红外分支显示热点 `PirCloud-Setup-XXXX`；微波分支显示 `PirCloud-MW-Setup-XXXX`。FlashPage 顶部说明文案与刷写成功后指引按类型动态显示 |

#### E. 通知文案差异化

| ID | 需求描述 |
|----|---------|
| NOTI-P0-1 | **告警事件 message 按类型**：`report.service.ts` 创建 alarm 事件时，`detail.message` 由写死 `'人体检测告警'` 改为按设备 `device_type` 动态：infrared→`'红外人体检测告警'`，microwave→`'微波人体检测告警'`。需在 `validateDevice` 时一并查出 `device_type` |
| NOTI-P0-2 | **邮件告警 alarmType 按类型**：`notification.service.ts` 的 `alarmType` 由写死 `'人体检测告警'` 改为按设备类型动态（同上文案）；`dispatch` 传入 device 时需携带 `device_type`，`sendEmailNotification` 据此生成 alarmType 传给 `sendAlarmEmail` |
| NOTI-P0-3 | **QQ 通知 tag 按类型**：`sendQQNotification` 中 alarm 的 tag `'有人'` 保持，但可在消息体补充设备类型标识（如 `[微波·有人]`），或维持 `[有人]` + 设备名（设备名已足够区分）。**建议**：tag 改为 `[红外·有人]`/`[微波·有人]` 以明确原理差异；上线/下线 tag 同理可加类型前缀（可选）|

#### F. 新固件（ESP32-S3 微波）

| ID | 需求描述 |
|----|---------|
| EFW-P0-1 | **移植配网（AP Captive Portal）**：参照旧 ESP8266 固件，用 `WebServer.h` 实现 AP 热点 + Captive Portal 配网页（填 WiFi SSID/密码 + 激活码）。AP 热点名 `PirCloud-MW-Setup-<chipId后4位>` 以区分红外 |
| EFW-P0-2 | **移植激活流程**：配网联网后调 `POST /api/device/activate`（`X-Activation-Code` 头）换取 `device_token`，持久化到 NVS |
| EFW-P0-3 | **移植上报与心跳**：用 `HTTPClient.h` 实现 `POST /api/report`（`X-Device-Token` 头，body `{status, timestamp, rssi}`）与心跳，协议与旧固件/平台完全一致，复用 `/api/report` |
| EFW-P0-4 | **替换 ESP8266 专属库**：`ESP8266WiFi.h`→`WiFi.h`，`ESP8266WebServer.h`→`WebServer.h`，`ESP8266HTTPClient.h`→`HTTPClient.h` |
| EFW-P0-5 | **适配 RCWL-0515 微波传感器驱动**：参照旧 `pir_sensor.cpp`（中断 + 状态机 + 防抖）实现微波传感器驱动。RCWL-0515 OUT 引脚接 ESP32-S3 GPIO（高电平=有人），用 `attachInterrupt` + 状态机检测 presence/absence 跳变，防抖逻辑复用旧方案 |
| EFW-P0-6 | **重选 ESP32-S3 引脚**：确定 RCWL-0515 OUT 信号引脚、板载 LED 引脚、配网按钮（BOOT/GPIO0）引脚分配方案（见待确认问题 Q5）|
| EFW-P0-7 | **持久化改用 Preferences(NVS)**：WiFi 凭据、device_token、配网标志等改用 `Preferences` 库（ESP32 NVS），替代 ESP8266 的 EEPROM |
| EFW-P0-8 | **离线缓存复用 LittleFS**：断网时缓存未上报的 presence 事件到 LittleFS，联网后补传（参照旧固件方案）|
| EFW-P0-9 | **PlatformIO 工程配置**：`platformio.ini` 配置 `esp32-s3` board（`esp32-s3-devkitc-1`）、framework=arduino、board_build.partitions、PSRAM 选项（N8R2/N15R8 变体）、upload_speed 等 |

### P1 — Should Have（应该有）

| ID | 需求描述 |
|----|---------|
| OTA-P1-1 | **设备内 OTA（微波固件）**：微波固件实现 OTA 自升级——周期性调 `GET /api/firmware/latest?deviceType=microwave` 比对版本，有新版则 `Update` 库下载刷写重启。补齐旧红外固件"无设备内 OTA"的短板 |
| UI-P1-1 | **告警历史页类型筛选**：AlarmsPage 新增设备类型筛选下拉（全部/红外/微波）。需后端 `listAlarms` 支持 `deviceType` query（join device 表过滤）|
| FW-P1-1 | **固件列表设最新按钮按类型隔离**：FirmwarePage "设为最新"操作完成后，列表中同类型其它固件的"最新"标记自动取消（后端 FW-P0-3 已保证，前端需刷新对应类型数据）|
| NOTI-P1-1 | **通知文案完整排查**：全局搜索所有含"红外"/"人体检测告警"的文案（README、nginx 示例、邮件模板、前端组件），按场景改为通用或按类型动态。记录改动清单 |
| DASH-P1-1 | **控制台概览统计可按类型分组**：DashboardPage 统计卡片可展示按类型分组的设备数（如"红外 3 台 / 微波 2 台"），或增加类型筛选 |
| BIND-P1-1 | **绑定弹窗显示激活码类型预览**：用户输入激活码后（失焦/输入完成），调轻量接口查询该码类型并显示"此激活码对应微波设备"，提升绑定前预期管理。需新增 `GET /api/activation/check?code=xxx` 只返回类型+状态（不泄露其它信息）|

### P2 — Nice to Have（锦上添花）

| ID | 需求描述 |
|----|---------|
| HTTPS-P2-1 | **微波固件支持 HTTPS 上报**：ESP32-S3 有能力支持 HTTPS。可配置上报/OTA 走 HTTPS（需服务端提供证书或固件内置 CA 证书 fingerprint 校验）。工作量大，建议暂不做（见待确认问题 Q6）|
| MQTT-P2-1 | **MQTT 实时通信**：将设备上报从 HTTP 轮询改为 MQTT 订阅推送，降低延迟。工作量大且需引入 MQTT Broker，建议暂不做（见待确认问题 Q7）|
| UI-P2-1 | **设备类型图标自定义**：使用更贴切的 MUI 图标区分红外（如 `Sensors`/`Whatshot`）与微波（如 `Radar`/`GraphicEq`）|
| FW-P2-1 | **固件版本号自动递增建议**：上传固件时根据同类型最新版本号给出"建议下一版本号"提示 |

---

## 5. UI 设计稿（文字描述）

### 5.1 设备列表页（DevicesPage）

**改动点：**
- **表头**：在"设备名称"与"激活码 ID"之间插入"设备类型"列。
- **设备类型列**：用 MUI `Chip` 渲染。红外设备显示蓝色 `Chip`（图标 `Sensors`，文字"红外"）；微波设备显示青色 `Chip`（图标 `Radar`，文字"微波"）。
- **筛选区**：搜索框右侧新增"设备类型"下拉选择器（`Select`，选项：全部 / 红外 / 微波），默认"全部"。选中后前端本地过滤当前页数据（或传 `deviceType` query 到后端）。
- **其余列**（激活码 ID、状态、最后上报、操作）保持不变。

### 5.2 设备详情页（DeviceDetailPage）

**改动点：**
- **设备信息卡片**：在"设备名称"行下方新增"设备类型"行，右侧用 `Chip` + 图标展示（与列表页样式一致）。
- 通知配置卡片内容不变。

### 5.3 绑定设备弹窗（BindDeviceDialog）

**改动点：**
- 绑定成功后的结果展示区，在"设备名称"下方新增"设备类型"行，用 `Chip` 显示（"红外"/"微波"）。
- 输入框 helperText 可补充提示"激活码已包含设备类型，绑定后自动识别"（P1 阶段实现输入预览）。

### 5.4 控制台概览（DashboardPage）

**改动点：**
- 空状态文案：将"输入激活码即可绑定红外感应设备，开始接收告警通知"改为"输入激活码即可绑定人体检测设备，开始接收告警通知"。
- 最近告警表格"详情"列已展示 `detail.message`，改造后会自动显示"红外人体检测告警"/"微波人体检测告警"，无需额外改表格结构。

### 5.5 固件管理页（FirmwarePage，管理员）

**改动点：**
- **表头**：在"版本"列后插入"设备类型"列，用 `Chip` 区分红外/微波固件。
- **筛选**：表格上方新增"设备类型"下拉筛选（全部/红外/微波）。
- **上传对话框**：新增"设备类型"单选（`RadioGroup` 或 `Select`，默认红外），位于版本号上方。提交时 multipart 附带 `deviceType` 字段。
- **"最新"标记**：表格"最新"列的 `Chip` 逻辑不变，但语义变为"该类型下最新"。

### 5.6 固件刷写页（FlashPage）

**改动点：**
- **顶部新增设备类型选择器**：`ToggleButtonGroup` 或 `RadioGroup`（红外 / 微波），默认红外。切换后重新拉取对应类型最新固件元数据并刷新"最新固件"卡片。
- **最新固件卡片**：标题显示 `最新固件 v{version}` + 类型 `Chip`。
- **方式一（浏览器刷写）**：EsptoolFlasher 接收 `deviceType` prop，据此切换：① 日志中"ESP8266 串口"→"ESP32-S3 串口"；② 芯片识别正则；③ `writeFlash` 参数（flashSize/flashFreq）。
- **说明文案**：顶部"用 USB 数据线将 ESP8266 设备连接到电脑"改为按类型动态（"ESP8266"/"ESP32-S3"）。
- **配网指引**：底部成功提示中热点名按类型显示 `PirCloud-Setup-XXXX`（红外）/ `PirCloud-MW-Setup-XXXX`（微波）。

### 5.7 激活码管理页（ActivationCodesPage，管理员）

**改动点：**
- 生成对话框新增"设备类型"选择（默认红外）。
- 列表表格新增"设备类型"列（`Chip`）+ 筛选。
- 导出 CSV 含设备类型列。

---

## 6. 待确认问题

> 以下决策点需与用户确认后再进入开发。已给出产品侧建议。

| # | 问题 | 产品建议 |
|---|------|---------|
| Q1 | **激活码是否带设备类型？** | **建议带**。激活码生成时指定类型，绑定时 Device 自动继承，体验最佳且避免用户选错。若不带类型，则需用户绑定后手动改类型，易出错。 |
| Q2 | **`GET /api/firmware/latest` 不传 `deviceType` 时的默认行为？** | **建议默认返回 infrared**（向后兼容：存量红外设备和现有 Windows 刷机器无类型参数，仍能拉到红外最新固件）。微波设备/刷写页显式传 `?deviceType=microwave`。 |
| Q3 | **设备类型图标用哪个 MUI 图标？** | 建议红外用 `Sensors`（或 `Whatshot`），微波用 `Radar`（或 `GraphicEq`）。最终以视觉效果为准，可在实现时微调。 |
| Q4 | **微波固件是否需要补设备内 OTA？** | **建议补（P1）**。ESP32-S3 有足够能力，且旧红外固件无 OTA 是已知短板，借此分支补齐。可复用 `GET /api/firmware/latest?deviceType=microwave` 接口。 |
| Q5 | **ESP32-S3 引脚分配方案？** | 需固件开发确认。建议：RCWL-0515 OUT → GPIO4（支持中断的任意 GPIO）；板载 LED → GPIO48（DevKitC-1 自带 RGB LED，可用作状态指示）；配网按钮 → GPIO0（BOOT 键，长按触发配网模式）。最终以硬件接线为准。 |
| Q6 | **是否需要 HTTPS（ESP32-S3 上报/OTA）？** | **建议暂不做**。当前上报走 HTTP（端口 10310/Nginx），改 HTTPS 需服务端配证书、固件内置 CA、处理证书过期，工作量大且收益有限（内网场景）。保留 P2 待后续评估。 |
| Q7 | **是否需要 MQTT？** | **建议暂不做**。引入 MQTT 需新增 Broker、改后端订阅、改固件协议，工作量大。当前 HTTP 上报+心跳已满足需求。保留 P2。 |
| Q8 | **ESP32-S3 变体选 N8R2 还是 N15R8？** | 影响刷写参数 flashSize（8MB/16MB）。建议刷写页默认 N8R2（8MB），并在页面提供变体切换；固件 `platformio.ini` 用条件编译或统一配置。需用户确认目标硬件批次。 |
| Q9 | **QQ 通知 tag 是否加类型前缀（`[微波·有人]`）？** | **建议加**，明确原理差异；但需确认不影响用户已有通知习惯。 |
| Q10 | **存量 Event（告警历史）数据是否回填设备类型？** | Event 表无 `device_type` 字段，历史告警 detail.message 均为"人体检测告警"。**建议不回填历史**（保持原样），新告警按类型生成；告警历史页若需类型筛选，可通过 join device 表的 `device_type` 实时获取（设备类型不可变，安全）。 |

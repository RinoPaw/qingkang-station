# 青康小站软件端

青康小站是面向大学生/年轻人的轻健康状态观察系统。当前软件端包含：

- FastAPI + SQLite 后端；
- 多用户身份、排队、设备分配和本次记录绑定；
- ESP32-S3 心率模块轮询与上传接口；
- 舌象图片上传和 AI 视觉占位结果；
- 非诊断性综合观察卡和历史趋势接口。

本系统只用于健康状态观察和科普记录，不作为医学诊断依据。

## 目录

```text
qingkang_server/
├── main.py
├── tests/test_api_flow.py
├── pyproject.toml
├── requirements.txt
├── data.db
└── uploads/
```

前端项目在同级目录：

```text
qingkang_web/
```

ESP32 草图在：

```text
sketch_may27a/sketch_may27a.ino
```

## 使用 uv 启动后端

```bash
cd qingkang_server
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 2070 --reload
```

启动后访问：

```text
http://127.0.0.1:2070
http://127.0.0.1:2070/docs
```

## 前端启动

```bash
cd qingkang_web
corepack pnpm install
corepack pnpm dev
```

前端默认访问：

```text
http://127.0.0.1:2071
```

如后端不是本机 `2070`，可设置：

```bash
VITE_API_BASE_URL=http://你的后端地址:2070 corepack pnpm dev
```

Windows PowerShell 示例：

```powershell
$env:VITE_API_BASE_URL="http://127.0.0.1:2070"; corepack pnpm dev
```

## 核心数据表

### users

- `id`
- `user_id`
- `nickname`
- `created_at`

### measurement_sessions

- `id`
- `session_id`
- `user_id`
- `nickname`
- `status`
- `queue_position`
- `started_at`
- `finished_at`
- `expires_at`
- `created_at`

`status` 可选：

```text
QUEUED
READY
MEASURING
FINISHED
TIMEOUT
CANCELLED
```

### device_status

- `id`
- `device_id`
- `current_session_id`
- `state`
- `last_seen`
- `created_at`

`state` 可选：

```text
IDLE
READY
MEASURING
DISCONNECTED
```

## 用户和队列接口

### POST /api/users/login

创建或更新用户身份。

```json
{
  "nickname": "Rino"
}
```

响应：

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "user_id": "user_xxx",
    "nickname": "Rino",
    "created_at": 1780000000
  }
}
```

### POST /api/queue/join

加入测量队列。设备在线轮询后，服务器会把队首分配为当前测量用户。

```json
{
  "user_id": "user_xxx",
  "nickname": "Rino",
  "device_id": "esp32_s3_001"
}
```

重要响应字段：

```json
{
  "ok": true,
  "session_id": "sess_xxx",
  "session": {
    "status": "QUEUED",
    "queue_position": 1,
    "expires_at": null
  },
  "queue": {
    "position": 1,
    "people_ahead": 0,
    "is_active": false
  }
}
```

### GET /api/session/{session_id}

查询当前会话、队列、设备、心率、舌象和综合观察卡。

### POST /api/session/{session_id}/finish

网页用户主动结束本次测量，并释放硬件给下一位。

```json
{
  "device_id": "esp32_s3_001"
}
```

### POST /api/session/{session_id}/cancel

网页用户取消本次测量，并释放硬件给下一位。

## ESP32-S3 心率模块接口

硬件默认不测量、不上传。它只做一件事：定时轮询服务器，看有没有分配给自己的当前记录。

### 1. 设备轮询

```http
GET /api/device/poll?device_id=esp32_s3_001
```

该接口只给 ESP32 使用，会刷新设备在线心跳。网页端只读取设备状态，不应调用该接口。

无用户时：

```json
{
  "ok": true,
  "state": "IDLE",
  "active_session": null,
  "poll_interval_ms": 1000,
  "message": "Waiting / Idle"
}
```

有用户时：

```json
{
  "ok": true,
  "state": "READY",
  "active_session": {
    "session_id": "sess_xxx",
    "user_id": "user_xxx",
    "nickname": "Rino",
    "status": "READY",
    "started_at": 1780000000,
    "expires_at": 1780000120
  },
  "heart_upload": "/api/heart-rate",
  "poll_interval_ms": 1000,
  "message": "Active session: Rino"
}
```

ESP32 行为：

- `active_session == null`：OLED 显示 `Waiting / Idle`，不上传心率。
- `active_session != null`：OLED 显示用户昵称或 `session_id`，开始采样。
- 上传心率时必须携带服务器返回的 `session_id`。

### 2. 网页读取设备状态

```http
GET /api/device/status?device_id=esp32_s3_001
```

该接口用于前端展示设备使用情况，不会刷新 `last_seen`。如果 ESP32 停止轮询超过一段时间，服务器会把设备视为离线，并让正在进行的测量记录超时，避免网页把设备“伪装在线”。

### 3. 心率上传

```http
POST /api/heart-rate
Content-Type: application/json
```

```json
{
  "session_id": "sess_xxx",
  "device_id": "esp32_s3_001",
  "bpm": 82,
  "raw": 2090,
  "amplitude": 410.5,
  "state": "MEASURING"
}
```

`state` 可选：

```text
READY
HOLD_STILL
MEASURING
ADJUST_FINGER
FINISHED
TIMEOUT
CANCELLED
```

服务端校验：

- 没有 `active_session` 时上传会返回 `409`；
- 上传的 `session_id` 不是当前设备分配对象时返回 `409`；
- 只有当前 active session 可以写入心率记录；
- `READY` / `PLACE_FINGER` 且 `bpm <= 0` 时只更新状态，不写入心率记录；
- `FINISHED` / `TIMEOUT` / `CANCELLED` 会释放当前硬件。

### 4. 设备主动释放

```http
POST /api/device/release
Content-Type: application/json
```

```json
{
  "device_id": "esp32_s3_001",
  "session_id": "sess_xxx",
  "status": "FINISHED"
}
```

`status` 可选：

```text
FINISHED
TIMEOUT
CANCELLED
```

释放后服务器自动把队列下一位设为新的 `active_session`。

## 舌象上传接口

### POST /api/tongue-image

表单字段：

- `session_id`：必填；
- `user_id`：必填或默认；
- `file`：图片文件。

当前 AI 视觉为占位实现：

```json
{
  "quality": "waiting_ai",
  "tongue_detected": false,
  "coating_color": "pending",
  "coating_ratio": 0.0,
  "note": "舌象图片已记录，YOLO 舌体检测和图像质量分析待接入。"
}
```

## 历史与验收接口

### GET /api/latest

返回最近一次 session 的综合数据。

### GET /api/history

```text
GET /api/history?user_id=user_xxx&limit=8
```

返回最近几次会话，用于前端趋势图。

## 自动测试

```bash
cd qingkang_server
uv run python tests/test_api_flow.py
```

测试覆盖：

- 用户创建；
- 设备离线时用户只进入队列，ESP32 轮询后才获得测量权；
- 第二位用户进入等待队列；
- 网页读取设备状态不会刷新 ESP32 在线心跳；
- `READY` 零心率不会写入心率记录；
- 非 active session 不能上传心率；
- active session 可以上传心率；
- 舌象图片上传并绑定同一 `session_id`；
- 完成当前会话后自动提升队列下一位；
- 历史记录可查询。

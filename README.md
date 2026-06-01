# 青康小站

青康小站是一个面向校园场景的轻健康状态观察系统，包含：

- ESP32-S3 + PulseSensor 心率模块；
- FastAPI + SQLite 后端；
- React + TypeScript + Tailwind CSS 前端终端；
- 多用户排队与硬件占用机制；
- 舌象图片上传和 AI 视觉分析占位；
- 非诊断性综合观察卡和历史趋势展示。

本系统仅用于健康状态观察和科普记录，不作为医学诊断依据。

## 项目结构

```text
.
├── qingkang_server/     # FastAPI 后端，使用 uv
├── qingkang_web/        # Vite + React 前端，使用 pnpm
├── sketch_may27a/       # ESP32-S3 草图
└── README.md
```

## 后端

```powershell
cd qingkang_server
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 2070 --reload
```

接口文档：

```text
http://127.0.0.1:2070/docs
```

## 前端

```powershell
cd qingkang_web
corepack pnpm install
corepack pnpm dev
```

访问：

```text
http://127.0.0.1:2071/
```

## ESP32 网络接口

硬件默认空闲，定时轮询：

```http
GET /api/device/poll?device_id=esp32_s3_001
```

拿到 `active_session` 后才上传心率：

```http
POST /api/heart-rate
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

更多接口说明见 [qingkang_server/README.md](qingkang_server/README.md)。

## 验收命令

```powershell
cd qingkang_server
uv run python tests/test_api_flow.py

cd ../qingkang_web
corepack pnpm lint
corepack pnpm build
```

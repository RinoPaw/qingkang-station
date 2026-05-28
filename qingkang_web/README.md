# 青康小站前端

Vite + React + TypeScript + Tailwind CSS 实现的轻健康观察终端。

## 启动

```bash
corepack pnpm install
corepack pnpm dev
```

默认连接后端：

```text
http://127.0.0.1:8000
```

如需切换：

```powershell
$env:VITE_API_BASE_URL="http://你的后端地址:8000"; corepack pnpm dev
```

## 构建

```bash
corepack pnpm build
```

## 页面模块

- 身份创建；
- 加入测量队列；
- 当前硬件占用和倒计时；
- 心率实时卡片；
- 舌象上传和 AI 视觉占位；
- 综合观察卡；
- 历史记录和趋势图；
- 非诊断性免责声明。

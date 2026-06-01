# 青康小站前端

Vite + React + TypeScript + Tailwind CSS 实现的校园轻健康状态观察终端。

## 启动

```bash
corepack pnpm install
corepack pnpm dev
```

访问：

```text
http://127.0.0.1:2071
```

默认连接后端：

```text
http://127.0.0.1:2070
```

如需切换：

```powershell
$env:VITE_API_BASE_URL="http://你的后端地址:2070"; corepack pnpm dev
```

## 构建

```bash
corepack pnpm build
```

## 页面模块

- 首页：展示心率记录、舌象上传和综合观察卡入口；
- 个人中心：创建或退出当前身份；
- 心率记录：加入测量队列、查看设备使用情况、记录 BPM 和趋势；
- 舌象上传：选择图片、预览、图片质量检查和保存本次记录；
- 综合观察卡：汇总心率与舌象素材，生成状态观察和轻建议；
- 我的记录：回看历史记录和长期趋势；
- 公共设备指引：说明排队、测量和现场使用流程；
- 统一声明：仅用于健康状态观察和科普记录，不作为医学诊断依据。

# ESP32-S3 心率设备固件

录制或烧录前先复制配置文件：

```text
sketch_may27a/config.example.h -> sketch_may27a/config.h
```

然后在 `config.h` 中修改：

- `WIFI_SSID` / `WIFI_PASSWORD`
- `SERVER_BASE_URL`，例如 `http://你的电脑局域网IP:2070`
- `DEVICE_ID`，默认与后端一致为 `esp32_s3_001`

`config.h` 已加入 `.gitignore`，不会被提交。前端页面读取设备状态使用 `/api/device/status`，ESP32 才使用 `/api/device/poll` 刷新在线心跳并领取当前测量用户。

# ESP32-S3 心率设备固件

录制或烧录前先复制配置文件：

```text
sketch_may27a/config.example.h -> sketch_may27a/config.h
```

然后在 `config.h` 中修改：

- `WIFI_SSID` / `WIFI_PASSWORD`
- `SERVER_BASE_URL`，默认示例为 `http://192.168.137.1:2070`
- `DEVICE_ID`，默认与后端一致为 `esp32_s3_001`

如果电脑开启移动热点或网络共享给 ESP32，后端地址通常就是 ESP32 所在网络的默认网关，例如 Windows 常见为 `192.168.137.1`。如果 ESP32 和电脑只是连接同一个路由器，请改成电脑的局域网 IPv4 地址。

`config.h` 已加入 `.gitignore`，不会被提交。前端页面读取设备状态使用 `/api/device/status`，ESP32 才使用 `/api/device/poll` 刷新在线心跳并领取当前测量用户。

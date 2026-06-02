#pragma once

// Copy this file to config.h before flashing the ESP32-S3.
// config.h is ignored by git so local WiFi credentials stay private.

#define OLED_SDA 5
#define OLED_SCL 4
#define OLED_ADDR 0x3C
#define HEART_PIN 7

const char* WIFI_SSID = "WIN-RINO";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// If your laptop shares WiFi/hotspot for the ESP32, the backend is often on
// the gateway address. Change it if your backend runs on another LAN IP.
String SERVER_BASE_URL = "http://192.168.137.1:2070";
const char* DEVICE_ID = "esp32_s3_001";

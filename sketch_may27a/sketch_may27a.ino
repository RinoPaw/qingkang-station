#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>

// =====================
// 引脚配置
// =====================

#define OLED_SDA 5
#define OLED_SCL 4
#define OLED_ADDR 0x3C

#define HEART_PIN 7

// =====================
// 网络与服务器配置
// =====================

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

String SERVER_BASE_URL = "http://192.168.1.100:8000";
const char* DEVICE_ID = "esp32_s3_001";

const unsigned long SERVER_POLL_INTERVAL_MS = 1000;
const unsigned long HEART_UPLOAD_INTERVAL_MS = 1000;
const unsigned long NETWORK_RETRY_INTERVAL_MS = 5000;
const unsigned long MEASUREMENT_LIMIT_MS = 120000;

// =====================
// OLED 配置
// =====================

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// =====================
// 采样与滤波参数
// =====================

const int SAMPLE_INTERVAL_MS = 10;       // 100Hz
const int RAW_MIN_VALID = 30;
const int RAW_MAX_VALID = 4080;

const float DC_ALPHA = 0.02;
const float FILTER_ALPHA = 0.18;

// 用更短窗口，让“移开手指”能更快被发现
const unsigned long WINDOW_SIZE_MS = 900;

// 判断有无手指的信号幅度阈值
const float MIN_SIGNAL_AMPLITUDE = 90;

const float THRESHOLD_RATIO = 0.62;

// 刚按上去后等待稳定
const unsigned long STABLE_TIME_MS = 3000;

// 连续 raw 异常多久后认为手指移开
const unsigned long INVALID_RAW_TIMEOUT_MS = 300;

// 心跳间隔范围
const unsigned long MIN_BEAT_INTERVAL_MS = 350;
const unsigned long MAX_BEAT_INTERVAL_MS = 2000;

const int MIN_BEATS_TO_SHOW = 3;
const int BEAT_AVG_SIZE = 5;

// =====================
// 状态机
// =====================

enum MeasureState {
  STATE_WAIT_FINGER,
  STATE_HOLD_STILL,
  STATE_MEASURING
};

MeasureState state = STATE_WAIT_FINGER;

// =====================
// 全局变量
// =====================

float dcValue = 2000;
float filtered = 0;

float windowMin = 999999;
float windowMax = -999999;
float amplitude = 0;
float threshold = 0;

int validSamplesInWindow = 0;

unsigned long windowStartTime = 0;

bool aboveThreshold = false;
unsigned long lastBeatTime = 0;

unsigned long intervals[BEAT_AVG_SIZE];
int intervalIndex = 0;
int intervalCount = 0;
int bpm = 0;

int lastValidRaw = 2000;
unsigned long lastValidRawTime = 0;
unsigned long invalidRawStartTime = 0;

unsigned long fingerStartTime = 0;
int goodSignalWindows = 0;
int badSignalWindows = 0;

unsigned long lastSampleTime = 0;
unsigned long lastDisplayTime = 0;
unsigned long lastSerialTime = 0;
unsigned long lastServerPollTime = 0;
unsigned long lastHeartUploadTime = 0;
unsigned long lastNetworkRetryTime = 0;

bool hasActiveSession = false;
String activeSessionId = "";
String activeNickname = "";
unsigned long activeSessionStartedAt = 0;

int getDisplayBPM();
void forceFingerLost();

// =====================
// 工具函数
// =====================

void resetBeatData() {
  aboveThreshold = false;
  lastBeatTime = 0;
  intervalIndex = 0;
  intervalCount = 0;
  bpm = 0;
}

void forceFingerLost() {
  state = STATE_WAIT_FINGER;

  goodSignalWindows = 0;
  badSignalWindows = 0;

  resetBeatData();

  amplitude = 0;
  threshold = 0;
  filtered = 0;

  windowMin = 999999;
  windowMax = -999999;
  validSamplesInWindow = 0;
  windowStartTime = millis();
}

void clearActiveSession() {
  hasActiveSession = false;
  activeSessionId = "";
  activeNickname = "";
  activeSessionStartedAt = 0;
  forceFingerLost();
}

String escapeJson(String value) {
  value.replace("\\", "\\\\");
  value.replace("\"", "\\\"");
  return value;
}

String extractJsonString(const String& body, const String& key) {
  String pattern = "\"" + key + "\":";
  int keyIndex = body.indexOf(pattern);
  if (keyIndex < 0) return "";

  int valueIndex = keyIndex + pattern.length();
  while (valueIndex < body.length() &&
         (body[valueIndex] == ' ' || body[valueIndex] == '\n' || body[valueIndex] == '\r')) {
    valueIndex++;
  }

  if (valueIndex >= body.length()) return "";
  if (body.startsWith("null", valueIndex)) return "";

  if (body[valueIndex] == '"') {
    int start = valueIndex + 1;
    int end = body.indexOf("\"", start);
    if (end < 0) return "";
    return body.substring(start, end);
  }

  int end = body.indexOf(",", valueIndex);
  if (end < 0) end = body.indexOf("}", valueIndex);
  if (end < 0) return "";
  return body.substring(valueIndex, end);
}

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  unsigned long now = millis();
  if (now - lastNetworkRetryTime < NETWORK_RETRY_INTERVAL_MS) {
    return false;
  }

  lastNetworkRetryTime = now;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 6000) {
    delay(200);
  }

  return WiFi.status() == WL_CONNECTED;
}

const char* getApiStateText() {
  if (!hasActiveSession) {
    return "IDLE";
  }

  if (state == STATE_WAIT_FINGER) {
    return "READY";
  }

  if (state == STATE_HOLD_STILL) {
    return "HOLD_STILL";
  }

  return "MEASURING";
}

void pollServerForSession() {
  if (!connectWiFi()) {
    return;
  }

  HTTPClient http;
  String url = SERVER_BASE_URL + "/api/device/poll?device_id=" + String(DEVICE_ID);
  http.begin(url);

  int httpCode = http.GET();
  if (httpCode == 200) {
    String body = http.getString();
    String sessionId = extractJsonString(body, "session_id");
    String nickname = extractJsonString(body, "nickname");

    if (sessionId.length() > 0) {
      if (!hasActiveSession || sessionId != activeSessionId) {
        forceFingerLost();
        activeSessionStartedAt = millis();
      }

      hasActiveSession = true;
      activeSessionId = sessionId;
      activeNickname = nickname.length() > 0 ? nickname : sessionId;
    } else {
      clearActiveSession();
    }
  }

  http.end();
}

bool uploadHeartRate(int raw, int validRaw) {
  if (!hasActiveSession || !connectWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = SERVER_BASE_URL + "/api/heart-rate";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"session_id\":\"" + escapeJson(activeSessionId) + "\",";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"bpm\":" + String(getDisplayBPM()) + ",";
  payload += "\"raw\":" + String(raw) + ",";
  payload += "\"amplitude\":" + String(amplitude, 2) + ",";
  payload += "\"state\":\"" + String(getApiStateText()) + "\"";
  payload += "}";

  int httpCode = http.POST(payload);
  if (httpCode == 409 || httpCode == 404) {
    clearActiveSession();
  }

  http.end();
  return httpCode >= 200 && httpCode < 300;
}

bool releaseActiveSession(const char* finalStatus) {
  if (!hasActiveSession || !connectWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = SERVER_BASE_URL + "/api/device/release";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"session_id\":\"" + escapeJson(activeSessionId) + "\",";
  payload += "\"status\":\"" + String(finalStatus) + "\"";
  payload += "}";

  int httpCode = http.POST(payload);
  bool ok = httpCode >= 200 && httpCode < 300;
  http.end();

  if (ok) {
    clearActiveSession();
  }

  return ok;
}

void enterHoldStill(int validRaw) {
  state = STATE_HOLD_STILL;

  fingerStartTime = millis();

  dcValue = validRaw;
  filtered = 0;

  resetBeatData();

  windowMin = 999999;
  windowMax = -999999;
  validSamplesInWindow = 0;
  windowStartTime = millis();
}

unsigned long getAverageInterval() {
  if (intervalCount == 0) return 0;

  unsigned long sum = 0;
  for (int i = 0; i < intervalCount; i++) {
    sum += intervals[i];
  }

  return sum / intervalCount;
}

void addInterval(unsigned long interval) {
  if (intervalCount >= 3) {
    unsigned long avg = getAverageInterval();
    unsigned long diff = abs((long)interval - (long)avg);

    // 过滤明显离谱的跳变
    if (diff > avg * 0.45) {
      return;
    }
  }

  intervals[intervalIndex] = interval;
  intervalIndex = (intervalIndex + 1) % BEAT_AVG_SIZE;

  if (intervalCount < BEAT_AVG_SIZE) {
    intervalCount++;
  }

  unsigned long avgInterval = getAverageInterval();

  if (avgInterval > 0) {
    bpm = 60000 / avgInterval;
  }
}

bool isStableEnough() {
  return state == STATE_MEASURING;
}

int getDisplayBPM() {
  if (state == STATE_MEASURING && intervalCount >= MIN_BEATS_TO_SHOW) {
    return bpm;
  }
  return 0;
}

const char* getStatusText() {
  if (!hasActiveSession) {
    return "WAITING / IDLE";
  }

  if (state == STATE_WAIT_FINGER) {
    return "PLACE FINGER";
  }

  if (state == STATE_HOLD_STILL) {
    return "HOLD STILL";
  }

  return "MEASURING";
}

// =====================
// 心跳检测
// =====================

void detectBeat(float value) {
  if (state != STATE_MEASURING) return;
  if (amplitude < MIN_SIGNAL_AMPLITUDE) return;

  if (value > threshold && !aboveThreshold) {
    aboveThreshold = true;

    unsigned long now = millis();

    if (lastBeatTime > 0) {
      unsigned long interval = now - lastBeatTime;

      if (interval >= MIN_BEAT_INTERVAL_MS && interval <= MAX_BEAT_INTERVAL_MS) {
        addInterval(interval);
      }
    }

    lastBeatTime = now;
  }

  // 低于阈值一定距离后，允许下一次心跳检测
  if (value < threshold - amplitude * 0.20) {
    aboveThreshold = false;
  }

  // 很久没有检测到心跳，清掉 BPM，但仍保持 MEASURING
  if (lastBeatTime > 0 && millis() - lastBeatTime > 4000) {
    resetBeatData();
  }
}

// =====================
// OLED 显示
// 适配上黄下蓝 OLED，避免跨色区断层
// =====================

void updateOLED(int raw, int validRaw) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  const char* status = getStatusText();
  int showBPM = getDisplayBPM();

  // 顶部黄色区域
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("QingKang Station");
  display.setCursor(0, 8);
  if (hasActiveSession) {
    display.print(activeNickname.substring(0, 18));
  } else {
    display.print(String(DEVICE_ID).substring(0, 18));
  }

  display.drawLine(0, 15, 127, 15, SSD1306_WHITE);

  // 状态行，放到蓝色区域
  display.setTextSize(1);
  display.setCursor(0, 18);
  display.print("Status: ");
  display.println(status);

  // BPM 显示
  if (showBPM > 0) {
    display.setTextSize(3);
    display.setCursor(0, 31);
    display.print(showBPM);

    display.setTextSize(1);
    display.setCursor(76, 41);
    display.print("BPM");
  } else {
    display.setTextSize(2);
    display.setCursor(0, 34);
    display.print("-- BPM");
  }

  // 底部提示
  display.setTextSize(1);
  display.setCursor(0, 56);

  if (!hasActiveSession) {
    display.print("Waiting / Idle");
  } else if (state == STATE_WAIT_FINGER) {
    display.print("No data shown");
  } else {
    display.print("Keep finger on");
  }

  display.display();
}

// =====================
// 初始化
// =====================

void setup() {
  Serial.begin(115200);
  delay(1000);

  analogReadResolution(12);
  analogSetPinAttenuation(HEART_PIN, ADC_11db);

  int firstRaw = analogRead(HEART_PIN);
  if (firstRaw > RAW_MIN_VALID && firstRaw < RAW_MAX_VALID) {
    dcValue = firstRaw;
    lastValidRaw = firstRaw;
  }

  lastValidRawTime = millis();
  windowStartTime = millis();

  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(100000);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED init failed");
    while (true) {
      delay(1000);
    }
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("QingKang Station");
  display.drawLine(0, 15, 127, 15, SSD1306_WHITE);
  display.setCursor(0, 22);
  display.println("Waiting / Idle");
  display.setCursor(0, 38);
  display.println("Polling server...");
  display.display();

  connectWiFi();

  Serial.println("raw,validRaw,filtered,threshold,bpmPlot,statePlot,uploadState");
}

// =====================
// 主循环
// =====================

void loop() {
  unsigned long now = millis();

  if (now - lastServerPollTime >= SERVER_POLL_INTERVAL_MS) {
    lastServerPollTime = now;
    pollServerForSession();
  }

  if (!hasActiveSession) {
    if (now - lastDisplayTime >= 500) {
      lastDisplayTime = now;
      updateOLED(lastValidRaw, lastValidRaw);
    }
    return;
  }

  if (activeSessionStartedAt > 0 &&
      now - activeSessionStartedAt >= MEASUREMENT_LIMIT_MS) {
    releaseActiveSession(getDisplayBPM() > 0 ? "FINISHED" : "TIMEOUT");
    return;
  }

  if (now - lastSampleTime < SAMPLE_INTERVAL_MS) {
    return;
  }

  lastSampleTime = now;

  int raw = analogRead(HEART_PIN);
  int validRaw = lastValidRaw;

  bool rawValid = (raw > RAW_MIN_VALID && raw < RAW_MAX_VALID);

  // raw=0 或 raw 异常，可能是手指移开/扫过/接触不良
  if (!rawValid) {
    if (invalidRawStartTime == 0) {
      invalidRawStartTime = now;
    }

    if (state != STATE_WAIT_FINGER &&
        now - invalidRawStartTime >= INVALID_RAW_TIMEOUT_MS) {
      forceFingerLost();
    }
  } else {
    invalidRawStartTime = 0;

    validRaw = raw;
    lastValidRaw = raw;
    lastValidRawTime = now;

    // 去基线
    dcValue = dcValue * (1.0 - DC_ALPHA) + validRaw * DC_ALPHA;

    // AC 成分
    float ac = validRaw - dcValue;

    // 平滑滤波
    filtered = filtered * (1.0 - FILTER_ALPHA) + ac * FILTER_ALPHA;

    if (filtered < windowMin) windowMin = filtered;
    if (filtered > windowMax) windowMax = filtered;
    validSamplesInWindow++;
  }

  // 每个窗口更新一次幅度和阈值
  if (now - windowStartTime >= WINDOW_SIZE_MS) {
    if (validSamplesInWindow >= 5) {
      amplitude = windowMax - windowMin;
    } else {
      amplitude = 0;
    }

    if (amplitude > 0 && amplitude < 10000) {
      threshold = windowMin + amplitude * THRESHOLD_RATIO;
    }

    bool goodSignal = rawValid && amplitude >= MIN_SIGNAL_AMPLITUDE;

    if (goodSignal) {
      goodSignalWindows++;
      badSignalWindows = 0;

      if (state == STATE_WAIT_FINGER && goodSignalWindows >= 1) {
        enterHoldStill(validRaw);
      }
    } else {
      badSignalWindows++;
      goodSignalWindows = 0;

      // 关键：任何阶段只要检测到信号消失，就中断并清空
      if (state != STATE_WAIT_FINGER && badSignalWindows >= 1) {
        forceFingerLost();
      }
    }

    // HOLD STILL 时间够了，进入 MEASURING
    if (state == STATE_HOLD_STILL &&
        now - fingerStartTime >= STABLE_TIME_MS) {
      state = STATE_MEASURING;
      resetBeatData();
    }

    windowMin = 999999;
    windowMax = -999999;
    validSamplesInWindow = 0;
    windowStartTime = now;
  }

  // 只有 MEASURING 阶段才检测心跳
  if (state == STATE_MEASURING && rawValid) {
    detectBeat(filtered);
  }

  // 串口绘图
  if (now - lastSerialTime >= 50) {
    lastSerialTime = now;

    int showBPM = getDisplayBPM();

    float filteredPlot = filtered + 2000;
    float thresholdPlot = threshold + 2000;

    int bpmPlot = showBPM > 0 ? showBPM * 20 : 0;

    int statePlot = 0;
    if (state == STATE_HOLD_STILL) statePlot = 1200;
    if (state == STATE_MEASURING) statePlot = 2500;

    Serial.print(raw);
    Serial.print(",");
    Serial.print(validRaw);
    Serial.print(",");
    Serial.print(filteredPlot, 2);
    Serial.print(",");
    Serial.print(thresholdPlot, 2);
    Serial.print(",");
    Serial.print(bpmPlot);
    Serial.print(",");
    Serial.print(statePlot);
    Serial.print(",");
    Serial.println(getApiStateText());
  }

  if (now - lastHeartUploadTime >= HEART_UPLOAD_INTERVAL_MS) {
    lastHeartUploadTime = now;
    uploadHeartRate(raw, validRaw);
  }

  // OLED 更新
  if (now - lastDisplayTime >= 300) {
    lastDisplayTime = now;
    updateOLED(raw, validRaw);
  }
}

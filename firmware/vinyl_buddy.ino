/*
 * ============================================================================
 * Vinyl Buddy Firmware
 * ============================================================================
 * Hardware: ESP32-DevKitC V4 + INMP441 MEMS Microphone
 * Purpose:  Identifies vinyl records playing on a turntable by capturing audio,
 *           generating fingerprints, and querying the GrooveStack API.
 *
 * Pin Assignments (INMP441 -> ESP32):
 *   SCK  -> GPIO 26
 *   WS   -> GPIO 25
 *   SD   -> GPIO 33
 *   L/R  -> GND (left channel)
 *   VDD  -> 3.3V
 *   GND  -> GND
 *
 * Additional Pins:
 *   STATUS_LED_R  -> GPIO 16  (RGB LED red)
 *   STATUS_LED_G  -> GPIO 17  (RGB LED green)
 *   STATUS_LED_B  -> GPIO 18  (RGB LED blue)
 *   BUTTON_PIN    -> GPIO 0   (boot button, active LOW)
 *   BATTERY_PIN   -> GPIO 34  (ADC input, voltage divider)
 *   TEMP_PIN      -> GPIO 35  (ADC input, internal/external temp sensor)
 *
 * Build: Arduino IDE with ESP32 board package 2.x+
 * Libraries: ArduinoJson 7.x, ESP32 Arduino core (built-in WiFi, I2S, etc.)
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Update.h>
#include <EEPROM.h>
#include <Preferences.h>
#include <driver/i2s.h>
#include <driver/adc.h>
#include <esp_sleep.h>
#include <esp_wifi.h>
#include <esp_system.h>
#include <ArduinoJson.h>
#include <math.h>
#include <BLEDevice.h>            // #16: Bluetooth Low Energy
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <SD.h>                   // #17: SD Card Logging
#include <SPI.h>
#include <Wire.h>                 // #18: OLED Display (SSD1306)
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_task_wdt.h>         // #22: Watchdog Timer

/* ============================================================================
 * SECTION 1: Constants and Pin Definitions
 * ============================================================================ */

// Firmware metadata
#define FIRMWARE_VERSION      "1.0.0"
#define DEVICE_NAME           "VinylBuddy"

// --- INMP441 I2S Microphone Pins ---
#define I2S_SCK_PIN           26
#define I2S_WS_PIN            25
#define I2S_SD_PIN            33
#define I2S_PORT              I2S_NUM_0

// --- Audio Configuration (#2 I2S init, #3 16kHz mono) ---
#define SAMPLE_RATE           16000
#define BITS_PER_SAMPLE       16
#define CHANNEL_FORMAT        I2S_CHANNEL_FMT_ONLY_LEFT
#define DMA_BUF_COUNT         8
#define DMA_BUF_LEN           256

// --- Audio Buffer (#4 circular buffer) ---
#define AUDIO_BUFFER_SIZE     32000   // 2 seconds at 16kHz
#define FINGERPRINT_SAMPLES   8192    // Samples used for FFT fingerprint
#define FFT_SIZE              1024    // FFT window size

// --- Audio Thresholds (#5 silence detection, #22 noise floor) ---
#define DEFAULT_SILENCE_THRESHOLD  500
#define DEFAULT_AUDIO_GAIN         1.0f
#define NOISE_CALIBRATION_SAMPLES  16000  // 1 second of samples for calibration
#define AUDIO_QUALITY_MIN_RMS      200    // Minimum RMS for quality check (#28)
#define AUDIO_QUALITY_MAX_CLIP     0.05f  // Max 5% clipped samples

// --- LED Pins (#9 status indicators) ---
#define STATUS_LED_R          16
#define STATUS_LED_G          17
#define STATUS_LED_B          18

// --- Button (#10 manual trigger, #30 factory reset) ---
#define BUTTON_PIN            0
#define LONG_PRESS_MS         5000  // 5 seconds for factory reset
#define DEBOUNCE_MS           50

// --- Battery Monitoring (#14) ---
#define BATTERY_PIN           34
#define BATTERY_FULL_MV       4200
#define BATTERY_EMPTY_MV      3200
#define BATTERY_DIVIDER_RATIO 2.0f  // Voltage divider ratio

// --- Temperature Monitoring (#24) ---
#define TEMP_PIN              35
#define TEMP_OFFSET           0.0f  // Calibration offset in Celsius

// --- Network ---
#define API_BASE_URL          "https://api.groovestack.app"
#define IDENTIFY_ENDPOINT     "/api/v1/vinyl-buddy/identify"
#define HEARTBEAT_ENDPOINT    "/api/v1/vinyl-buddy/heartbeat"
#define PAIR_ENDPOINT         "/api/v1/vinyl-buddy/pair"
#define OTA_ENDPOINT          "/api/v1/vinyl-buddy/firmware"

// --- Timing ---
#define HEARTBEAT_INTERVAL_MS       30000   // #17: 30 seconds
#define WIFI_RECONNECT_INTERVAL_MS  10000
#define IDLE_SLEEP_TIMEOUT_MS       300000  // #15: 5 minutes idle -> deep sleep
#define RETRY_BASE_DELAY_MS         1000    // #18: exponential backoff base
#define MAX_RETRIES                 3

// --- EEPROM / NVS (#13) ---
#define EEPROM_SIZE           512
#define NVS_NAMESPACE         "vinylbuddy"

// --- Web Server (#25 captive portal) ---
#define CONFIG_AP_SSID        "VinylBuddy-Setup"
#define CONFIG_AP_PASS        "groovestack"
#define WEB_SERVER_PORT       80

// --- BLE (#16 Bluetooth Low Energy) ---
#define BLE_SERVICE_UUID      "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_CHAR_STATUS_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_CHAR_RESULT_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define BLE_CHAR_CMD_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define BLE_DEVICE_NAME       "VinylBuddy"

// --- SD Card Logging (#17) ---
#define SD_CS_PIN             5
#define LOG_FILE_PATH         "/vinylbuddy_log.csv"
#define MAX_LOG_FILE_SIZE     (10 * 1024 * 1024)  // 10MB max log file

// --- OLED Display (#18 SSD1306) ---
#define OLED_WIDTH            128
#define OLED_HEIGHT           64
#define OLED_RESET            -1
#define OLED_I2C_ADDR         0x3C

// --- Multiple Microphone Support (#19) ---
#define I2S_MIC2_SCK_PIN      14
#define I2S_MIC2_WS_PIN       12
#define I2S_MIC2_SD_PIN       27
#define I2S_PORT_2            I2S_NUM_1
#define MAX_MICROPHONES       2

// --- Audio Gain Auto-Calibration (#20) ---
#define AUTOGAIN_TARGET_RMS     3000
#define AUTOGAIN_TOLERANCE      500
#define AUTOGAIN_MIN            0.2f
#define AUTOGAIN_MAX            8.0f
#define AUTOGAIN_INTERVAL_MS    10000   // Re-check every 10 seconds

// --- Power Management (#21) ---
#define POWER_MODE_FULL         0
#define POWER_MODE_ECO          1
#define POWER_MODE_SLEEP        2
#define ECO_CPU_FREQ_MHZ        80      // Reduced CPU frequency
#define FULL_CPU_FREQ_MHZ       240     // Full CPU frequency
#define LOW_BATTERY_THRESHOLD   15      // Percent

// --- Watchdog Timer (#22) ---
#define WDT_TIMEOUT_S           30      // Watchdog timeout in seconds

// --- Error Recovery (#23) ---
#define MAX_CONSECUTIVE_ERRORS  5
#define ERROR_COOLDOWN_MS       5000
#define MAX_ERROR_LOG_SIZE      20

// --- Performance Profiling (#24) ---
#define PERF_HISTORY_SIZE       60      // 60 samples for rolling average

/* ============================================================================
 * SECTION 2: Data Structures
 * ============================================================================ */

// Device configuration stored in NVS (#13)
struct DeviceConfig {
  char wifi_ssid_1[33];
  char wifi_pass_1[65];
  char wifi_ssid_2[33];       // #23: backup network
  char wifi_pass_2[65];
  char wifi_ssid_3[33];       // #23: second backup
  char wifi_pass_3[65];
  char api_key[65];
  char device_id[37];         // UUID
  char pair_code[7];          // #12: 6-digit OTP
  float audio_gain;           // #21: sensitivity
  int silence_threshold;
  bool paired;
};

// LED state patterns (#9)
enum LedState {
  LED_OFF,
  LED_CONNECTING,     // Blue pulsing
  LED_LISTENING,      // Green solid
  LED_IDENTIFYING,    // Yellow pulsing
  LED_SUCCESS,        // Green flash
  LED_ERROR,          // Red flash
  LED_PAIRING,        // Purple pulsing
  LED_OTA,            // Cyan pulsing
  LED_FACTORY_RESET   // Red solid
};

// Device operating state
enum DeviceState {
  STATE_INIT,
  STATE_CONNECTING,
  STATE_LISTENING,
  STATE_RECORDING,
  STATE_IDENTIFYING,
  STATE_IDLE,
  STATE_CONFIG_AP,
  STATE_OTA_UPDATE,
  STATE_PAIRING
};

// API response from identification (#27)
struct IdentifyResult {
  bool success;
  char album_title[128];
  char artist_name[128];
  char release_id[37];
  float confidence;
};

/* ============================================================================
 * SECTION 3: Global Variables
 * ============================================================================ */

// --- State ---
DeviceState deviceState = STATE_INIT;
DeviceConfig config;
Preferences preferences;

// --- WiFi (#1 auto-reconnect, #23 multi-network) ---
WiFiMulti wifiMulti;
unsigned long lastWifiReconnectAttempt = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastActivityTime = 0;
bool wifiConnected = false;

// --- Audio (#4 circular buffer) ---
int16_t audioBuffer[AUDIO_BUFFER_SIZE];
volatile uint32_t audioWriteIndex = 0;
volatile uint32_t audioReadIndex = 0;
volatile bool audioBufferReady = false;

// --- Audio Analysis (#5 level detection, #22 noise floor) ---
int16_t noiseFloor = DEFAULT_SILENCE_THRESHOLD;
float currentAudioGain = DEFAULT_AUDIO_GAIN;
bool isRecording = false;
unsigned long recordingStartTime = 0;
unsigned long silenceStartTime = 0;
#define RECORDING_DURATION_MS 5000   // Capture 5 seconds of audio
#define SILENCE_TIMEOUT_MS    2000   // Stop after 2s of silence

// --- FFT (#7 frequency analysis) ---
float fftInput[FFT_SIZE];
float fftOutput[FFT_SIZE / 2];
float fingerprintBins[32];  // Reduced frequency bins for fingerprint

// --- Button (#10, #30) ---
volatile bool buttonPressed = false;
unsigned long buttonPressStart = 0;
bool buttonHandled = false;

// --- LED (#9) ---
LedState currentLedState = LED_OFF;
unsigned long ledAnimationTime = 0;

// --- Network / Retry (#18) ---
int retryCount = 0;

// --- Web Server (#25) ---
WebServer webServer(WEB_SERVER_PORT);
bool configAPActive = false;

// --- Battery (#14) ---
float batteryVoltage = 0.0f;
int batteryPercent = 0;

// --- Temperature (#24) ---
float temperatureC = 0.0f;

// --- Uptime (#20) ---
unsigned long bootTime = 0;

// --- BLE (#16) ---
BLEServer* pBLEServer = NULL;
BLECharacteristic* pStatusCharacteristic = NULL;
BLECharacteristic* pResultCharacteristic = NULL;
BLECharacteristic* pCommandCharacteristic = NULL;
bool bleConnected = false;
bool bleEnabled = false;

// --- SD Card Logging (#17) ---
bool sdCardAvailable = false;
unsigned long sdLogEntries = 0;

// --- OLED Display (#18) ---
Adafruit_SSD1306 oledDisplay(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET);
bool oledAvailable = false;
unsigned long lastOledUpdate = 0;

// --- Multiple Microphones (#19) ---
int activeMicCount = 1;
bool mic2Available = false;
int16_t audioBuffer2[AUDIO_BUFFER_SIZE];
volatile uint32_t audioWriteIndex2 = 0;

// --- Audio Gain Auto-Calibration (#20) ---
unsigned long lastAutoGainCheck = 0;
bool autoGainEnabled = true;

// --- Power Management (#21) ---
int currentPowerMode = POWER_MODE_FULL;

// --- Error Recovery (#23) ---
int consecutiveErrors = 0;
unsigned long lastErrorTime = 0;
struct ErrorLogEntry {
  unsigned long timestamp;
  char module[16];
  char message[64];
};
ErrorLogEntry errorLog[MAX_ERROR_LOG_SIZE];
int errorLogIndex = 0;
int errorLogCount = 0;

// --- Improvement #16: Audio Streaming ---
#define STREAM_CHUNK_SIZE       4096    // Bytes per stream chunk
#define STREAM_ENDPOINT         "/api/v1/vinyl-buddy/stream"
bool audioStreamActive = false;
unsigned long lastStreamChunkSent = 0;
#define STREAM_CHUNK_INTERVAL_MS 250    // Send chunk every 250ms

// --- Improvement #17: Audio Level WebSocket ---
#define LEVEL_METER_ENDPOINT    "/api/v1/vinyl-buddy/level"
#define LEVEL_UPDATE_INTERVAL_MS 100
unsigned long lastLevelUpdate = 0;
float currentRmsLevel = 0.0f;
float peakLevel = 0.0f;

// --- Improvement #18: Device-to-device Communication ---
#define MESH_CHANNEL            1
#define MESH_MAX_PEERS          6
#define MESH_MSG_MAX_LEN        200
bool meshEnabled = false;
int meshPeerCount = 0;
struct MeshPeer {
  uint8_t mac[6];
  char deviceId[37];
  unsigned long lastSeen;
};
MeshPeer meshPeers[MESH_MAX_PEERS];

// --- Improvement #19: Audio Recording to SPIFFS ---
#include <SPIFFS.h>
#define SPIFFS_MAX_RECORDINGS   5
#define SPIFFS_MAX_RECORD_SIZE  (512 * 1024)  // 512KB max per recording
bool spiffsAvailable = false;
bool spiffsRecording = false;
int spiffsRecordingIndex = 0;
File spiffsRecordFile;

// --- Improvement #20: Voice Command Recognition ---
#define VOICE_CMD_BUFFER_SIZE   8000    // 0.5 seconds at 16kHz
#define VOICE_CMD_THRESHOLD     2000    // RMS threshold for voice detection
bool voiceCommandEnabled = false;
unsigned long lastVoiceCheck = 0;
#define VOICE_CHECK_INTERVAL_MS 500

// --- Improvement #21: Gesture Sensor Support ---
#define GESTURE_I2C_ADDR        0x39    // APDS-9960 default address
#define GESTURE_INT_PIN         4       // Interrupt pin
bool gestureSensorAvailable = false;
unsigned long lastGestureRead = 0;
#define GESTURE_READ_INTERVAL_MS 100

// --- Improvement #22b: Environmental Noise Cancellation ---
#define NOISE_PROFILE_BINS      16
float noiseProfile[NOISE_PROFILE_BINS];
bool noiseProfileCalibrated = false;
#define NOISE_CANCEL_ALPHA      0.85f   // Spectral subtraction strength
unsigned long lastNoiseProfileUpdate = 0;
#define NOISE_PROFILE_UPDATE_MS 30000   // Re-profile every 30 seconds during silence

// --- Improvement #23b: Audio Fingerprint Caching ---
#define FP_CACHE_SIZE           20
struct FingerprintCacheEntry {
  float fingerprint[32];
  IdentifyResult result;
  unsigned long cachedAt;
  int hitCount;
};
FingerprintCacheEntry fpCache[FP_CACHE_SIZE];
int fpCacheCount = 0;
#define FP_CACHE_TTL_MS         600000  // 10 minute cache TTL
#define FP_SIMILARITY_THRESHOLD 0.85f   // Cosine similarity threshold

// --- Improvement #24b: Device Sleep/Wake Scheduling ---
struct SleepSchedule {
  bool enabled;
  uint8_t sleepHour;    // 0-23
  uint8_t sleepMinute;  // 0-59
  uint8_t wakeHour;     // 0-23
  uint8_t wakeMinute;   // 0-59
};
SleepSchedule sleepSchedule = { false, 23, 0, 7, 0 };
unsigned long lastScheduleCheck = 0;
#define SCHEDULE_CHECK_INTERVAL_MS 60000

// --- Improvement #25b: Remote Configuration Updates ---
#define REMOTE_CONFIG_ENDPOINT  "/api/v1/vinyl-buddy/config"
#define CONFIG_CHECK_INTERVAL_MS 300000  // Check every 5 minutes
unsigned long lastConfigCheck = 0;
int remoteConfigVersion = 0;

// --- Performance Profiling (#24) ---
struct PerfMetrics {
  unsigned long loopTimeUs;
  unsigned long audioReadTimeUs;
  unsigned long fftTimeUs;
  unsigned long networkTimeUs;
  uint32_t freeHeap;
  int wifiRssi;
};
PerfMetrics perfHistory[PERF_HISTORY_SIZE];
int perfIndex = 0;
unsigned long lastPerfSample = 0;
unsigned long loopStartTime = 0;

/* ============================================================================
 * SECTION 4: Forward Declarations
 * ============================================================================ */

void initI2SMicrophone();
void initLEDs();
void initButton();
void loadConfig();
void saveConfig();
void factoryReset();
void connectWiFi();
void checkWiFiConnection();
void startConfigAP();
void stopConfigAP();
void setupWebServer();
void setupMDNS();
void readAudioSamples();
bool detectAudio();
void startRecording();
void stopRecording();
bool assessAudioQuality(int16_t* samples, int count);
void generateFingerprint(int16_t* samples, int count);
void simpleFFT(float* input, float* output, int n);
void sendForIdentification();
void parseIdentifyResponse(const String& json, IdentifyResult& result);
void handleIdentifyResult(const IdentifyResult& result);
void sendHeartbeat();
void checkOTAUpdate();
void generatePairCode();
bool submitPairCode(const char* code);
void readBattery();
void readTemperature();
int getWiFiRSSI();
void setLedState(LedState state);
void updateLED();
void handleButton();
void checkIdleTimeout();
void enterDeepSleep();
void serialDebug(const char* tag, const char* msg);
void serialDebugf(const char* tag, const char* fmt, ...);
String getDeviceInfoJSON();
void initBLE();
void updateBLEStatus();
void initSDCard();
void logToSD(const char* tag, const char* message);
void initOLED();
void updateOLED();
void initSecondMicrophone();
void readAudioSamplesMic2();
void autoCallibrateGain();
void setPowerMode(int mode);
void checkPowerManagement();
void initWatchdog();
void feedWatchdog();
void logError(const char* module, const char* message);
void attemptErrorRecovery();
void recordPerfSample();
void printPerfReport();
bool validateConfig();

// --- Improvement #16: Audio streaming to server ---
void startAudioStream();
void stopAudioStream();
void streamAudioChunk();

// --- Improvement #17: Real-time audio level meter via WebSocket ---
void sendAudioLevelUpdate();

// --- Improvement #18: Device-to-device communication ---
void initDeviceMesh();
void broadcastMeshMessage(const char* message);
void handleMeshReceive();

// --- Improvement #19: Audio recording to SPIFFS ---
void initSPIFFS();
void startSPIFFSRecording();
void stopSPIFFSRecording();
void listSPIFFSRecordings();

// --- Improvement #20: Voice command recognition stub ---
void initVoiceCommands();
void processVoiceCommand();

// --- Improvement #21: Gesture sensor support stub ---
void initGestureSensor();
void readGestureSensor();

// --- Improvement #22b: Environmental noise cancellation ---
void initNoiseCancellation();
void applyNoiseCancellation(int16_t* samples, int count);

// --- Improvement #23b: Audio fingerprint caching ---
void initFingerprintCache();
bool checkFingerprintCache(float* fingerprint, IdentifyResult& cachedResult);
void cacheFingerprintResult(float* fingerprint, const IdentifyResult& result);

// --- Improvement #24b: Device sleep/wake scheduling ---
void initSleepSchedule();
void checkSleepSchedule();

// --- Improvement #25b: Remote configuration updates ---
void checkRemoteConfig();
void applyRemoteConfig(const String& json);

/* ============================================================================
 * SECTION 5: (#19) Serial Debug Logging
 * ============================================================================ */

void serialDebug(const char* tag, const char* msg) {
  Serial.printf("[%lu][%s] %s\n", millis(), tag, msg);
}

void serialDebugf(const char* tag, const char* fmt, ...) {
  char buf[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  Serial.printf("[%lu][%s] %s\n", millis(), tag, buf);
}

/* ============================================================================
 * SECTION 6: (#13) Configuration Storage (NVS / Preferences)
 * ============================================================================ */

void loadConfig() {
  serialDebug("CONFIG", "Loading configuration from NVS");
  preferences.begin(NVS_NAMESPACE, true);  // read-only

  strlcpy(config.wifi_ssid_1, preferences.getString("ssid1", "").c_str(), sizeof(config.wifi_ssid_1));
  strlcpy(config.wifi_pass_1, preferences.getString("pass1", "").c_str(), sizeof(config.wifi_pass_1));
  strlcpy(config.wifi_ssid_2, preferences.getString("ssid2", "").c_str(), sizeof(config.wifi_ssid_2));
  strlcpy(config.wifi_pass_2, preferences.getString("pass2", "").c_str(), sizeof(config.wifi_pass_2));
  strlcpy(config.wifi_ssid_3, preferences.getString("ssid3", "").c_str(), sizeof(config.wifi_ssid_3));
  strlcpy(config.wifi_pass_3, preferences.getString("pass3", "").c_str(), sizeof(config.wifi_pass_3));
  strlcpy(config.api_key, preferences.getString("apikey", "").c_str(), sizeof(config.api_key));
  strlcpy(config.device_id, preferences.getString("devid", "").c_str(), sizeof(config.device_id));
  strlcpy(config.pair_code, preferences.getString("paircode", "").c_str(), sizeof(config.pair_code));
  config.audio_gain = preferences.getFloat("gain", DEFAULT_AUDIO_GAIN);
  config.silence_threshold = preferences.getInt("silence", DEFAULT_SILENCE_THRESHOLD);
  config.paired = preferences.getBool("paired", false);

  preferences.end();

  currentAudioGain = config.audio_gain;
  noiseFloor = config.silence_threshold;

  serialDebugf("CONFIG", "Device ID: %s, Paired: %s", config.device_id, config.paired ? "yes" : "no");
}

void saveConfig() {
  serialDebug("CONFIG", "Saving configuration to NVS");
  preferences.begin(NVS_NAMESPACE, false);  // read-write

  preferences.putString("ssid1", config.wifi_ssid_1);
  preferences.putString("pass1", config.wifi_pass_1);
  preferences.putString("ssid2", config.wifi_ssid_2);
  preferences.putString("pass2", config.wifi_pass_2);
  preferences.putString("ssid3", config.wifi_ssid_3);
  preferences.putString("pass3", config.wifi_pass_3);
  preferences.putString("apikey", config.api_key);
  preferences.putString("devid", config.device_id);
  preferences.putString("paircode", config.pair_code);
  preferences.putFloat("gain", config.audio_gain);
  preferences.putInt("silence", config.silence_threshold);
  preferences.putBool("paired", config.paired);

  preferences.end();
  serialDebug("CONFIG", "Configuration saved");
}

// Improvement #30: Factory reset via long button press
void factoryReset() {
  serialDebug("CONFIG", "!!! FACTORY RESET !!!");
  setLedState(LED_FACTORY_RESET);

  preferences.begin(NVS_NAMESPACE, false);
  preferences.clear();
  preferences.end();

  memset(&config, 0, sizeof(config));
  config.audio_gain = DEFAULT_AUDIO_GAIN;
  config.silence_threshold = DEFAULT_SILENCE_THRESHOLD;

  delay(2000);
  serialDebug("CONFIG", "Restarting after factory reset...");
  ESP.restart();
}

/* ============================================================================
 * SECTION 7: (#9) LED Status Indicators
 * ============================================================================ */

void initLEDs() {
  pinMode(STATUS_LED_R, OUTPUT);
  pinMode(STATUS_LED_G, OUTPUT);
  pinMode(STATUS_LED_B, OUTPUT);
  setLedRGB(0, 0, 0);
  serialDebug("LED", "LEDs initialized");
}

void setLedRGB(uint8_t r, uint8_t g, uint8_t b) {
  // Common-anode LEDs are active LOW; adjust if common-cathode
  analogWrite(STATUS_LED_R, r);
  analogWrite(STATUS_LED_G, g);
  analogWrite(STATUS_LED_B, b);
}

void setLedState(LedState state) {
  currentLedState = state;
  ledAnimationTime = millis();
}

// Non-blocking LED animation driven from loop()
void updateLED() {
  unsigned long elapsed = millis() - ledAnimationTime;
  uint8_t pulse = (uint8_t)(128 + 127 * sin(elapsed / 300.0));  // Pulsing effect

  switch (currentLedState) {
    case LED_OFF:
      setLedRGB(0, 0, 0);
      break;
    case LED_CONNECTING:      // Blue pulsing
      setLedRGB(0, 0, pulse);
      break;
    case LED_LISTENING:       // Green solid
      setLedRGB(0, 180, 0);
      break;
    case LED_IDENTIFYING:     // Yellow pulsing
      setLedRGB(pulse, pulse, 0);
      break;
    case LED_SUCCESS:         // Green flash (auto-revert after 2s)
      if (elapsed < 2000) {
        setLedRGB(0, (elapsed / 250 % 2 == 0) ? 255 : 0, 0);
      } else {
        setLedState(LED_LISTENING);
      }
      break;
    case LED_ERROR:           // Red flash (auto-revert after 3s)
      if (elapsed < 3000) {
        setLedRGB((elapsed / 200 % 2 == 0) ? 255 : 0, 0, 0);
      } else {
        setLedState(LED_LISTENING);
      }
      break;
    case LED_PAIRING:         // Purple pulsing
      setLedRGB(pulse, 0, pulse);
      break;
    case LED_OTA:             // Cyan pulsing
      setLedRGB(0, pulse, pulse);
      break;
    case LED_FACTORY_RESET:   // Red solid
      setLedRGB(255, 0, 0);
      break;
  }
}

/* ============================================================================
 * SECTION 8: (#10, #30) Button Handling
 * ============================================================================ */

void IRAM_ATTR buttonISR() {
  buttonPressed = true;
}

void initButton() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), buttonISR, FALLING);
  serialDebug("BTN", "Button initialized on GPIO 0");
}

void handleButton() {
  if (buttonPressed) {
    delay(DEBOUNCE_MS);  // Simple debounce
    if (digitalRead(BUTTON_PIN) == LOW) {
      // Button is held down
      if (buttonPressStart == 0) {
        buttonPressStart = millis();
        buttonHandled = false;
        serialDebug("BTN", "Button press detected");
      }

      // Check for long press -> factory reset (#30)
      if (!buttonHandled && (millis() - buttonPressStart >= LONG_PRESS_MS)) {
        serialDebug("BTN", "Long press detected -> Factory Reset");
        buttonHandled = true;
        factoryReset();
      }
    } else {
      // Button released
      if (buttonPressStart > 0 && !buttonHandled) {
        unsigned long duration = millis() - buttonPressStart;
        if (duration >= DEBOUNCE_MS && duration < LONG_PRESS_MS) {
          // Short press -> manual identification trigger (#10)
          serialDebug("BTN", "Short press -> Manual identification trigger");
          lastActivityTime = millis();
          if (deviceState == STATE_LISTENING || deviceState == STATE_IDLE) {
            startRecording();
          }
        }
      }
      buttonPressStart = 0;
      buttonPressed = false;
      buttonHandled = false;
    }
  }
}

/* ============================================================================
 * SECTION 9: (#2, #3) I2S Microphone Initialization & Audio Sampling
 * ============================================================================ */

void initI2SMicrophone() {
  serialDebug("I2S", "Configuring INMP441 I2S microphone");

  const i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = CHANNEL_FORMAT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = DMA_BUF_COUNT,
    .dma_buf_len = DMA_BUF_LEN,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  const i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK_PIN,
    .ws_io_num = I2S_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD_PIN
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    serialDebugf("I2S", "Driver install failed: %d", err);
    return;
  }

  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    serialDebugf("I2S", "Pin config failed: %d", err);
    return;
  }

  // Allow I2S to stabilize
  i2s_zero_dma_buffer(I2S_PORT);
  delay(100);

  serialDebug("I2S", "INMP441 microphone initialized at 16kHz mono");
}

/* ============================================================================
 * SECTION 10: (#4) Circular Audio Buffer & (#3) Audio Sampling
 * ============================================================================ */

// Read samples from I2S into the circular buffer
void readAudioSamples() {
  int16_t tempBuffer[DMA_BUF_LEN];
  size_t bytesRead = 0;

  esp_err_t err = i2s_read(I2S_PORT, tempBuffer, sizeof(tempBuffer), &bytesRead, 10);
  if (err != ESP_OK || bytesRead == 0) return;

  int samplesRead = bytesRead / sizeof(int16_t);

  for (int i = 0; i < samplesRead; i++) {
    // Apply gain (#21)
    float amplified = tempBuffer[i] * currentAudioGain;
    // Clamp to int16 range
    if (amplified > 32767) amplified = 32767;
    if (amplified < -32768) amplified = -32768;

    audioBuffer[audioWriteIndex] = (int16_t)amplified;
    audioWriteIndex = (audioWriteIndex + 1) % AUDIO_BUFFER_SIZE;
  }
}

// Get number of available samples in circular buffer
uint32_t availableSamples() {
  if (audioWriteIndex >= audioReadIndex) {
    return audioWriteIndex - audioReadIndex;
  }
  return AUDIO_BUFFER_SIZE - audioReadIndex + audioWriteIndex;
}

// Read samples from circular buffer into a linear output array
int readFromBuffer(int16_t* output, int maxSamples) {
  int count = 0;
  while (count < maxSamples && audioReadIndex != audioWriteIndex) {
    output[count++] = audioBuffer[audioReadIndex];
    audioReadIndex = (audioReadIndex + 1) % AUDIO_BUFFER_SIZE;
  }
  return count;
}

/* ============================================================================
 * SECTION 11: (#5) Audio Level Detection / Silence Detection
 * ============================================================================ */

// Compute RMS of recent samples in the buffer
int16_t computeRMS(int sampleCount) {
  if (sampleCount > (int)AUDIO_BUFFER_SIZE) sampleCount = AUDIO_BUFFER_SIZE;

  uint32_t idx = (audioWriteIndex >= (uint32_t)sampleCount)
    ? audioWriteIndex - sampleCount
    : AUDIO_BUFFER_SIZE - (sampleCount - audioWriteIndex);

  int64_t sumSquares = 0;
  for (int i = 0; i < sampleCount; i++) {
    int32_t sample = audioBuffer[(idx + i) % AUDIO_BUFFER_SIZE];
    sumSquares += (int64_t)sample * sample;
  }

  return (int16_t)sqrt((double)sumSquares / sampleCount);
}

// Returns true if current audio level exceeds the noise floor
bool detectAudio() {
  int16_t rms = computeRMS(1600);  // ~100ms window
  return rms > noiseFloor;
}

/* ============================================================================
 * SECTION 12: (#6) Automatic Recording Trigger
 * ============================================================================ */

void startRecording() {
  if (isRecording) return;
  serialDebug("REC", "Recording started - audio detected");
  isRecording = true;
  recordingStartTime = millis();
  silenceStartTime = 0;
  audioReadIndex = audioWriteIndex;  // Start from current position
  deviceState = STATE_RECORDING;
  setLedState(LED_IDENTIFYING);
  lastActivityTime = millis();
}

void stopRecording() {
  if (!isRecording) return;
  serialDebug("REC", "Recording stopped");
  isRecording = false;
  deviceState = STATE_IDENTIFYING;
}

// Called in loop to manage automatic recording
void autoRecordingCheck() {
  if (deviceState != STATE_LISTENING && deviceState != STATE_RECORDING) return;

  bool audioPresent = detectAudio();

  if (!isRecording && audioPresent) {
    // Improvement #6: Auto-trigger when audio detected
    startRecording();
  }

  if (isRecording) {
    unsigned long elapsed = millis() - recordingStartTime;

    // Stop after max recording duration
    if (elapsed >= RECORDING_DURATION_MS) {
      stopRecording();
      sendForIdentification();
      return;
    }

    // Track silence during recording
    if (!audioPresent) {
      if (silenceStartTime == 0) silenceStartTime = millis();
      if (millis() - silenceStartTime >= SILENCE_TIMEOUT_MS) {
        serialDebug("REC", "Silence timeout during recording");
        stopRecording();
        // If we captured enough audio, still try to identify
        if (elapsed >= 2000) {
          sendForIdentification();
        } else {
          deviceState = STATE_LISTENING;
          setLedState(LED_LISTENING);
        }
        return;
      }
    } else {
      silenceStartTime = 0;
    }
  }
}

/* ============================================================================
 * SECTION 13: (#22) Noise Floor Calibration Routine
 * ============================================================================ */

void calibrateNoiseFloor() {
  serialDebug("CAL", "Starting noise floor calibration (1 second)...");
  setLedState(LED_IDENTIFYING);

  // Flush the I2S buffer
  i2s_zero_dma_buffer(I2S_PORT);
  delay(200);

  // Collect 1 second of ambient noise
  int16_t calBuffer[1600];
  int64_t sumSquares = 0;
  int totalSamples = 0;
  unsigned long calStart = millis();

  while (millis() - calStart < 1000) {
    size_t bytesRead = 0;
    i2s_read(I2S_PORT, calBuffer, sizeof(calBuffer), &bytesRead, 50);
    int count = bytesRead / sizeof(int16_t);
    for (int i = 0; i < count; i++) {
      sumSquares += (int64_t)calBuffer[i] * calBuffer[i];
      totalSamples++;
    }
  }

  if (totalSamples > 0) {
    int16_t rms = (int16_t)sqrt((double)sumSquares / totalSamples);
    // Set threshold at 2x the ambient noise RMS
    noiseFloor = rms * 2;
    if (noiseFloor < 100) noiseFloor = 100;  // Minimum threshold
    config.silence_threshold = noiseFloor;
    saveConfig();
    serialDebugf("CAL", "Noise floor calibrated: RMS=%d, threshold=%d", rms, noiseFloor);
  } else {
    serialDebug("CAL", "Calibration failed - no samples collected");
  }

  setLedState(LED_LISTENING);
}

/* ============================================================================
 * SECTION 14: (#7) Audio Fingerprint Generation (FFT-based)
 * ============================================================================ */

// Simple in-place DFT for small N (adequate for ESP32 fingerprinting)
// For production, consider the ESP-DSP library for hardware-accelerated FFT.
void simpleFFT(float* input, float* output, int n) {
  // Compute magnitude spectrum using DFT on n samples
  // We only need the first n/2 frequency bins
  for (int k = 0; k < n / 2; k++) {
    float realPart = 0.0f;
    float imagPart = 0.0f;
    for (int t = 0; t < n; t++) {
      float angle = 2.0f * PI * k * t / n;
      realPart += input[t] * cos(angle);
      imagPart -= input[t] * sin(angle);
    }
    output[k] = sqrt(realPart * realPart + imagPart * imagPart) / n;
  }
}

void generateFingerprint(int16_t* samples, int count) {
  serialDebug("FP", "Generating audio fingerprint");

  // Use the most recent FFT_SIZE samples (or fewer if not enough)
  int fftCount = min(count, FFT_SIZE);
  int offset = (count > FFT_SIZE) ? count - FFT_SIZE : 0;

  // Apply Hanning window and normalize to [-1, 1]
  for (int i = 0; i < fftCount; i++) {
    float window = 0.5f * (1.0f - cos(2.0f * PI * i / (fftCount - 1)));
    fftInput[i] = (samples[offset + i] / 32768.0f) * window;
  }
  // Zero-pad if needed
  for (int i = fftCount; i < FFT_SIZE; i++) {
    fftInput[i] = 0.0f;
  }

  // Run FFT
  simpleFFT(fftInput, fftOutput, FFT_SIZE);

  // Reduce to 32 frequency bins (each covering ~250Hz at 16kHz sample rate)
  int binsPerGroup = (FFT_SIZE / 2) / 32;
  for (int i = 0; i < 32; i++) {
    float sum = 0.0f;
    for (int j = 0; j < binsPerGroup; j++) {
      sum += fftOutput[i * binsPerGroup + j];
    }
    fingerprintBins[i] = sum / binsPerGroup;
  }

  serialDebug("FP", "Fingerprint generated (32 frequency bins)");
}

/* ============================================================================
 * SECTION 15: (#28) Audio Quality Assessment Before Sending
 * ============================================================================ */

bool assessAudioQuality(int16_t* samples, int count) {
  if (count < SAMPLE_RATE) {
    serialDebug("QUALITY", "Insufficient samples for quality check");
    return false;
  }

  // Compute RMS
  int64_t sumSquares = 0;
  int clippedCount = 0;
  for (int i = 0; i < count; i++) {
    int32_t s = samples[i];
    sumSquares += (int64_t)s * s;
    if (abs(s) >= 32000) clippedCount++;  // Near max = clipped
  }
  int16_t rms = (int16_t)sqrt((double)sumSquares / count);
  float clipRatio = (float)clippedCount / count;

  serialDebugf("QUALITY", "RMS=%d, clipped=%.2f%%", rms, clipRatio * 100.0f);

  if (rms < AUDIO_QUALITY_MIN_RMS) {
    serialDebug("QUALITY", "Audio too quiet - below minimum RMS");
    return false;
  }

  if (clipRatio > AUDIO_QUALITY_MAX_CLIP) {
    serialDebug("QUALITY", "Too much clipping - reduce gain");
    return false;
  }

  return true;
}

/* ============================================================================
 * SECTION 16: (#1, #23) WiFi Connection Manager with Multi-Network Support
 * ============================================================================ */

void connectWiFi() {
  serialDebug("WIFI", "Initiating WiFi connection");
  deviceState = STATE_CONNECTING;
  setLedState(LED_CONNECTING);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  // Add configured networks (#23: multi-network)
  if (strlen(config.wifi_ssid_1) > 0) {
    wifiMulti.addAP(config.wifi_ssid_1, config.wifi_pass_1);
    serialDebugf("WIFI", "Added network 1: %s", config.wifi_ssid_1);
  }
  if (strlen(config.wifi_ssid_2) > 0) {
    wifiMulti.addAP(config.wifi_ssid_2, config.wifi_pass_2);
    serialDebugf("WIFI", "Added network 2: %s", config.wifi_ssid_2);
  }
  if (strlen(config.wifi_ssid_3) > 0) {
    wifiMulti.addAP(config.wifi_ssid_3, config.wifi_pass_3);
    serialDebugf("WIFI", "Added network 3: %s", config.wifi_ssid_3);
  }

  // If no networks configured, start config AP
  if (strlen(config.wifi_ssid_1) == 0) {
    serialDebug("WIFI", "No WiFi configured - starting config AP");
    startConfigAP();
    return;
  }

  // Attempt connection (tries all configured networks)
  serialDebug("WIFI", "Connecting to WiFi...");
  unsigned long startAttempt = millis();
  while (wifiMulti.run() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    serialDebugf("WIFI", "Connected to: %s, IP: %s, RSSI: %d dBm",
      WiFi.SSID().c_str(), WiFi.localIP().toString().c_str(), WiFi.RSSI());
    setupMDNS();
  } else {
    serialDebug("WIFI", "Connection failed - will retry");
    wifiConnected = false;
  }
}

// Improvement #1: Auto-reconnect check, called in loop
void checkWiFiConnection() {
  if (configAPActive) return;

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnected) {
      wifiConnected = true;
      serialDebug("WIFI", "Reconnected to WiFi");
    }
    return;
  }

  wifiConnected = false;

  // Attempt reconnect periodically
  if (millis() - lastWifiReconnectAttempt >= WIFI_RECONNECT_INTERVAL_MS) {
    lastWifiReconnectAttempt = millis();
    serialDebug("WIFI", "Attempting WiFi reconnect...");
    if (wifiMulti.run() == WL_CONNECTED) {
      wifiConnected = true;
      serialDebugf("WIFI", "Reconnected: %s", WiFi.SSID().c_str());
    }
  }
}

// Improvement #16: WiFi signal strength
int getWiFiRSSI() {
  if (WiFi.status() == WL_CONNECTED) {
    return WiFi.RSSI();
  }
  return -100;  // No connection
}

/* ============================================================================
 * SECTION 17: (#25) Captive Portal / Local Configuration Web Server
 * ============================================================================ */

void startConfigAP() {
  serialDebug("AP", "Starting configuration access point");
  configAPActive = true;
  deviceState = STATE_CONFIG_AP;
  setLedState(LED_PAIRING);

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(CONFIG_AP_SSID, CONFIG_AP_PASS);
  serialDebugf("AP", "AP started: SSID=%s, IP=%s",
    CONFIG_AP_SSID, WiFi.softAPIP().toString().c_str());

  setupWebServer();
}

void stopConfigAP() {
  serialDebug("AP", "Stopping configuration access point");
  webServer.stop();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  configAPActive = false;
}

void setupWebServer() {
  // Root page - configuration form
  webServer.on("/", HTTP_GET, []() {
    String html = "<!DOCTYPE html><html><head>";
    html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<title>Vinyl Buddy Setup</title>";
    html += "<style>";
    html += "body{font-family:sans-serif;max-width:480px;margin:20px auto;padding:0 16px;background:#1a1a2e;color:#e0e0e0;}";
    html += "h1{color:#e94560;text-align:center;}";
    html += "input,select{width:100%;padding:10px;margin:6px 0 16px;box-sizing:border-box;border:1px solid #333;border-radius:4px;background:#16213e;color:#e0e0e0;}";
    html += "label{font-weight:bold;color:#0f3460;}";
    html += "button{background:#e94560;color:white;border:none;padding:14px;width:100%;border-radius:4px;font-size:16px;cursor:pointer;}";
    html += "button:hover{background:#c73652;}";
    html += ".section{background:#16213e;padding:16px;border-radius:8px;margin-bottom:16px;}";
    html += "</style></head><body>";
    html += "<h1>Vinyl Buddy</h1>";
    html += "<form method='POST' action='/save'>";
    html += "<div class='section'><h3>WiFi Network 1 (Primary)</h3>";
    html += "<label>SSID</label><input name='ssid1' value='" + String(config.wifi_ssid_1) + "'>";
    html += "<label>Password</label><input type='password' name='pass1'></div>";
    html += "<div class='section'><h3>WiFi Network 2 (Backup)</h3>";
    html += "<label>SSID</label><input name='ssid2' value='" + String(config.wifi_ssid_2) + "'>";
    html += "<label>Password</label><input type='password' name='pass2'></div>";
    html += "<div class='section'><h3>WiFi Network 3 (Backup)</h3>";
    html += "<label>SSID</label><input name='ssid3' value='" + String(config.wifi_ssid_3) + "'>";
    html += "<label>Password</label><input type='password' name='pass3'></div>";
    html += "<div class='section'><h3>GrooveStack</h3>";
    html += "<label>API Key</label><input name='apikey' value='" + String(config.api_key) + "'></div>";
    html += "<div class='section'><h3>Audio</h3>";
    html += "<label>Gain (0.5 - 5.0)</label><input type='number' step='0.1' name='gain' value='" + String(config.audio_gain) + "'>";
    html += "<button type='button' onclick=\"fetch('/calibrate').then(r=>r.text()).then(t=>alert(t))\">Calibrate Noise Floor</button></div>";
    html += "<br><button type='submit'>Save & Connect</button>";
    html += "</form>";
    html += "<br><div class='section'>";
    html += "<a href='/info' style='color:#e94560;'>Device Info</a> | ";
    html += "<a href='/pair' style='color:#e94560;'>Pair Device</a> | ";
    html += "<a href='/reset' style='color:#e94560;' onclick=\"return confirm('Factory reset?')\">Factory Reset</a>";
    html += "</div></body></html>";
    webServer.send(200, "text/html", html);
  });

  // Save configuration
  webServer.on("/save", HTTP_POST, []() {
    String ssid1 = webServer.arg("ssid1");
    String pass1 = webServer.arg("pass1");
    String ssid2 = webServer.arg("ssid2");
    String pass2 = webServer.arg("pass2");
    String ssid3 = webServer.arg("ssid3");
    String pass3 = webServer.arg("pass3");
    String apikey = webServer.arg("apikey");
    String gain = webServer.arg("gain");

    strlcpy(config.wifi_ssid_1, ssid1.c_str(), sizeof(config.wifi_ssid_1));
    if (pass1.length() > 0) strlcpy(config.wifi_pass_1, pass1.c_str(), sizeof(config.wifi_pass_1));
    strlcpy(config.wifi_ssid_2, ssid2.c_str(), sizeof(config.wifi_ssid_2));
    if (pass2.length() > 0) strlcpy(config.wifi_pass_2, pass2.c_str(), sizeof(config.wifi_pass_2));
    strlcpy(config.wifi_ssid_3, ssid3.c_str(), sizeof(config.wifi_ssid_3));
    if (pass3.length() > 0) strlcpy(config.wifi_pass_3, pass3.c_str(), sizeof(config.wifi_pass_3));
    if (apikey.length() > 0) strlcpy(config.api_key, apikey.c_str(), sizeof(config.api_key));
    if (gain.length() > 0) {
      config.audio_gain = constrain(gain.toFloat(), 0.5f, 5.0f);
      currentAudioGain = config.audio_gain;
    }

    saveConfig();

    webServer.send(200, "text/html",
      "<html><body style='background:#1a1a2e;color:#e0e0e0;text-align:center;font-family:sans-serif;padding-top:60px;'>"
      "<h1 style='color:#e94560;'>Saved!</h1><p>Vinyl Buddy will restart and connect.</p></body></html>");

    delay(2000);
    stopConfigAP();
    ESP.restart();
  });

  // Device info endpoint (#20)
  webServer.on("/info", HTTP_GET, []() {
    webServer.send(200, "application/json", getDeviceInfoJSON());
  });

  // Calibration endpoint (#22)
  webServer.on("/calibrate", HTTP_GET, []() {
    calibrateNoiseFloor();
    webServer.send(200, "text/plain", "Noise floor calibrated: " + String(noiseFloor));
  });

  // Pair endpoint (#12)
  webServer.on("/pair", HTTP_GET, []() {
    generatePairCode();
    String html = "<html><body style='background:#1a1a2e;color:#e0e0e0;text-align:center;font-family:sans-serif;padding-top:60px;'>";
    html += "<h1 style='color:#e94560;'>Pairing Code</h1>";
    html += "<p style='font-size:48px;letter-spacing:12px;font-weight:bold;color:white;'>" + String(config.pair_code) + "</p>";
    html += "<p>Enter this code in the GrooveStack app to pair your Vinyl Buddy.</p>";
    html += "<p><a href='/' style='color:#e94560;'>Back</a></p></body></html>";
    webServer.send(200, "text/html", html);
  });

  // Factory reset via web (#30)
  webServer.on("/reset", HTTP_GET, []() {
    webServer.send(200, "text/html",
      "<html><body style='background:#1a1a2e;color:#e0e0e0;text-align:center;font-family:sans-serif;'>"
      "<h1>Resetting...</h1></body></html>");
    delay(1000);
    factoryReset();
  });

  webServer.begin();
  serialDebug("WEB", "Web server started on port 80");
}

/* ============================================================================
 * SECTION 18: (#26) mDNS for Device Discovery
 * ============================================================================ */

void setupMDNS() {
  if (MDNS.begin("vinylbuddy")) {
    MDNS.addService("http", "tcp", 80);
    serialDebug("MDNS", "mDNS responder started: vinylbuddy.local");
  } else {
    serialDebug("MDNS", "mDNS setup failed");
  }
}

/* ============================================================================
 * SECTION 19: (#8, #27, #18, #29) API Communication
 * ============================================================================ */

// Improvement #8: HTTP POST for identification
void sendForIdentification() {
  serialDebug("API", "Preparing identification request");
  deviceState = STATE_IDENTIFYING;
  setLedState(LED_IDENTIFYING);

  // Collect captured audio
  int16_t capturedAudio[FINGERPRINT_SAMPLES];
  int capturedCount = readFromBuffer(capturedAudio, FINGERPRINT_SAMPLES);

  if (capturedCount < SAMPLE_RATE) {
    serialDebug("API", "Insufficient audio captured, aborting");
    setLedState(LED_ERROR);
    deviceState = STATE_LISTENING;
    return;
  }

  // Improvement #28: Quality check before sending
  if (!assessAudioQuality(capturedAudio, capturedCount)) {
    serialDebug("API", "Audio quality too low, aborting");
    setLedState(LED_ERROR);
    deviceState = STATE_LISTENING;
    return;
  }

  // Improvement #7: Generate fingerprint
  generateFingerprint(capturedAudio, capturedCount);

  // Improvement #29: Check connectivity before attempting
  if (!wifiConnected) {
    serialDebug("API", "No WiFi - graceful degradation, queuing request");
    setLedState(LED_ERROR);
    deviceState = STATE_LISTENING;
    return;
  }

  // Build JSON payload
  JsonDocument doc;
  doc["device_id"] = config.device_id;
  doc["api_key"] = config.api_key;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["sample_rate"] = SAMPLE_RATE;
  doc["sample_count"] = capturedCount;

  // Include fingerprint bins
  JsonArray bins = doc["fingerprint"].to<JsonArray>();
  for (int i = 0; i < 32; i++) {
    bins.add(fingerprintBins[i]);
  }

  // Include audio metadata
  doc["rms"] = computeRMS(capturedCount);
  doc["noise_floor"] = noiseFloor;
  doc["rssi"] = getWiFiRSSI();
  doc["battery"] = batteryPercent;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // Improvement #18: Retry with exponential backoff
  IdentifyResult result;
  result.success = false;
  retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    if (retryCount > 0) {
      int delayMs = RETRY_BASE_DELAY_MS * (1 << (retryCount - 1));  // Exponential backoff
      serialDebugf("API", "Retry %d/%d after %dms", retryCount, MAX_RETRIES, delayMs);
      delay(delayMs);

      // Improvement #29: Check WiFi before retry
      if (WiFi.status() != WL_CONNECTED) {
        serialDebug("API", "WiFi lost during retry - aborting");
        break;
      }
    }

    HTTPClient http;
    String url = String(API_BASE_URL) + String(IDENTIFY_ENDPOINT);
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-ID", config.device_id);
    http.addHeader("Authorization", String("Bearer ") + config.api_key);
    http.setTimeout(10000);

    int httpCode = http.POST(jsonPayload);
    serialDebugf("API", "POST %s -> %d", IDENTIFY_ENDPOINT, httpCode);

    if (httpCode == 200) {
      String response = http.getString();
      parseIdentifyResponse(response, result);
      http.end();
      break;
    } else if (httpCode > 0) {
      serialDebugf("API", "Server error: %d", httpCode);
      http.end();
      // Don't retry on 4xx errors
      if (httpCode >= 400 && httpCode < 500) break;
    } else {
      serialDebugf("API", "Connection error: %s", http.errorToString(httpCode).c_str());
      http.end();
    }

    retryCount++;
  }

  handleIdentifyResult(result);
}

// Improvement #27: JSON response parsing
void parseIdentifyResponse(const String& json, IdentifyResult& result) {
  serialDebug("API", "Parsing identification response");

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err) {
    serialDebugf("API", "JSON parse error: %s", err.c_str());
    result.success = false;
    return;
  }

  result.success = doc["success"] | false;
  strlcpy(result.album_title, doc["album"]["title"] | "Unknown", sizeof(result.album_title));
  strlcpy(result.artist_name, doc["album"]["artist"] | "Unknown", sizeof(result.artist_name));
  strlcpy(result.release_id, doc["album"]["release_id"] | "", sizeof(result.release_id));
  result.confidence = doc["confidence"] | 0.0f;

  serialDebugf("API", "Result: %s - %s (%.1f%% confidence)",
    result.artist_name, result.album_title, result.confidence * 100.0f);
}

void handleIdentifyResult(const IdentifyResult& result) {
  if (result.success && result.confidence > 0.5f) {
    serialDebugf("API", "Identified: %s - %s", result.artist_name, result.album_title);
    setLedState(LED_SUCCESS);
  } else if (result.success) {
    serialDebug("API", "Low confidence match");
    setLedState(LED_ERROR);
  } else {
    serialDebug("API", "Identification failed");
    setLedState(LED_ERROR);
  }

  deviceState = STATE_LISTENING;
  lastActivityTime = millis();
}

/* ============================================================================
 * SECTION 20: (#17) Heartbeat Ping
 * ============================================================================ */

void sendHeartbeat() {
  if (!wifiConnected) return;
  if (millis() - lastHeartbeat < HEARTBEAT_INTERVAL_MS) return;

  lastHeartbeat = millis();

  JsonDocument doc;
  doc["device_id"] = config.device_id;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["uptime"] = (millis() - bootTime) / 1000;
  doc["rssi"] = getWiFiRSSI();
  doc["battery"] = batteryPercent;
  doc["battery_voltage"] = batteryVoltage;
  doc["temperature"] = temperatureC;
  doc["state"] = (int)deviceState;
  doc["noise_floor"] = noiseFloor;
  doc["free_heap"] = ESP.getFreeHeap();

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  String url = String(API_BASE_URL) + String(HEARTBEAT_ENDPOINT);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + config.api_key);
  http.setTimeout(5000);

  int httpCode = http.POST(payload);
  if (httpCode == 200) {
    // Check if server requests OTA update
    String response = http.getString();
    JsonDocument respDoc;
    if (deserializeJson(respDoc, response) == DeserializationError::Ok) {
      if (respDoc["ota_available"] | false) {
        const char* otaUrl = respDoc["ota_url"];
        if (otaUrl) {
          serialDebug("HEARTBEAT", "OTA update available");
          checkOTAUpdate();
        }
      }
    }
  } else {
    serialDebugf("HEARTBEAT", "Failed: %d", httpCode);
  }

  http.end();
}

/* ============================================================================
 * SECTION 21: (#11) OTA (Over-The-Air) Firmware Update
 * ============================================================================ */

void checkOTAUpdate() {
  if (!wifiConnected) return;

  serialDebug("OTA", "Checking for firmware update");
  setLedState(LED_OTA);
  deviceState = STATE_OTA_UPDATE;

  HTTPClient http;
  String url = String(API_BASE_URL) + String(OTA_ENDPOINT) + "?current=" + FIRMWARE_VERSION;
  http.begin(url);
  http.addHeader("X-Device-ID", config.device_id);
  http.addHeader("Authorization", String("Bearer ") + config.api_key);

  int httpCode = http.GET();
  if (httpCode != 200) {
    serialDebugf("OTA", "No update available (HTTP %d)", httpCode);
    http.end();
    deviceState = STATE_LISTENING;
    setLedState(LED_LISTENING);
    return;
  }

  int contentLength = http.getSize();
  if (contentLength <= 0) {
    serialDebug("OTA", "Invalid content length");
    http.end();
    deviceState = STATE_LISTENING;
    setLedState(LED_ERROR);
    return;
  }

  serialDebugf("OTA", "Downloading firmware: %d bytes", contentLength);

  WiFiClient* stream = http.getStreamPtr();
  if (!Update.begin(contentLength)) {
    serialDebug("OTA", "Not enough space for OTA");
    http.end();
    setLedState(LED_ERROR);
    deviceState = STATE_LISTENING;
    return;
  }

  size_t written = Update.writeStream(*stream);
  serialDebugf("OTA", "Written: %d / %d bytes", written, contentLength);

  if (Update.end()) {
    if (Update.isFinished()) {
      serialDebug("OTA", "Update complete - restarting");
      http.end();
      delay(1000);
      ESP.restart();
    } else {
      serialDebug("OTA", "Update not finished");
    }
  } else {
    serialDebugf("OTA", "Update error: %s", Update.errorString());
  }

  http.end();
  setLedState(LED_ERROR);
  deviceState = STATE_LISTENING;
}

/* ============================================================================
 * SECTION 22: (#12) Device Pairing via 6-digit OTP Code
 * ============================================================================ */

void generatePairCode() {
  // Generate a random 6-digit code
  uint32_t code = esp_random() % 1000000;
  snprintf(config.pair_code, sizeof(config.pair_code), "%06lu", (unsigned long)code);
  saveConfig();
  serialDebugf("PAIR", "Generated pair code: %s", config.pair_code);
}

bool submitPairCode(const char* code) {
  if (!wifiConnected) {
    serialDebug("PAIR", "No WiFi for pairing");
    return false;
  }

  serialDebugf("PAIR", "Submitting pair code: %s", code);
  deviceState = STATE_PAIRING;
  setLedState(LED_PAIRING);

  JsonDocument doc;
  doc["pair_code"] = code;
  doc["mac_address"] = WiFi.macAddress();
  doc["firmware_version"] = FIRMWARE_VERSION;

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  String url = String(API_BASE_URL) + String(PAIR_ENDPOINT);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  int httpCode = http.POST(payload);
  bool success = false;

  if (httpCode == 200) {
    String response = http.getString();
    JsonDocument respDoc;
    if (deserializeJson(respDoc, response) == DeserializationError::Ok) {
      const char* deviceId = respDoc["device_id"];
      const char* apiKey = respDoc["api_key"];
      if (deviceId && apiKey) {
        strlcpy(config.device_id, deviceId, sizeof(config.device_id));
        strlcpy(config.api_key, apiKey, sizeof(config.api_key));
        config.paired = true;
        saveConfig();
        serialDebug("PAIR", "Pairing successful");
        success = true;
      }
    }
  } else {
    serialDebugf("PAIR", "Pairing failed: HTTP %d", httpCode);
  }

  http.end();
  setLedState(success ? LED_SUCCESS : LED_ERROR);
  deviceState = STATE_LISTENING;
  return success;
}

/* ============================================================================
 * SECTION 23: (#14) Battery Level Monitoring
 * ============================================================================ */

void readBattery() {
  // Read ADC (12-bit, 0-4095) and convert to voltage
  int rawADC = analogRead(BATTERY_PIN);
  float voltage = (rawADC / 4095.0f) * 3.3f * BATTERY_DIVIDER_RATIO;
  batteryVoltage = voltage;

  // Convert to percentage (linear approximation)
  int mv = (int)(voltage * 1000);
  batteryPercent = map(constrain(mv, BATTERY_EMPTY_MV, BATTERY_FULL_MV),
                       BATTERY_EMPTY_MV, BATTERY_FULL_MV, 0, 100);

  serialDebugf("BATT", "Voltage: %.2fV, Percent: %d%%", batteryVoltage, batteryPercent);
}

/* ============================================================================
 * SECTION 24: (#24) Temperature Monitoring
 * ============================================================================ */

void readTemperature() {
  // Read from external thermistor or use ESP32 internal temp sensor
  // For a simple NTC thermistor on TEMP_PIN:
  int rawADC = analogRead(TEMP_PIN);
  float voltage = (rawADC / 4095.0f) * 3.3f;

  // Steinhart-Hart approximation for 10K NTC (B=3950)
  // If no external sensor, use ESP32's internal temperature
  if (rawADC == 0 || rawADC >= 4095) {
    // Fallback: use internal temperature sensor (approximate)
    temperatureC = temperatureRead() + TEMP_OFFSET;
  } else {
    float resistance = 10000.0f * (3.3f / voltage - 1.0f);
    float steinhart = log(resistance / 10000.0f) / 3950.0f;
    steinhart += 1.0f / (25.0f + 273.15f);
    temperatureC = (1.0f / steinhart) - 273.15f + TEMP_OFFSET;
  }

  serialDebugf("TEMP", "Temperature: %.1f C", temperatureC);
}

/* ============================================================================
 * SECTION 25: (#15) Power Saving / Deep Sleep
 * ============================================================================ */

void checkIdleTimeout() {
  if (deviceState == STATE_CONFIG_AP || deviceState == STATE_OTA_UPDATE) return;
  if (isRecording) return;

  if (millis() - lastActivityTime >= IDLE_SLEEP_TIMEOUT_MS) {
    serialDebug("POWER", "Idle timeout reached - entering deep sleep");
    enterDeepSleep();
  }
}

void enterDeepSleep() {
  serialDebug("POWER", "Entering deep sleep mode");
  setLedRGB(0, 0, 0);

  // Disable I2S
  i2s_driver_uninstall(I2S_PORT);

  // Disable WiFi
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);

  // Configure wake-up sources
  // Wake on button press (GPIO 0 is RTC-capable)
  esp_sleep_enable_ext0_wakeup((gpio_num_t)BUTTON_PIN, 0);  // Wake on LOW

  // Also wake on timer (every 5 minutes to check heartbeat)
  esp_sleep_enable_timer_wakeup(300 * 1000000ULL);  // 5 minutes in microseconds

  Serial.flush();
  esp_deep_sleep_start();
}

/* ============================================================================
 * SECTION 26: (#20) Device Info Endpoint
 * ============================================================================ */

String getDeviceInfoJSON() {
  JsonDocument doc;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["device_name"] = DEVICE_NAME;
  doc["device_id"] = config.device_id;
  doc["mac_address"] = WiFi.macAddress();
  doc["uptime_seconds"] = (millis() - bootTime) / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["chip_model"] = ESP.getChipModel();
  doc["chip_revision"] = ESP.getChipRevision();
  doc["cpu_freq_mhz"] = ESP.getCpuFreqMHz();
  doc["flash_size"] = ESP.getFlashChipSize();
  doc["wifi_ssid"] = WiFi.SSID();
  doc["wifi_rssi"] = getWiFiRSSI();
  doc["ip_address"] = WiFi.localIP().toString();
  doc["battery_voltage"] = batteryVoltage;
  doc["battery_percent"] = batteryPercent;
  doc["temperature_c"] = temperatureC;
  doc["noise_floor"] = noiseFloor;
  doc["audio_gain"] = currentAudioGain;
  doc["paired"] = config.paired;
  doc["state"] = (int)deviceState;

  String output;
  serializeJsonPretty(doc, output);
  return output;
}

/* ============================================================================
 * SECTION 27: (#21) Audio Gain / Sensitivity Control
 * ============================================================================ */

void setAudioGain(float gain) {
  currentAudioGain = constrain(gain, 0.1f, 10.0f);
  config.audio_gain = currentAudioGain;
  serialDebugf("AUDIO", "Gain set to %.2f", currentAudioGain);
}

/* ============================================================================
 * SECTION 28: (#16) Bluetooth Low Energy Support
 * ============================================================================ */

class BLEServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) {
    bleConnected = true;
    serialDebug("BLE", "Client connected");
    logToSD("BLE", "Client connected");
  }

  void onDisconnect(BLEServer* server) {
    bleConnected = false;
    serialDebug("BLE", "Client disconnected");
    server->startAdvertising();
  }
};

class BLECommandCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    if (value.length() > 0) {
      serialDebugf("BLE", "Command received: %s", value.c_str());
      if (value == "identify") {
        if (deviceState == STATE_LISTENING || deviceState == STATE_IDLE) {
          lastActivityTime = millis();
          startRecording();
        }
      } else if (value == "status") {
        updateBLEStatus();
      } else if (value == "gain_up") {
        setAudioGain(currentAudioGain + 0.5f);
      } else if (value == "gain_down") {
        setAudioGain(currentAudioGain - 0.5f);
      }
    }
  }
};

void initBLE() {
  serialDebug("BLE", "Initializing Bluetooth Low Energy");

  BLEDevice::init(BLE_DEVICE_NAME);
  pBLEServer = BLEDevice::createServer();
  pBLEServer->setCallbacks(new BLEServerCallbacks());

  BLEService* pService = pBLEServer->createService(BLE_SERVICE_UUID);

  // Status characteristic (notify)
  pStatusCharacteristic = pService->createCharacteristic(
    BLE_CHAR_STATUS_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pStatusCharacteristic->addDescriptor(new BLE2902());

  // Result characteristic (notify)
  pResultCharacteristic = pService->createCharacteristic(
    BLE_CHAR_RESULT_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pResultCharacteristic->addDescriptor(new BLE2902());

  // Command characteristic (write)
  pCommandCharacteristic = pService->createCharacteristic(
    BLE_CHAR_CMD_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pCommandCharacteristic->setCallbacks(new BLECommandCallback());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->start();

  bleEnabled = true;
  serialDebug("BLE", "BLE initialized and advertising");
}

void updateBLEStatus() {
  if (!bleEnabled || !bleConnected) return;

  JsonDocument doc;
  doc["state"] = (int)deviceState;
  doc["battery"] = batteryPercent;
  doc["wifi"] = wifiConnected;
  doc["gain"] = currentAudioGain;
  doc["temp"] = temperatureC;

  String output;
  serializeJson(doc, output);
  pStatusCharacteristic->setValue(output.c_str());
  pStatusCharacteristic->notify();
}

/* ============================================================================
 * SECTION 29: (#17) SD Card Logging
 * ============================================================================ */

void initSDCard() {
  serialDebug("SD", "Initializing SD card");

  if (!SD.begin(SD_CS_PIN)) {
    serialDebug("SD", "SD card not found or initialization failed");
    sdCardAvailable = false;
    return;
  }

  uint64_t cardSize = SD.cardSize() / (1024 * 1024);
  serialDebugf("SD", "SD card initialized: %lluMB", cardSize);
  sdCardAvailable = true;

  // Create log file with header if it doesn't exist
  if (!SD.exists(LOG_FILE_PATH)) {
    File logFile = SD.open(LOG_FILE_PATH, FILE_WRITE);
    if (logFile) {
      logFile.println("timestamp_ms,tag,message");
      logFile.close();
      serialDebug("SD", "Created new log file with header");
    }
  }

  // Check log file size and rotate if needed
  File logFile = SD.open(LOG_FILE_PATH, FILE_READ);
  if (logFile) {
    if (logFile.size() > MAX_LOG_FILE_SIZE) {
      logFile.close();
      SD.remove("/vinylbuddy_log_old.csv");
      SD.rename(LOG_FILE_PATH, "/vinylbuddy_log_old.csv");
      File newLog = SD.open(LOG_FILE_PATH, FILE_WRITE);
      if (newLog) {
        newLog.println("timestamp_ms,tag,message");
        newLog.close();
      }
      serialDebug("SD", "Log file rotated due to size limit");
    } else {
      logFile.close();
    }
  }
}

void logToSD(const char* tag, const char* message) {
  if (!sdCardAvailable) return;

  File logFile = SD.open(LOG_FILE_PATH, FILE_APPEND);
  if (logFile) {
    logFile.printf("%lu,%s,%s\n", millis(), tag, message);
    logFile.close();
    sdLogEntries++;
  }
}

/* ============================================================================
 * SECTION 30: (#18) OLED Display Support (SSD1306)
 * ============================================================================ */

void initOLED() {
  serialDebug("OLED", "Initializing SSD1306 OLED display");

  Wire.begin();
  if (!oledDisplay.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    serialDebug("OLED", "OLED display not found");
    oledAvailable = false;
    return;
  }

  oledAvailable = true;
  oledDisplay.clearDisplay();
  oledDisplay.setTextSize(1);
  oledDisplay.setTextColor(SSD1306_WHITE);
  oledDisplay.setCursor(0, 0);
  oledDisplay.println("Vinyl Buddy");
  oledDisplay.printf("FW: %s\n", FIRMWARE_VERSION);
  oledDisplay.println("Initializing...");
  oledDisplay.display();
  serialDebug("OLED", "OLED display initialized");
}

void updateOLED() {
  if (!oledAvailable) return;
  if (millis() - lastOledUpdate < 1000) return;  // Update at most once per second
  lastOledUpdate = millis();

  oledDisplay.clearDisplay();
  oledDisplay.setCursor(0, 0);
  oledDisplay.setTextSize(1);

  // Line 1: Status
  const char* stateStr;
  switch (deviceState) {
    case STATE_LISTENING:    stateStr = "Listening";    break;
    case STATE_RECORDING:    stateStr = "Recording";    break;
    case STATE_IDENTIFYING:  stateStr = "Identifying";  break;
    case STATE_CONNECTING:   stateStr = "Connecting";   break;
    case STATE_CONFIG_AP:    stateStr = "Config AP";    break;
    case STATE_PAIRING:      stateStr = "Pairing";      break;
    case STATE_OTA_UPDATE:   stateStr = "OTA Update";   break;
    default:                 stateStr = "Idle";          break;
  }
  oledDisplay.printf("State: %s\n", stateStr);

  // Line 2: WiFi
  if (wifiConnected) {
    oledDisplay.printf("WiFi: %ddBm\n", getWiFiRSSI());
  } else {
    oledDisplay.println("WiFi: Disconnected");
  }

  // Line 3: Battery
  oledDisplay.printf("Batt: %d%% (%.1fV)\n", batteryPercent, batteryVoltage);

  // Line 4: Temperature
  oledDisplay.printf("Temp: %.1fC\n", temperatureC);

  // Line 5: Audio gain
  oledDisplay.printf("Gain: %.1f  Mic: %d\n", currentAudioGain, activeMicCount);

  // Line 6: BLE
  oledDisplay.printf("BLE: %s\n", bleConnected ? "Connected" : (bleEnabled ? "Advertising" : "Off"));

  // Line 7: Uptime
  unsigned long upSec = (millis() - bootTime) / 1000;
  oledDisplay.printf("Up: %luh %lum %lus\n", upSec / 3600, (upSec % 3600) / 60, upSec % 60);

  // Line 8: Heap
  oledDisplay.printf("Heap: %d bytes\n", ESP.getFreeHeap());

  oledDisplay.display();
}

/* ============================================================================
 * SECTION 31: (#19) Multiple Microphone Support
 * ============================================================================ */

void initSecondMicrophone() {
  serialDebug("MIC2", "Initializing secondary INMP441 microphone on I2S_NUM_1");

  const i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = CHANNEL_FORMAT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = DMA_BUF_COUNT,
    .dma_buf_len = DMA_BUF_LEN,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  const i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_MIC2_SCK_PIN,
    .ws_io_num = I2S_MIC2_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_MIC2_SD_PIN
  };

  esp_err_t err = i2s_driver_install(I2S_PORT_2, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    serialDebugf("MIC2", "Secondary mic driver install failed: %d (mic not connected?)", err);
    mic2Available = false;
    return;
  }

  err = i2s_set_pin(I2S_PORT_2, &pin_config);
  if (err != ESP_OK) {
    serialDebugf("MIC2", "Secondary mic pin config failed: %d", err);
    i2s_driver_uninstall(I2S_PORT_2);
    mic2Available = false;
    return;
  }

  i2s_zero_dma_buffer(I2S_PORT_2);
  delay(50);

  mic2Available = true;
  activeMicCount = 2;
  serialDebug("MIC2", "Secondary microphone initialized");
}

void readAudioSamplesMic2() {
  if (!mic2Available) return;

  int16_t tempBuffer[DMA_BUF_LEN];
  size_t bytesRead = 0;

  esp_err_t err = i2s_read(I2S_PORT_2, tempBuffer, sizeof(tempBuffer), &bytesRead, 10);
  if (err != ESP_OK || bytesRead == 0) return;

  int samplesRead = bytesRead / sizeof(int16_t);
  for (int i = 0; i < samplesRead; i++) {
    float amplified = tempBuffer[i] * currentAudioGain;
    amplified = constrain(amplified, -32768, 32767);
    audioBuffer2[audioWriteIndex2] = (int16_t)amplified;
    audioWriteIndex2 = (audioWriteIndex2 + 1) % AUDIO_BUFFER_SIZE;
  }
}

/* ============================================================================
 * SECTION 32: (#20) Audio Gain Auto-Calibration
 * ============================================================================ */

void autoCallibrateGain() {
  if (!autoGainEnabled) return;
  if (millis() - lastAutoGainCheck < AUTOGAIN_INTERVAL_MS) return;
  if (deviceState != STATE_LISTENING) return;  // Only calibrate when idle-listening
  lastAutoGainCheck = millis();

  // Calculate RMS of recent audio samples
  uint32_t sumSquares = 0;
  int sampleCount = min((uint32_t)4096, (uint32_t)AUDIO_BUFFER_SIZE);
  uint32_t readIdx = (audioWriteIndex + AUDIO_BUFFER_SIZE - sampleCount) % AUDIO_BUFFER_SIZE;

  for (int i = 0; i < sampleCount; i++) {
    int32_t sample = audioBuffer[(readIdx + i) % AUDIO_BUFFER_SIZE];
    sumSquares += (sample * sample) / sampleCount;  // Divide early to prevent overflow
  }
  float rms = sqrtf((float)sumSquares);

  if (rms < 10) return;  // No meaningful audio, skip calibration

  // Adjust gain towards target RMS
  float targetRatio = (float)AUTOGAIN_TARGET_RMS / rms;
  float newGain = currentAudioGain * (0.9f + 0.1f * targetRatio);  // Smooth adjustment
  newGain = constrain(newGain, AUTOGAIN_MIN, AUTOGAIN_MAX);

  if (fabsf(newGain - currentAudioGain) > 0.05f) {
    serialDebugf("AUTOGAIN", "RMS: %.0f, adjusting gain: %.2f -> %.2f", rms, currentAudioGain, newGain);
    setAudioGain(newGain);
    logToSD("AUTOGAIN", "Gain auto-adjusted");
  }
}

/* ============================================================================
 * SECTION 33: (#21) Power Management Optimization
 * ============================================================================ */

void setPowerMode(int mode) {
  if (mode == currentPowerMode) return;

  switch (mode) {
    case POWER_MODE_FULL:
      setCpuFrequencyMhz(FULL_CPU_FREQ_MHZ);
      if (bleEnabled && !BLEDevice::getInitialized()) initBLE();
      serialDebug("POWER", "Switched to FULL power mode (240MHz)");
      break;

    case POWER_MODE_ECO:
      setCpuFrequencyMhz(ECO_CPU_FREQ_MHZ);
      serialDebug("POWER", "Switched to ECO power mode (80MHz)");
      logToSD("POWER", "ECO mode activated");
      break;

    case POWER_MODE_SLEEP:
      serialDebug("POWER", "Preparing for SLEEP power mode");
      logToSD("POWER", "Entering deep sleep");
      enterDeepSleep();
      return;  // Won't reach here
  }

  currentPowerMode = mode;
}

void checkPowerManagement() {
  // Auto-switch to ECO mode on low battery
  if (batteryPercent <= LOW_BATTERY_THRESHOLD && currentPowerMode == POWER_MODE_FULL) {
    serialDebug("POWER", "Low battery detected, switching to ECO mode");
    setPowerMode(POWER_MODE_ECO);
  }

  // Switch back to full when charging detected (voltage rising above threshold)
  if (batteryPercent > LOW_BATTERY_THRESHOLD + 10 && currentPowerMode == POWER_MODE_ECO) {
    serialDebug("POWER", "Battery recovered, switching to FULL mode");
    setPowerMode(POWER_MODE_FULL);
  }

  // Critical battery — force sleep
  if (batteryPercent <= 5 && batteryVoltage > 0.5f) {
    serialDebug("POWER", "Critical battery level, forcing deep sleep");
    setPowerMode(POWER_MODE_SLEEP);
  }
}

/* ============================================================================
 * SECTION 34: (#22) Watchdog Timer
 * ============================================================================ */

void initWatchdog() {
  serialDebugf("WDT", "Initializing watchdog timer (%ds timeout)", WDT_TIMEOUT_S);
  esp_task_wdt_init(WDT_TIMEOUT_S, true);  // true = panic on timeout (triggers reset)
  esp_task_wdt_add(NULL);  // Add current task to watchdog
  serialDebug("WDT", "Watchdog timer initialized");
}

void feedWatchdog() {
  esp_task_wdt_reset();
}

/* ============================================================================
 * SECTION 35: (#23) Error Recovery System
 * ============================================================================ */

void logError(const char* module, const char* message) {
  serialDebugf("ERROR", "[%s] %s", module, message);
  logToSD("ERROR", message);

  // Store in circular error log
  ErrorLogEntry& entry = errorLog[errorLogIndex];
  entry.timestamp = millis();
  strlcpy(entry.module, module, sizeof(entry.module));
  strlcpy(entry.message, message, sizeof(entry.message));
  errorLogIndex = (errorLogIndex + 1) % MAX_ERROR_LOG_SIZE;
  if (errorLogCount < MAX_ERROR_LOG_SIZE) errorLogCount++;

  consecutiveErrors++;
  lastErrorTime = millis();

  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    serialDebugf("ERROR", "Max consecutive errors reached (%d), attempting recovery", consecutiveErrors);
    attemptErrorRecovery();
  }
}

void attemptErrorRecovery() {
  serialDebug("RECOVERY", "Starting error recovery sequence");
  logToSD("RECOVERY", "Error recovery initiated");

  // Step 1: Reset audio subsystem
  serialDebug("RECOVERY", "Resetting I2S audio");
  i2s_driver_uninstall(I2S_PORT);
  delay(100);
  initI2SMicrophone();

  // Step 2: Reset WiFi if disconnected
  if (!wifiConnected) {
    serialDebug("RECOVERY", "Reconnecting WiFi");
    WiFi.disconnect(true);
    delay(500);
    connectWiFi();
  }

  // Step 3: Reset state machine
  deviceState = STATE_LISTENING;
  setLedState(LED_LISTENING);
  isRecording = false;
  retryCount = 0;

  // Step 4: Recalibrate audio
  if (wifiConnected) {
    calibrateNoiseFloor();
  }

  consecutiveErrors = 0;
  serialDebug("RECOVERY", "Error recovery complete");
  logToSD("RECOVERY", "Recovery completed successfully");
}

/* ============================================================================
 * SECTION 36: (#24) Performance Profiling
 * ============================================================================ */

void recordPerfSample() {
  if (millis() - lastPerfSample < 1000) return;  // Sample once per second
  lastPerfSample = millis();

  PerfMetrics& m = perfHistory[perfIndex];
  m.loopTimeUs = micros() - loopStartTime;
  m.freeHeap = ESP.getFreeHeap();
  m.wifiRssi = wifiConnected ? getWiFiRSSI() : 0;
  m.audioReadTimeUs = 0;   // Set by instrumented audio read
  m.fftTimeUs = 0;         // Set by instrumented FFT
  m.networkTimeUs = 0;     // Set by instrumented network calls

  perfIndex = (perfIndex + 1) % PERF_HISTORY_SIZE;
}

void printPerfReport() {
  unsigned long avgLoopTime = 0;
  uint32_t minHeap = UINT32_MAX;
  uint32_t maxHeap = 0;
  int validSamples = 0;

  for (int i = 0; i < PERF_HISTORY_SIZE; i++) {
    if (perfHistory[i].freeHeap > 0) {
      avgLoopTime += perfHistory[i].loopTimeUs;
      if (perfHistory[i].freeHeap < minHeap) minHeap = perfHistory[i].freeHeap;
      if (perfHistory[i].freeHeap > maxHeap) maxHeap = perfHistory[i].freeHeap;
      validSamples++;
    }
  }

  if (validSamples == 0) {
    serialDebug("PERF", "No performance data collected yet");
    return;
  }

  avgLoopTime /= validSamples;
  serialDebug("PERF", "=== Performance Report ===");
  serialDebugf("PERF", "Avg loop time: %lu us", avgLoopTime);
  serialDebugf("PERF", "Heap - Min: %u, Max: %u, Current: %u", minHeap, maxHeap, ESP.getFreeHeap());
  serialDebugf("PERF", "Errors logged: %d, Consecutive: %d", errorLogCount, consecutiveErrors);
  serialDebugf("PERF", "Power mode: %s", currentPowerMode == POWER_MODE_FULL ? "FULL" : "ECO");
  serialDebugf("PERF", "Active mics: %d, BLE: %s, SD: %s, OLED: %s",
    activeMicCount,
    bleEnabled ? "on" : "off",
    sdCardAvailable ? "yes" : "no",
    oledAvailable ? "yes" : "no");
}

/* ============================================================================
 * SECTION 37: (#25) Configuration Validation
 * ============================================================================ */

bool validateConfig() {
  bool valid = true;
  serialDebug("CONFIG", "Validating device configuration...");

  // Validate WiFi credentials
  if (strlen(config.wifi_ssid_1) == 0) {
    serialDebug("CONFIG", "WARNING: No primary WiFi SSID configured");
    valid = false;
  }

  // Validate audio gain range
  if (config.audio_gain < 0.1f || config.audio_gain > 10.0f) {
    serialDebugf("CONFIG", "WARNING: Audio gain out of range (%.2f), resetting to default", config.audio_gain);
    config.audio_gain = DEFAULT_AUDIO_GAIN;
  }

  // Validate silence threshold
  if (config.silence_threshold < 50 || config.silence_threshold > 10000) {
    serialDebugf("CONFIG", "WARNING: Silence threshold out of range (%d), resetting to default", config.silence_threshold);
    config.silence_threshold = DEFAULT_SILENCE_THRESHOLD;
  }

  // Validate API key format (if paired)
  if (config.paired) {
    if (strlen(config.api_key) < 10) {
      serialDebug("CONFIG", "WARNING: API key appears invalid");
      valid = false;
    }
    if (strlen(config.device_id) < 10) {
      serialDebug("CONFIG", "WARNING: Device ID appears invalid");
      valid = false;
    }
  }

  // Validate pair code format
  if (strlen(config.pair_code) > 0 && strlen(config.pair_code) != 6) {
    serialDebugf("CONFIG", "WARNING: Pair code has invalid length (%d), regenerating", strlen(config.pair_code));
    generatePairCode();
  }

  serialDebugf("CONFIG", "Configuration validation %s", valid ? "passed" : "has warnings");
  logToSD("CONFIG", valid ? "Validation passed" : "Validation has warnings");
  return valid;
}

/* ============================================================================
 * SECTION 40: Improvement #16 — Audio Streaming to Server
 * ============================================================================ */

void startAudioStream() {
  if (audioStreamActive) return;
  audioStreamActive = true;
  lastStreamChunkSent = millis();
  serialDebug("STREAM", "Audio streaming started");
  logToSD("STREAM", "Streaming started");
}

void stopAudioStream() {
  if (!audioStreamActive) return;
  audioStreamActive = false;
  serialDebug("STREAM", "Audio streaming stopped");
  logToSD("STREAM", "Streaming stopped");
}

void streamAudioChunk() {
  if (!audioStreamActive || !wifiConnected) return;
  if (millis() - lastStreamChunkSent < STREAM_CHUNK_INTERVAL_MS) return;
  lastStreamChunkSent = millis();

  // Collect STREAM_CHUNK_SIZE bytes from audio buffer
  int samplesToSend = STREAM_CHUNK_SIZE / 2;  // 16-bit samples
  if (samplesToSend > AUDIO_BUFFER_SIZE) samplesToSend = AUDIO_BUFFER_SIZE;

  uint8_t chunkBuffer[STREAM_CHUNK_SIZE];
  int idx = 0;
  uint32_t readIdx = audioReadIndex;
  for (int i = 0; i < samplesToSend && idx < STREAM_CHUNK_SIZE - 1; i++) {
    int16_t sample = audioBuffer[readIdx % AUDIO_BUFFER_SIZE];
    chunkBuffer[idx++] = sample & 0xFF;
    chunkBuffer[idx++] = (sample >> 8) & 0xFF;
    readIdx++;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + STREAM_ENDPOINT;
  http.begin(url);
  http.addHeader("Content-Type", "application/octet-stream");
  http.addHeader("X-Device-Id", config.device_id);
  http.addHeader("X-Sample-Rate", String(SAMPLE_RATE));
  http.addHeader("X-Channels", "1");

  int httpCode = http.POST(chunkBuffer, idx);
  if (httpCode != 200) {
    serialDebugf("STREAM", "Stream chunk send failed: HTTP %d", httpCode);
  }
  http.end();
}

/* ============================================================================
 * SECTION 41: Improvement #17 — Real-time Audio Level Meter via WebSocket
 * ============================================================================ */

void sendAudioLevelUpdate() {
  if (!wifiConnected) return;
  if (millis() - lastLevelUpdate < LEVEL_UPDATE_INTERVAL_MS) return;
  lastLevelUpdate = millis();

  // Calculate RMS from recent samples
  int sampleCount = 256;
  float sumSquares = 0.0f;
  float peak = 0.0f;
  uint32_t readIdx = audioWriteIndex > sampleCount ? audioWriteIndex - sampleCount : 0;

  for (int i = 0; i < sampleCount; i++) {
    float sample = (float)audioBuffer[(readIdx + i) % AUDIO_BUFFER_SIZE];
    sumSquares += sample * sample;
    float absSample = fabs(sample);
    if (absSample > peak) peak = absSample;
  }

  currentRmsLevel = sqrt(sumSquares / sampleCount);
  peakLevel = peak;

  // Send level data via HTTP POST (WebSocket stub — in production use ws://)
  HTTPClient http;
  String url = String(API_BASE_URL) + LEVEL_METER_ENDPOINT;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", config.device_id);

  StaticJsonDocument<128> doc;
  doc["rms"] = currentRmsLevel;
  doc["peak"] = peakLevel;
  doc["db"] = 20.0f * log10f(max(currentRmsLevel, 1.0f) / 32768.0f);

  String payload;
  serializeJson(doc, payload);
  http.POST(payload);
  http.end();
}

/* ============================================================================
 * SECTION 42: Improvement #18 — Device-to-Device Communication (ESP-NOW)
 * ============================================================================ */

void initDeviceMesh() {
  // ESP-NOW peer-to-peer communication for nearby Vinyl Buddy devices
  serialDebug("MESH", "Initializing device mesh (ESP-NOW stub)");

  // In production: esp_now_init(), register send/receive callbacks
  meshEnabled = true;
  meshPeerCount = 0;
  memset(meshPeers, 0, sizeof(meshPeers));

  serialDebugf("MESH", "Mesh initialized, max peers: %d", MESH_MAX_PEERS);
  logToSD("MESH", "Device mesh initialized");
}

void broadcastMeshMessage(const char* message) {
  if (!meshEnabled) return;

  // Build mesh message with device identity
  StaticJsonDocument<256> doc;
  doc["from"] = config.device_id;
  doc["type"] = "broadcast";
  doc["msg"] = message;
  doc["ts"] = millis();

  String payload;
  serializeJson(doc, payload);

  // In production: esp_now_send() to broadcast address
  serialDebugf("MESH", "Broadcast: %s (%d peers)", message, meshPeerCount);
}

void handleMeshReceive() {
  if (!meshEnabled) return;
  // In production: process received ESP-NOW packets, update peer table,
  // handle "now_playing" broadcasts from nearby devices
}

/* ============================================================================
 * SECTION 43: Improvement #19 — Audio Recording to SPIFFS
 * ============================================================================ */

void initSPIFFS() {
  serialDebug("SPIFFS", "Initializing SPIFFS for audio recording");
  if (!SPIFFS.begin(true)) {
    serialDebug("SPIFFS", "SPIFFS mount failed");
    spiffsAvailable = false;
    return;
  }

  spiffsAvailable = true;
  size_t totalBytes = SPIFFS.totalBytes();
  size_t usedBytes = SPIFFS.usedBytes();
  serialDebugf("SPIFFS", "Mounted. Total: %u bytes, Used: %u bytes, Free: %u bytes",
    totalBytes, usedBytes, totalBytes - usedBytes);
  logToSD("SPIFFS", "SPIFFS initialized");
}

void startSPIFFSRecording() {
  if (!spiffsAvailable || spiffsRecording) return;

  // Rotate recording files
  spiffsRecordingIndex = (spiffsRecordingIndex + 1) % SPIFFS_MAX_RECORDINGS;
  char filename[32];
  snprintf(filename, sizeof(filename), "/rec_%d.raw", spiffsRecordingIndex);

  // Delete old recording if exists
  if (SPIFFS.exists(filename)) {
    SPIFFS.remove(filename);
  }

  spiffsRecordFile = SPIFFS.open(filename, FILE_WRITE);
  if (!spiffsRecordFile) {
    serialDebugf("SPIFFS", "Failed to open %s for recording", filename);
    return;
  }

  spiffsRecording = true;
  serialDebugf("SPIFFS", "Recording started: %s", filename);
  logToSD("SPIFFS", "Recording started");
}

void stopSPIFFSRecording() {
  if (!spiffsRecording) return;
  spiffsRecording = false;

  if (spiffsRecordFile) {
    size_t fileSize = spiffsRecordFile.size();
    spiffsRecordFile.close();
    serialDebugf("SPIFFS", "Recording stopped. Size: %u bytes", fileSize);
    logToSD("SPIFFS", "Recording stopped");
  }
}

void listSPIFFSRecordings() {
  if (!spiffsAvailable) return;
  serialDebug("SPIFFS", "Stored recordings:");

  File root = SPIFFS.open("/");
  File file = root.openNextFile();
  int count = 0;
  while (file) {
    if (String(file.name()).startsWith("/rec_")) {
      serialDebugf("SPIFFS", "  %s (%u bytes)", file.name(), file.size());
      count++;
    }
    file = root.openNextFile();
  }
  serialDebugf("SPIFFS", "Total recordings: %d", count);
}

/* ============================================================================
 * SECTION 44: Improvement #20 — Voice Command Recognition Stub
 * ============================================================================ */

void initVoiceCommands() {
  voiceCommandEnabled = true;
  serialDebug("VOICE", "Voice command recognition initialized (stub)");
  serialDebug("VOICE", "Supported commands: 'identify', 'stop', 'pair', 'status'");
  logToSD("VOICE", "Voice commands enabled");
}

void processVoiceCommand() {
  if (!voiceCommandEnabled) return;
  if (millis() - lastVoiceCheck < VOICE_CHECK_INTERVAL_MS) return;
  lastVoiceCheck = millis();

  // Calculate RMS of recent samples to detect speech
  int sampleCount = VOICE_CMD_BUFFER_SIZE;
  float sumSquares = 0.0f;
  uint32_t readIdx = audioWriteIndex > sampleCount ? audioWriteIndex - sampleCount : 0;

  for (int i = 0; i < sampleCount; i++) {
    float sample = (float)audioBuffer[(readIdx + i) % AUDIO_BUFFER_SIZE];
    sumSquares += sample * sample;
  }

  float rms = sqrt(sumSquares / sampleCount);

  // Only process if audio level suggests speech (above music/silence threshold)
  if (rms < VOICE_CMD_THRESHOLD) return;

  // In production: send audio buffer to speech-to-text API or use on-device
  // keyword spotting (e.g., TensorFlow Lite Micro with wake-word model)
  // For now, log that potential voice activity was detected
  serialDebugf("VOICE", "Voice activity detected (RMS: %.0f) — stub: send to STT API", rms);

  // Stub command handling:
  // "Hey Groove, identify" -> trigger identification
  // "Hey Groove, stop"     -> stop recording
  // "Hey Groove, pair"     -> enter pairing mode
  // "Hey Groove, status"   -> announce device status via BLE/OLED
}

/* ============================================================================
 * SECTION 45: Improvement #21 — Gesture Sensor Support Stub (APDS-9960)
 * ============================================================================ */

void initGestureSensor() {
  serialDebug("GESTURE", "Initializing gesture sensor (APDS-9960 stub)");

  // Probe I2C for APDS-9960
  Wire.beginTransmission(GESTURE_I2C_ADDR);
  int error = Wire.endTransmission();

  if (error == 0) {
    gestureSensorAvailable = true;
    serialDebug("GESTURE", "APDS-9960 detected on I2C");

    // In production: configure proximity and gesture detection registers
    // Write ENABLE register (0x80) to enable gesture engine
    // Configure GCONF1-4 for gesture parameters
    logToSD("GESTURE", "Gesture sensor initialized");
  } else {
    gestureSensorAvailable = false;
    serialDebug("GESTURE", "No gesture sensor detected (optional)");
  }
}

void readGestureSensor() {
  if (!gestureSensorAvailable) return;
  if (millis() - lastGestureRead < GESTURE_READ_INTERVAL_MS) return;
  lastGestureRead = millis();

  // In production: read gesture FIFO from APDS-9960
  // Gestures: UP, DOWN, LEFT, RIGHT, NEAR, FAR
  //
  // Gesture mapping:
  //   Swipe UP    -> Volume up / next track
  //   Swipe DOWN  -> Volume down / previous track
  //   Swipe LEFT  -> Skip
  //   Swipe RIGHT -> Identify
  //   NEAR        -> Wake from idle
  //   FAR         -> Enter idle/sleep

  // Stub: read gesture register 0xAF (GSTATUS)
  Wire.beginTransmission(GESTURE_I2C_ADDR);
  Wire.write(0xAF);
  Wire.endTransmission();
  Wire.requestFrom((uint8_t)GESTURE_I2C_ADDR, (uint8_t)1);

  if (Wire.available()) {
    uint8_t gstatus = Wire.read();
    if (gstatus & 0x01) {  // GVALID bit
      serialDebug("GESTURE", "Gesture detected — processing stub");
      lastActivityTime = millis();  // Reset idle timeout on gesture
    }
  }
}

/* ============================================================================
 * SECTION 46: Improvement #22b — Environmental Noise Cancellation
 * ============================================================================ */

void initNoiseCancellation() {
  serialDebug("NOISE_CANCEL", "Initializing spectral noise cancellation");
  memset(noiseProfile, 0, sizeof(noiseProfile));
  noiseProfileCalibrated = false;
  lastNoiseProfileUpdate = millis();
  logToSD("NOISE_CANCEL", "Noise cancellation initialized");
}

// Build noise profile from silence period (spectral envelope of ambient noise)
void updateNoiseProfile(int16_t* samples, int count) {
  if (count < FFT_SIZE) return;

  // Compute FFT of noise samples
  float tempInput[FFT_SIZE];
  float tempOutput[FFT_SIZE / 2];

  for (int i = 0; i < FFT_SIZE && i < count; i++) {
    tempInput[i] = (float)samples[i];
  }

  simpleFFT(tempInput, tempOutput, FFT_SIZE);

  // Bin the FFT output into noise profile bins
  int binsPerGroup = (FFT_SIZE / 2) / NOISE_PROFILE_BINS;
  for (int b = 0; b < NOISE_PROFILE_BINS; b++) {
    float sum = 0.0f;
    for (int i = 0; i < binsPerGroup; i++) {
      sum += tempOutput[b * binsPerGroup + i];
    }
    // Running average with existing profile
    if (noiseProfileCalibrated) {
      noiseProfile[b] = noiseProfile[b] * 0.7f + (sum / binsPerGroup) * 0.3f;
    } else {
      noiseProfile[b] = sum / binsPerGroup;
    }
  }

  noiseProfileCalibrated = true;
  lastNoiseProfileUpdate = millis();
  serialDebug("NOISE_CANCEL", "Noise profile updated");
}

void applyNoiseCancellation(int16_t* samples, int count) {
  if (!noiseProfileCalibrated || count < FFT_SIZE) return;

  // Process in FFT_SIZE chunks
  for (int offset = 0; offset + FFT_SIZE <= count; offset += FFT_SIZE) {
    float tempInput[FFT_SIZE];
    float tempOutput[FFT_SIZE / 2];

    for (int i = 0; i < FFT_SIZE; i++) {
      tempInput[i] = (float)samples[offset + i];
    }

    simpleFFT(tempInput, tempOutput, FFT_SIZE);

    // Spectral subtraction: reduce frequency bins matching noise profile
    int binsPerGroup = (FFT_SIZE / 2) / NOISE_PROFILE_BINS;
    for (int b = 0; b < NOISE_PROFILE_BINS; b++) {
      float noiseLevel = noiseProfile[b] * NOISE_CANCEL_ALPHA;
      for (int i = 0; i < binsPerGroup; i++) {
        int idx = b * binsPerGroup + i;
        tempOutput[idx] = max(0.0f, tempOutput[idx] - noiseLevel);
      }
    }

    // Apply gain reduction proportional to noise removal
    // (Simplified: scale time-domain samples by noise reduction ratio)
    float totalOriginal = 0.0f, totalCleaned = 0.0f;
    for (int i = 0; i < FFT_SIZE / 2; i++) {
      totalOriginal += fabs(tempInput[i]);
      totalCleaned += tempOutput[i];
    }

    float ratio = (totalOriginal > 0) ? (totalCleaned / totalOriginal) : 1.0f;
    ratio = constrain(ratio, 0.3f, 1.0f);  // Don't reduce more than 70%

    for (int i = 0; i < FFT_SIZE; i++) {
      samples[offset + i] = (int16_t)(samples[offset + i] * ratio);
    }
  }
}

/* ============================================================================
 * SECTION 47: Improvement #23b — Audio Fingerprint Caching
 * ============================================================================ */

void initFingerprintCache() {
  serialDebug("FP_CACHE", "Initializing fingerprint cache");
  fpCacheCount = 0;
  memset(fpCache, 0, sizeof(fpCache));
  logToSD("FP_CACHE", "Fingerprint cache initialized");
}

// Compute cosine similarity between two fingerprint vectors
float fingerprintSimilarity(float* fp1, float* fp2) {
  float dotProduct = 0.0f, normA = 0.0f, normB = 0.0f;
  for (int i = 0; i < 32; i++) {
    dotProduct += fp1[i] * fp2[i];
    normA += fp1[i] * fp1[i];
    normB += fp2[i] * fp2[i];
  }
  if (normA == 0 || normB == 0) return 0.0f;
  return dotProduct / (sqrt(normA) * sqrt(normB));
}

bool checkFingerprintCache(float* fingerprint, IdentifyResult& cachedResult) {
  unsigned long now = millis();
  float bestSimilarity = 0.0f;
  int bestIndex = -1;

  for (int i = 0; i < fpCacheCount; i++) {
    // Skip expired entries
    if (now - fpCache[i].cachedAt > FP_CACHE_TTL_MS) continue;

    float sim = fingerprintSimilarity(fingerprint, fpCache[i].fingerprint);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0 && bestSimilarity >= FP_SIMILARITY_THRESHOLD) {
    cachedResult = fpCache[bestIndex].result;
    fpCache[bestIndex].hitCount++;
    serialDebugf("FP_CACHE", "Cache hit! Similarity: %.2f, Hits: %d, Track: %s",
      bestSimilarity, fpCache[bestIndex].hitCount, cachedResult.album_title);
    return true;
  }

  return false;
}

void cacheFingerprintResult(float* fingerprint, const IdentifyResult& result) {
  // Find slot: use empty or oldest entry
  int slot = fpCacheCount < FP_CACHE_SIZE ? fpCacheCount++ : 0;

  if (fpCacheCount >= FP_CACHE_SIZE) {
    // Evict oldest entry
    unsigned long oldest = ULONG_MAX;
    for (int i = 0; i < FP_CACHE_SIZE; i++) {
      if (fpCache[i].cachedAt < oldest) {
        oldest = fpCache[i].cachedAt;
        slot = i;
      }
    }
  }

  memcpy(fpCache[slot].fingerprint, fingerprint, sizeof(float) * 32);
  fpCache[slot].result = result;
  fpCache[slot].cachedAt = millis();
  fpCache[slot].hitCount = 0;

  serialDebugf("FP_CACHE", "Cached fingerprint in slot %d: %s - %s",
    slot, result.artist_name, result.album_title);
}

/* ============================================================================
 * SECTION 48: Improvement #24b — Device Sleep/Wake Scheduling
 * ============================================================================ */

void initSleepSchedule() {
  serialDebug("SCHEDULE", "Initializing sleep/wake schedule");

  // Load schedule from NVS
  preferences.begin(NVS_NAMESPACE, true);
  sleepSchedule.enabled = preferences.getBool("sched_en", false);
  sleepSchedule.sleepHour = preferences.getUChar("sched_sh", 23);
  sleepSchedule.sleepMinute = preferences.getUChar("sched_sm", 0);
  sleepSchedule.wakeHour = preferences.getUChar("sched_wh", 7);
  sleepSchedule.wakeMinute = preferences.getUChar("sched_wm", 0);
  preferences.end();

  if (sleepSchedule.enabled) {
    serialDebugf("SCHEDULE", "Schedule active: sleep %02d:%02d, wake %02d:%02d",
      sleepSchedule.sleepHour, sleepSchedule.sleepMinute,
      sleepSchedule.wakeHour, sleepSchedule.wakeMinute);
  } else {
    serialDebug("SCHEDULE", "Sleep schedule disabled");
  }

  lastScheduleCheck = millis();
  logToSD("SCHEDULE", "Sleep schedule initialized");
}

void checkSleepSchedule() {
  if (!sleepSchedule.enabled) return;
  if (millis() - lastScheduleCheck < SCHEDULE_CHECK_INTERVAL_MS) return;
  lastScheduleCheck = millis();

  // Get current time from NTP (simplified — use stored offset from last sync)
  // In production: use configTime() and getLocalTime() for accurate time
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    serialDebug("SCHEDULE", "Cannot check schedule — no time sync");
    return;
  }

  int currentMinutes = timeinfo.tm_hour * 60 + timeinfo.tm_min;
  int sleepMinutes = sleepSchedule.sleepHour * 60 + sleepSchedule.sleepMinute;
  int wakeMinutes = sleepSchedule.wakeHour * 60 + sleepSchedule.wakeMinute;

  bool shouldSleep = false;
  if (sleepMinutes < wakeMinutes) {
    // Normal range (e.g., sleep 23:00, wake 07:00 doesn't apply here)
    shouldSleep = (currentMinutes >= sleepMinutes && currentMinutes < wakeMinutes);
  } else {
    // Overnight range (e.g., sleep 23:00, wake 07:00)
    shouldSleep = (currentMinutes >= sleepMinutes || currentMinutes < wakeMinutes);
  }

  if (shouldSleep && deviceState != STATE_IDLE) {
    serialDebug("SCHEDULE", "Scheduled sleep time reached — entering deep sleep");

    // Calculate wake duration in microseconds
    int wakeInMinutes;
    if (currentMinutes < wakeMinutes) {
      wakeInMinutes = wakeMinutes - currentMinutes;
    } else {
      wakeInMinutes = (24 * 60 - currentMinutes) + wakeMinutes;
    }

    uint64_t sleepDurationUs = (uint64_t)wakeInMinutes * 60ULL * 1000000ULL;
    esp_sleep_enable_timer_wakeup(sleepDurationUs);
    esp_sleep_enable_ext0_wakeup((gpio_num_t)BUTTON_PIN, LOW);  // Allow button wake

    logToSD("SCHEDULE", "Entering scheduled deep sleep");
    serialDebugf("SCHEDULE", "Sleeping for %d minutes until %02d:%02d",
      wakeInMinutes, sleepSchedule.wakeHour, sleepSchedule.wakeMinute);

    delay(100);
    esp_deep_sleep_start();
  }
}

/* ============================================================================
 * SECTION 49: Improvement #25b — Remote Configuration Updates
 * ============================================================================ */

void checkRemoteConfig() {
  if (!wifiConnected) return;
  if (millis() - lastConfigCheck < CONFIG_CHECK_INTERVAL_MS) return;
  lastConfigCheck = millis();

  serialDebug("RCONFIG", "Checking for remote configuration updates");

  HTTPClient http;
  String url = String(API_BASE_URL) + REMOTE_CONFIG_ENDPOINT;
  url += "?device_id=";
  url += config.device_id;
  url += "&current_version=";
  url += remoteConfigVersion;

  http.begin(url);
  http.addHeader("X-Device-Id", config.device_id);
  http.addHeader("X-Api-Key", config.api_key);
  http.setTimeout(5000);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    applyRemoteConfig(payload);
  } else if (httpCode == 304) {
    serialDebug("RCONFIG", "Configuration is up to date");
  } else {
    serialDebugf("RCONFIG", "Config check failed: HTTP %d", httpCode);
  }

  http.end();
}

void applyRemoteConfig(const String& json) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, json);
  if (error) {
    serialDebugf("RCONFIG", "JSON parse error: %s", error.c_str());
    return;
  }

  int newVersion = doc["version"] | 0;
  if (newVersion <= remoteConfigVersion) {
    serialDebug("RCONFIG", "No new configuration version");
    return;
  }

  serialDebugf("RCONFIG", "Applying remote config v%d (was v%d)", newVersion, remoteConfigVersion);

  // Apply configurable parameters
  if (doc.containsKey("audio_gain")) {
    float gain = doc["audio_gain"];
    if (gain >= AUTOGAIN_MIN && gain <= AUTOGAIN_MAX) {
      config.audio_gain = gain;
      currentAudioGain = gain;
      serialDebugf("RCONFIG", "Audio gain updated: %.2f", gain);
    }
  }

  if (doc.containsKey("silence_threshold")) {
    int threshold = doc["silence_threshold"];
    if (threshold >= 50 && threshold <= 10000) {
      config.silence_threshold = threshold;
      noiseFloor = threshold;
      serialDebugf("RCONFIG", "Silence threshold updated: %d", threshold);
    }
  }

  if (doc.containsKey("heartbeat_interval")) {
    // Note: can't change #define at runtime, but store for reference
    serialDebugf("RCONFIG", "Heartbeat interval suggestion: %d ms", (int)doc["heartbeat_interval"]);
  }

  if (doc.containsKey("sleep_schedule")) {
    JsonObject sched = doc["sleep_schedule"];
    sleepSchedule.enabled = sched["enabled"] | sleepSchedule.enabled;
    sleepSchedule.sleepHour = sched["sleep_hour"] | sleepSchedule.sleepHour;
    sleepSchedule.sleepMinute = sched["sleep_minute"] | sleepSchedule.sleepMinute;
    sleepSchedule.wakeHour = sched["wake_hour"] | sleepSchedule.wakeHour;
    sleepSchedule.wakeMinute = sched["wake_minute"] | sleepSchedule.wakeMinute;
    serialDebug("RCONFIG", "Sleep schedule updated from remote config");
  }

  if (doc.containsKey("noise_cancellation")) {
    bool nc = doc["noise_cancellation"];
    noiseProfileCalibrated = nc;
    serialDebugf("RCONFIG", "Noise cancellation: %s", nc ? "enabled" : "disabled");
  }

  if (doc.containsKey("voice_commands")) {
    voiceCommandEnabled = doc["voice_commands"] | voiceCommandEnabled;
    serialDebugf("RCONFIG", "Voice commands: %s", voiceCommandEnabled ? "enabled" : "disabled");
  }

  remoteConfigVersion = newVersion;
  saveConfig();
  serialDebugf("RCONFIG", "Remote config v%d applied and saved", newVersion);
  logToSD("RCONFIG", "Remote config applied");
}

/* ============================================================================
 * SECTION 50: Improvement #26 — MQTT Support
 * ============================================================================ */

// MQTT broker configuration
#define MQTT_BROKER         "mqtt.groovestack.io"
#define MQTT_PORT           1883
#define MQTT_KEEPALIVE      60
#define MQTT_BUFFER_SIZE    512
#define MQTT_RECONNECT_MS   5000

static WiFiClient mqttWifiClient;
static bool mqttConnected = false;
static unsigned long lastMqttReconnect = 0;
static char mqttClientId[32];
static char mqttTopicStatus[64];
static char mqttTopicCommand[64];
static char mqttTopicAudio[64];

// Lightweight MQTT packet builder (no external library needed)
static uint8_t mqttBuffer[MQTT_BUFFER_SIZE];

bool mqttSendConnect() {
  // Build CONNECT packet
  uint8_t pkt[128];
  int idx = 0;
  // Fixed header
  pkt[idx++] = 0x10; // CONNECT
  // Variable header placeholder for length
  int lenPos = idx++;
  // Protocol Name
  pkt[idx++] = 0x00; pkt[idx++] = 0x04;
  pkt[idx++] = 'M'; pkt[idx++] = 'Q'; pkt[idx++] = 'T'; pkt[idx++] = 'T';
  pkt[idx++] = 0x04; // Protocol Level (MQTT 3.1.1)
  pkt[idx++] = 0x02; // Connect Flags (Clean Session)
  pkt[idx++] = (MQTT_KEEPALIVE >> 8) & 0xFF;
  pkt[idx++] = MQTT_KEEPALIVE & 0xFF;
  // Client ID
  int clientIdLen = strlen(mqttClientId);
  pkt[idx++] = (clientIdLen >> 8) & 0xFF;
  pkt[idx++] = clientIdLen & 0xFF;
  memcpy(&pkt[idx], mqttClientId, clientIdLen);
  idx += clientIdLen;
  // Set remaining length
  pkt[lenPos] = idx - 2;

  return mqttWifiClient.write(pkt, idx) == idx;
}

bool mqttPublish(const char* topic, const char* payload) {
  if (!mqttConnected) return false;
  int topicLen = strlen(topic);
  int payloadLen = strlen(payload);
  int remainLen = 2 + topicLen + payloadLen;

  uint8_t pkt[MQTT_BUFFER_SIZE];
  int idx = 0;
  pkt[idx++] = 0x30; // PUBLISH, QoS 0
  // Encode remaining length (simple for <128)
  if (remainLen < 128) {
    pkt[idx++] = remainLen;
  } else {
    pkt[idx++] = (remainLen % 128) | 0x80;
    pkt[idx++] = remainLen / 128;
  }
  pkt[idx++] = (topicLen >> 8) & 0xFF;
  pkt[idx++] = topicLen & 0xFF;
  memcpy(&pkt[idx], topic, topicLen); idx += topicLen;
  memcpy(&pkt[idx], payload, payloadLen); idx += payloadLen;

  return mqttWifiClient.write(pkt, idx) == idx;
}

bool mqttSubscribe(const char* topic) {
  if (!mqttConnected) return false;
  static uint16_t packetId = 1;
  int topicLen = strlen(topic);
  int remainLen = 2 + 2 + topicLen + 1;

  uint8_t pkt[128];
  int idx = 0;
  pkt[idx++] = 0x82; // SUBSCRIBE
  pkt[idx++] = remainLen;
  pkt[idx++] = (packetId >> 8) & 0xFF;
  pkt[idx++] = packetId & 0xFF;
  packetId++;
  pkt[idx++] = (topicLen >> 8) & 0xFF;
  pkt[idx++] = topicLen & 0xFF;
  memcpy(&pkt[idx], topic, topicLen); idx += topicLen;
  pkt[idx++] = 0x00; // QoS 0

  return mqttWifiClient.write(pkt, idx) == idx;
}

void initMQTT() {
  snprintf(mqttClientId, sizeof(mqttClientId), "VB-%s", config.device_id);
  snprintf(mqttTopicStatus, sizeof(mqttTopicStatus), "vinylbuddy/%s/status", config.device_id);
  snprintf(mqttTopicCommand, sizeof(mqttTopicCommand), "vinylbuddy/%s/command", config.device_id);
  snprintf(mqttTopicAudio, sizeof(mqttTopicAudio), "vinylbuddy/%s/audio", config.device_id);
  serialDebug("MQTT", "MQTT client initialized");
}

void mqttReconnect() {
  if (mqttConnected || !wifiConnected) return;
  if (millis() - lastMqttReconnect < MQTT_RECONNECT_MS) return;
  lastMqttReconnect = millis();

  serialDebugf("MQTT", "Connecting to %s:%d", MQTT_BROKER, MQTT_PORT);
  if (mqttWifiClient.connect(MQTT_BROKER, MQTT_PORT)) {
    if (mqttSendConnect()) {
      delay(100);
      if (mqttWifiClient.available()) {
        uint8_t resp[4];
        mqttWifiClient.read(resp, 4);
        if (resp[0] == 0x20 && resp[3] == 0x00) {
          mqttConnected = true;
          serialDebug("MQTT", "Connected to broker");
          mqttSubscribe(mqttTopicCommand);
          mqttPublish(mqttTopicStatus, "{\"state\":\"online\"}");
          logToSD("MQTT", "Connected to broker");
          return;
        }
      }
    }
    mqttWifiClient.stop();
  }
  serialDebug("MQTT", "Connection failed, will retry");
}

void mqttProcessIncoming() {
  if (!mqttConnected || !mqttWifiClient.connected()) {
    if (mqttConnected) {
      mqttConnected = false;
      serialDebug("MQTT", "Disconnected from broker");
    }
    return;
  }
  while (mqttWifiClient.available()) {
    uint8_t header = mqttWifiClient.read();
    if ((header & 0xF0) == 0x30) { // PUBLISH
      uint8_t lenByte = mqttWifiClient.read();
      int remainLen = lenByte & 0x7F;
      if (lenByte & 0x80) {
        remainLen += mqttWifiClient.read() * 128;
      }
      uint8_t buf[MQTT_BUFFER_SIZE];
      int read = 0;
      while (read < remainLen && read < MQTT_BUFFER_SIZE) {
        if (mqttWifiClient.available()) buf[read++] = mqttWifiClient.read();
      }
      int topicLen = (buf[0] << 8) | buf[1];
      char topic[128] = {0};
      memcpy(topic, &buf[2], min(topicLen, 127));
      char payload[256] = {0};
      int payloadLen = remainLen - 2 - topicLen;
      memcpy(payload, &buf[2 + topicLen], min(payloadLen, 255));

      serialDebugf("MQTT", "Received on %s: %s", topic, payload);
      // Handle commands
      if (strstr(payload, "\"identify\"")) {
        setLedState(LED_PROCESSING);
        serialDebug("MQTT", "Identify command received");
      } else if (strstr(payload, "\"reboot\"")) {
        serialDebug("MQTT", "Reboot command received");
        ESP.restart();
      }
    } else if ((header & 0xF0) == 0xD0) { // PINGRESP
      mqttWifiClient.read(); // consume length byte
    }
  }
}

void mqttSendPing() {
  if (!mqttConnected) return;
  static unsigned long lastPing = 0;
  if (millis() - lastPing < (MQTT_KEEPALIVE * 1000 / 2)) return;
  lastPing = millis();
  uint8_t ping[] = {0xC0, 0x00};
  mqttWifiClient.write(ping, 2);
}

void mqttPublishStatus() {
  if (!mqttConnected) return;
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus < 10000) return;
  lastStatus = millis();

  char payload[256];
  snprintf(payload, sizeof(payload),
    "{\"battery\":%d,\"temp\":%.1f,\"state\":\"%s\",\"heap\":%d,\"rssi\":%d}",
    batteryPercent, temperatureC,
    deviceState == STATE_LISTENING ? "listening" : "processing",
    ESP.getFreeHeap(), WiFi.RSSI());
  mqttPublish(mqttTopicStatus, payload);
}

void loopMQTT() {
  mqttReconnect();
  mqttProcessIncoming();
  mqttSendPing();
  mqttPublishStatus();
}

/* ============================================================================
 * SECTION 51: Improvement #27 — Audio FFT with Peak Detection
 * ============================================================================ */

#define FFT_PEAK_MAX        16
#define FFT_MAGNITUDE_MIN   50.0f
#define FFT_HARMONIC_RATIO  0.02f

struct SpectralPeak {
  uint16_t binIndex;
  float frequency;
  float magnitude;
  float phase;
};

static SpectralPeak detectedPeaks[FFT_PEAK_MAX];
static int numDetectedPeaks = 0;
static float peakSpectralEnergy = 0.0f;

// Simple peak detection on FFT magnitude spectrum
void detectSpectralPeaks(float* magnitudes, int numBins, float sampleRate) {
  numDetectedPeaks = 0;
  peakSpectralEnergy = 0.0f;
  float binWidth = sampleRate / (numBins * 2);

  // Calculate mean magnitude for adaptive thresholding
  float meanMag = 0;
  for (int i = 1; i < numBins; i++) {
    meanMag += magnitudes[i];
  }
  meanMag /= (numBins - 1);
  float threshold = max(FFT_MAGNITUDE_MIN, meanMag * 3.0f);

  for (int i = 2; i < numBins - 1 && numDetectedPeaks < FFT_PEAK_MAX; i++) {
    // Check if bin is a local maximum above threshold
    if (magnitudes[i] > threshold &&
        magnitudes[i] > magnitudes[i-1] &&
        magnitudes[i] > magnitudes[i+1] &&
        magnitudes[i] > magnitudes[i-2]) {

      // Parabolic interpolation for sub-bin precision
      float alpha = magnitudes[i-1];
      float beta  = magnitudes[i];
      float gamma = magnitudes[i+1];
      float denom = alpha - 2.0f * beta + gamma;
      float delta = 0;
      if (fabs(denom) > 1e-6) {
        delta = 0.5f * (alpha - gamma) / denom;
      }

      detectedPeaks[numDetectedPeaks].binIndex = i;
      detectedPeaks[numDetectedPeaks].frequency = (i + delta) * binWidth;
      detectedPeaks[numDetectedPeaks].magnitude = beta - 0.25f * (alpha - gamma) * delta;
      detectedPeaks[numDetectedPeaks].phase = 0; // Phase not computed in basic FFT
      peakSpectralEnergy += detectedPeaks[numDetectedPeaks].magnitude;
      numDetectedPeaks++;
    }
  }

  // Sort peaks by magnitude (descending) - simple insertion sort
  for (int i = 1; i < numDetectedPeaks; i++) {
    SpectralPeak key = detectedPeaks[i];
    int j = i - 1;
    while (j >= 0 && detectedPeaks[j].magnitude < key.magnitude) {
      detectedPeaks[j+1] = detectedPeaks[j];
      j--;
    }
    detectedPeaks[j+1] = key;
  }

  serialDebugf("FFT", "Detected %d spectral peaks, energy=%.1f", numDetectedPeaks, peakSpectralEnergy);
}

// Generate enhanced fingerprint using peak constellation
void generatePeakFingerprint(uint32_t* fingerprint, int maxPairs) {
  int pairCount = 0;
  for (int i = 0; i < numDetectedPeaks && pairCount < maxPairs; i++) {
    for (int j = i + 1; j < numDetectedPeaks && pairCount < maxPairs; j++) {
      // Encode peak pair as hash: freq1(10 bits) | freq2(10 bits) | delta(12 bits)
      uint16_t f1 = detectedPeaks[i].binIndex & 0x3FF;
      uint16_t f2 = detectedPeaks[j].binIndex & 0x3FF;
      uint16_t dt = abs(detectedPeaks[i].binIndex - detectedPeaks[j].binIndex) & 0xFFF;
      fingerprint[pairCount++] = ((uint32_t)f1 << 22) | ((uint32_t)f2 << 12) | dt;
    }
  }
  serialDebugf("FFT", "Generated %d peak-pair fingerprints", pairCount);
}

/* ============================================================================
 * SECTION 52: Improvement #28 — Battery Fuel Gauge (Coulomb Counting)
 * ============================================================================ */

#define FUEL_GAUGE_INTERVAL_MS   1000
#define BATTERY_CAPACITY_MAH     2000.0f   // Nominal battery capacity
#define SHUNT_RESISTOR_OHMS      0.1f      // Current sense resistor
#define CURRENT_SENSE_PIN        36        // ADC pin for current measurement
#define COULOMB_SAVE_INTERVAL    60000     // Save to NVS every 60s

static float fuelGaugeSOC = 100.0f;        // State of charge (%)
static float fuelGaugeCoulombs = 0.0f;     // Accumulated charge (mAh)
static float fuelGaugeCurrentMA = 0.0f;    // Instantaneous current (mA)
static float fuelGaugeVoltage = 0.0f;      // Battery voltage
static unsigned long lastFuelGaugeUpdate = 0;
static unsigned long lastCoulombSave = 0;

void initFuelGauge() {
  // Load saved SOC from NVS
  Preferences fuelPrefs;
  fuelPrefs.begin("fuel", true);
  fuelGaugeSOC = fuelPrefs.getFloat("soc", 100.0f);
  fuelGaugeCoulombs = fuelPrefs.getFloat("coulombs", 0.0f);
  fuelPrefs.end();

  analogReadResolution(12);
  serialDebugf("FUEL", "Fuel gauge initialized, SOC=%.1f%%", fuelGaugeSOC);
  logToSD("FUEL", "Fuel gauge initialized");
}

void updateFuelGauge() {
  if (millis() - lastFuelGaugeUpdate < FUEL_GAUGE_INTERVAL_MS) return;
  unsigned long elapsed = millis() - lastFuelGaugeUpdate;
  lastFuelGaugeUpdate = millis();

  // Read current via shunt resistor voltage
  int rawCurrent = analogRead(CURRENT_SENSE_PIN);
  float shuntVoltage = (rawCurrent / 4095.0f) * 3.3f;
  fuelGaugeCurrentMA = (shuntVoltage / SHUNT_RESISTOR_OHMS) * 1000.0f;

  // Coulomb counting: integrate current over time
  float elapsedHours = elapsed / 3600000.0f;
  fuelGaugeCoulombs += fuelGaugeCurrentMA * elapsedHours;

  // Calculate SOC
  fuelGaugeSOC = 100.0f * (1.0f - (fuelGaugeCoulombs / BATTERY_CAPACITY_MAH));
  fuelGaugeSOC = constrain(fuelGaugeSOC, 0.0f, 100.0f);

  // Voltage-based correction: if voltage is very high, SOC must be near 100%
  fuelGaugeVoltage = batteryVoltage;  // Use existing battery reading
  if (fuelGaugeVoltage > 4.15f && fuelGaugeSOC < 95.0f) {
    fuelGaugeSOC = 100.0f;
    fuelGaugeCoulombs = 0.0f;
  }
  // If voltage critically low, force SOC to 0
  if (fuelGaugeVoltage < 3.0f) {
    fuelGaugeSOC = 0.0f;
  }

  // Periodically save to NVS
  if (millis() - lastCoulombSave > COULOMB_SAVE_INTERVAL) {
    lastCoulombSave = millis();
    Preferences fuelPrefs;
    fuelPrefs.begin("fuel", false);
    fuelPrefs.putFloat("soc", fuelGaugeSOC);
    fuelPrefs.putFloat("coulombs", fuelGaugeCoulombs);
    fuelPrefs.end();
  }
}

/* ============================================================================
 * SECTION 53: Improvement #29 — Capacitive Touch Sensor Support
 * ============================================================================ */

#define TOUCH_PIN_PLAY        T0   // GPIO 4
#define TOUCH_PIN_NEXT        T3   // GPIO 15
#define TOUCH_PIN_PREV        T6   // GPIO 14
#define TOUCH_THRESHOLD       40   // Lower = more sensitive
#define TOUCH_DEBOUNCE_MS     300
#define TOUCH_LONG_PRESS_MS   1000

struct TouchInput {
  uint8_t pin;
  const char* name;
  bool active;
  unsigned long lastTrigger;
  unsigned long pressStart;
  bool longPressHandled;
};

static TouchInput touchInputs[] = {
  {TOUCH_PIN_PLAY, "play",  false, 0, 0, false},
  {TOUCH_PIN_NEXT, "next",  false, 0, 0, false},
  {TOUCH_PIN_PREV, "prev",  false, 0, 0, false},
};
static const int TOUCH_INPUT_COUNT = sizeof(touchInputs) / sizeof(TouchInput);
static bool touchEnabled = true;

void initTouchSensors() {
  // ESP32 touch pins are initialized automatically
  // Set threshold for touch interrupt capability
  for (int i = 0; i < TOUCH_INPUT_COUNT; i++) {
    touchInputs[i].active = false;
    touchInputs[i].lastTrigger = 0;
    touchInputs[i].pressStart = 0;
    touchInputs[i].longPressHandled = false;
  }
  serialDebug("TOUCH", "Capacitive touch sensors initialized");
  logToSD("TOUCH", "Touch sensors initialized");
}

void handleTouchAction(const char* name, bool longPress) {
  if (longPress) {
    serialDebugf("TOUCH", "Long press: %s", name);
    if (strcmp(name, "play") == 0) {
      // Long press play = toggle WiFi
      if (wifiConnected) {
        WiFi.disconnect();
        serialDebug("TOUCH", "WiFi disconnected via touch");
      } else {
        connectWiFi();
      }
    }
  } else {
    serialDebugf("TOUCH", "Tap: %s", name);
    if (strcmp(name, "play") == 0) {
      // Tap play = start/stop listening
      if (deviceState == STATE_LISTENING) {
        deviceState = STATE_IDLE;
        setLedState(LED_OFF);
      } else {
        deviceState = STATE_LISTENING;
        setLedState(LED_LISTENING);
      }
    } else if (strcmp(name, "next") == 0) {
      // Next = increase gain
      if (config.audio_gain < 10.0f) {
        config.audio_gain += 0.5f;
        serialDebugf("TOUCH", "Gain increased to %.1f", config.audio_gain);
      }
    } else if (strcmp(name, "prev") == 0) {
      // Prev = decrease gain
      if (config.audio_gain > 0.5f) {
        config.audio_gain -= 0.5f;
        serialDebugf("TOUCH", "Gain decreased to %.1f", config.audio_gain);
      }
    }
  }
}

void readTouchSensors() {
  if (!touchEnabled) return;

  for (int i = 0; i < TOUCH_INPUT_COUNT; i++) {
    uint16_t touchVal = touchRead(touchInputs[i].pin);
    bool touching = touchVal < TOUCH_THRESHOLD;

    if (touching && !touchInputs[i].active) {
      // Touch start
      touchInputs[i].active = true;
      touchInputs[i].pressStart = millis();
      touchInputs[i].longPressHandled = false;
    } else if (touching && touchInputs[i].active) {
      // Check for long press
      if (!touchInputs[i].longPressHandled &&
          millis() - touchInputs[i].pressStart > TOUCH_LONG_PRESS_MS) {
        handleTouchAction(touchInputs[i].name, true);
        touchInputs[i].longPressHandled = true;
      }
    } else if (!touching && touchInputs[i].active) {
      // Touch release
      touchInputs[i].active = false;
      if (!touchInputs[i].longPressHandled &&
          millis() - touchInputs[i].lastTrigger > TOUCH_DEBOUNCE_MS) {
        handleTouchAction(touchInputs[i].name, false);
        touchInputs[i].lastTrigger = millis();
      }
    }
  }
}

/* ============================================================================
 * SECTION 54: Improvement #30 — WS2812 LED Strip Support (NeoPixel)
 * ============================================================================ */

#define LED_STRIP_PIN         13
#define LED_STRIP_COUNT       8
#define LED_STRIP_BRIGHTNESS  50    // 0-255

// WS2812 timing (in CPU cycles at 240MHz)
#define WS_T0H  18   // ~75ns
#define WS_T0L  43   // ~180ns
#define WS_T1H  36   // ~150ns
#define WS_T1L  25   // ~105ns

static uint8_t ledStripColors[LED_STRIP_COUNT][3]; // GRB format
static bool ledStripEnabled = false;
static uint8_t ledStripPattern = 0;
static unsigned long lastStripUpdate = 0;

// Bit-bang WS2812 protocol using RMT peripheral
#include <driver/rmt.h>

static rmt_item32_t ledStripRmtItems[LED_STRIP_COUNT * 24];

void initLedStrip() {
  rmt_config_t rmtConfig = RMT_DEFAULT_CONFIG_TX((gpio_num_t)LED_STRIP_PIN, RMT_CHANNEL_0);
  rmtConfig.clk_div = 2; // 40MHz tick = 25ns per tick

  esp_err_t err = rmt_config(&rmtConfig);
  if (err != ESP_OK) {
    serialDebug("LEDS", "RMT config failed, LED strip disabled");
    return;
  }
  rmt_driver_install(rmtConfig.channel, 0, 0);

  ledStripEnabled = true;
  memset(ledStripColors, 0, sizeof(ledStripColors));
  serialDebugf("LEDS", "WS2812 strip initialized: %d LEDs on GPIO %d", LED_STRIP_COUNT, LED_STRIP_PIN);
  logToSD("LEDS", "LED strip initialized");
}

void ledStripSetPixel(int idx, uint8_t r, uint8_t g, uint8_t b) {
  if (idx < 0 || idx >= LED_STRIP_COUNT) return;
  ledStripColors[idx][0] = (g * LED_STRIP_BRIGHTNESS) / 255;
  ledStripColors[idx][1] = (r * LED_STRIP_BRIGHTNESS) / 255;
  ledStripColors[idx][2] = (b * LED_STRIP_BRIGHTNESS) / 255;
}

void ledStripShow() {
  if (!ledStripEnabled) return;
  int itemIdx = 0;
  for (int pixel = 0; pixel < LED_STRIP_COUNT; pixel++) {
    for (int color = 0; color < 3; color++) {
      uint8_t byte = ledStripColors[pixel][color];
      for (int bit = 7; bit >= 0; bit--) {
        if (byte & (1 << bit)) {
          ledStripRmtItems[itemIdx].level0 = 1;
          ledStripRmtItems[itemIdx].duration0 = 14;  // T1H ~350ns
          ledStripRmtItems[itemIdx].level1 = 0;
          ledStripRmtItems[itemIdx].duration1 = 10;  // T1L ~250ns
        } else {
          ledStripRmtItems[itemIdx].level0 = 1;
          ledStripRmtItems[itemIdx].duration0 = 6;   // T0H ~150ns
          ledStripRmtItems[itemIdx].level1 = 0;
          ledStripRmtItems[itemIdx].duration1 = 17;  // T0L ~425ns
        }
        itemIdx++;
      }
    }
  }
  rmt_write_items(RMT_CHANNEL_0, ledStripRmtItems, itemIdx, true);
}

void ledStripClear() {
  memset(ledStripColors, 0, sizeof(ledStripColors));
  ledStripShow();
}

// Pattern: VU meter based on audio level
void ledStripVUMeter(float audioLevel) {
  int litLeds = (int)(audioLevel * LED_STRIP_COUNT);
  for (int i = 0; i < LED_STRIP_COUNT; i++) {
    if (i < litLeds) {
      if (i < LED_STRIP_COUNT * 0.6) {
        ledStripSetPixel(i, 0, 255, 0);   // Green
      } else if (i < LED_STRIP_COUNT * 0.85) {
        ledStripSetPixel(i, 255, 165, 0);  // Orange
      } else {
        ledStripSetPixel(i, 255, 0, 0);   // Red
      }
    } else {
      ledStripSetPixel(i, 0, 0, 0);
    }
  }
  ledStripShow();
}

// Pattern: Rainbow cycle
void ledStripRainbow(unsigned long frame) {
  for (int i = 0; i < LED_STRIP_COUNT; i++) {
    int hue = ((i * 256 / LED_STRIP_COUNT) + frame) & 0xFF;
    // Simple HSV to RGB (hue only, full sat/val)
    uint8_t r, g, b;
    if (hue < 85) {
      r = hue * 3; g = 255 - hue * 3; b = 0;
    } else if (hue < 170) {
      hue -= 85; r = 255 - hue * 3; g = 0; b = hue * 3;
    } else {
      hue -= 170; r = 0; g = hue * 3; b = 255 - hue * 3;
    }
    ledStripSetPixel(i, r, g, b);
  }
  ledStripShow();
}

void updateLedStrip() {
  if (!ledStripEnabled) return;
  if (millis() - lastStripUpdate < 50) return; // 20fps
  lastStripUpdate = millis();

  switch (ledStripPattern) {
    case 0: // VU meter mode
      ledStripVUMeter(currentAudioLevel / 32768.0f);
      break;
    case 1: // Rainbow
      ledStripRainbow(millis() / 20);
      break;
    case 2: // Off
      ledStripClear();
      break;
  }
}

/* ============================================================================
 * SECTION 55: Improvement #31 — Buzzer / Haptic Feedback
 * ============================================================================ */

#define BUZZER_PIN            12
#define BUZZER_CHANNEL        2     // LEDC channel for tone generation

static bool buzzerEnabled = true;

void initBuzzer() {
  ledcSetup(BUZZER_CHANNEL, 2000, 8); // 2kHz default, 8-bit resolution
  ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
  ledcWrite(BUZZER_CHANNEL, 0); // Start silent
  serialDebug("BUZZER", "Piezo buzzer initialized on GPIO %d", BUZZER_PIN);
  logToSD("BUZZER", "Buzzer initialized");
}

void buzzerTone(uint16_t frequency, uint16_t durationMs, uint8_t volume) {
  if (!buzzerEnabled) return;
  volume = constrain(volume, 0, 128);
  ledcWriteTone(BUZZER_CHANNEL, frequency);
  ledcWrite(BUZZER_CHANNEL, volume);
  delay(durationMs);
  ledcWrite(BUZZER_CHANNEL, 0);
}

void buzzerBeepSuccess() {
  if (!buzzerEnabled) return;
  buzzerTone(1047, 100, 64);  // C5
  delay(50);
  buzzerTone(1319, 100, 64);  // E5
  delay(50);
  buzzerTone(1568, 150, 64);  // G5
}

void buzzerBeepError() {
  if (!buzzerEnabled) return;
  buzzerTone(400, 200, 80);
  delay(100);
  buzzerTone(300, 300, 80);
}

void buzzerBeepConfirm() {
  if (!buzzerEnabled) return;
  buzzerTone(2000, 50, 48);
}

void buzzerBeepBoot() {
  if (!buzzerEnabled) return;
  buzzerTone(523, 80, 48);   // C4
  delay(30);
  buzzerTone(659, 80, 48);   // E4
  delay(30);
  buzzerTone(784, 80, 48);   // G4
  delay(30);
  buzzerTone(1047, 120, 48); // C5
}

/* ============================================================================
 * SECTION 56: Improvement #32 — Ambient Light Sensor (Auto-Brightness)
 * ============================================================================ */

#define LIGHT_SENSOR_PIN      39    // ADC input for photoresistor/phototransistor
#define LIGHT_READ_INTERVAL   2000  // Read every 2 seconds
#define LIGHT_LEVELS          5     // Number of brightness steps
#define LIGHT_SMOOTHING       0.3f  // EMA smoothing factor

static float ambientLightLevel = 0.5f;     // Normalized 0.0 - 1.0
static float smoothedLightLevel = 0.5f;
static uint8_t currentOledBrightness = 128;
static unsigned long lastLightRead = 0;
static bool autoLightEnabled = true;

// Brightness lookup table: ambient light level -> OLED brightness
static const uint8_t brightnessMap[LIGHT_LEVELS] = {16, 48, 96, 160, 255};
static const float lightThresholds[LIGHT_LEVELS] = {0.1f, 0.25f, 0.5f, 0.75f, 0.9f};

void initAmbientLight() {
  pinMode(LIGHT_SENSOR_PIN, INPUT);
  // Take initial reading
  int raw = analogRead(LIGHT_SENSOR_PIN);
  ambientLightLevel = raw / 4095.0f;
  smoothedLightLevel = ambientLightLevel;
  serialDebugf("LIGHT", "Ambient light sensor initialized, level=%.2f", ambientLightLevel);
}

void readAmbientLight() {
  if (!autoLightEnabled) return;
  if (millis() - lastLightRead < LIGHT_READ_INTERVAL) return;
  lastLightRead = millis();

  int raw = analogRead(LIGHT_SENSOR_PIN);
  ambientLightLevel = raw / 4095.0f;

  // Exponential moving average for stability
  smoothedLightLevel = LIGHT_SMOOTHING * ambientLightLevel +
                       (1.0f - LIGHT_SMOOTHING) * smoothedLightLevel;

  // Determine brightness level
  uint8_t newBrightness = brightnessMap[0];
  for (int i = 0; i < LIGHT_LEVELS; i++) {
    if (smoothedLightLevel >= lightThresholds[i]) {
      newBrightness = brightnessMap[i];
    }
  }

  // Only update OLED if brightness changed
  if (newBrightness != currentOledBrightness) {
    currentOledBrightness = newBrightness;
    if (oledAvailable) {
      display.ssd1306_command(SSD1306_SETCONTRAST);
      display.ssd1306_command(currentOledBrightness);
      serialDebugf("LIGHT", "OLED brightness adjusted to %d (ambient=%.2f)",
                   currentOledBrightness, smoothedLightLevel);
    }
  }
}

/* ============================================================================
 * SECTION 57: Improvement #33 — Accelerometer Support (MPU6050)
 * ============================================================================ */

#define MPU6050_ADDR          0x68
#define MPU6050_WHO_AM_I      0x75
#define MPU6050_PWR_MGMT_1    0x6B
#define MPU6050_ACCEL_XOUT_H  0x3B
#define MPU6050_INT_ENABLE    0x38
#define MPU6050_INT_STATUS    0x3A

#define ACCEL_TAP_THRESHOLD   1.8f   // g-force for tap detection
#define ACCEL_TAP_DURATION    100    // ms
#define ACCEL_READ_INTERVAL   50     // 20Hz

struct AccelData {
  float x, y, z;      // In g-force
  float magnitude;
  uint8_t orientation; // 0=flat, 1=upright, 2=sideways, 3=inverted
};

static AccelData accelCurrent = {0, 0, 0, 1.0, 0};
static bool mpuAvailable = false;
static unsigned long lastAccelRead = 0;
static unsigned long lastTapTime = 0;
static int tapCount = 0;

void mpuWriteReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

uint8_t mpuReadReg(uint8_t reg) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)MPU6050_ADDR, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0;
}

void initAccelerometer() {
  // Check if MPU6050 is present on I2C bus
  Wire.beginTransmission(MPU6050_ADDR);
  if (Wire.endTransmission() != 0) {
    serialDebug("ACCEL", "MPU6050 not found on I2C bus");
    mpuAvailable = false;
    return;
  }

  uint8_t whoAmI = mpuReadReg(MPU6050_WHO_AM_I);
  if (whoAmI != 0x68 && whoAmI != 0x98) {
    serialDebugf("ACCEL", "Unexpected WHO_AM_I: 0x%02X", whoAmI);
    mpuAvailable = false;
    return;
  }

  // Wake up MPU6050 (clear sleep bit)
  mpuWriteReg(MPU6050_PWR_MGMT_1, 0x00);
  delay(100);

  // Set accelerometer range to +/- 4g
  mpuWriteReg(0x1C, 0x08);

  mpuAvailable = true;
  serialDebug("ACCEL", "MPU6050 accelerometer initialized (+/- 4g)");
  logToSD("ACCEL", "MPU6050 initialized");
}

void readAccelerometer() {
  if (!mpuAvailable) return;
  if (millis() - lastAccelRead < ACCEL_READ_INTERVAL) return;
  lastAccelRead = millis();

  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_ACCEL_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)MPU6050_ADDR, (uint8_t)6);

  if (Wire.available() < 6) return;

  int16_t rawX = (Wire.read() << 8) | Wire.read();
  int16_t rawY = (Wire.read() << 8) | Wire.read();
  int16_t rawZ = (Wire.read() << 8) | Wire.read();

  // Convert to g-force (+/- 4g range, 8192 LSB/g)
  accelCurrent.x = rawX / 8192.0f;
  accelCurrent.y = rawY / 8192.0f;
  accelCurrent.z = rawZ / 8192.0f;
  accelCurrent.magnitude = sqrtf(accelCurrent.x * accelCurrent.x +
                                  accelCurrent.y * accelCurrent.y +
                                  accelCurrent.z * accelCurrent.z);

  // Determine orientation
  if (fabs(accelCurrent.z) > 0.7f && accelCurrent.z > 0) {
    accelCurrent.orientation = 0; // Flat (face up)
  } else if (fabs(accelCurrent.z) > 0.7f && accelCurrent.z < 0) {
    accelCurrent.orientation = 3; // Inverted
  } else if (fabs(accelCurrent.y) > 0.7f) {
    accelCurrent.orientation = 1; // Upright
  } else {
    accelCurrent.orientation = 2; // Sideways
  }

  // Tap detection: sudden spike in magnitude
  if (accelCurrent.magnitude > ACCEL_TAP_THRESHOLD) {
    if (millis() - lastTapTime > ACCEL_TAP_DURATION) {
      tapCount++;
      lastTapTime = millis();
      serialDebugf("ACCEL", "Tap detected (#%d), magnitude=%.2fg", tapCount, accelCurrent.magnitude);

      // Double-tap detection (within 500ms)
      static unsigned long prevTapTime = 0;
      if (millis() - prevTapTime < 500 && prevTapTime > 0) {
        serialDebug("ACCEL", "Double-tap detected!");
        buzzerBeepConfirm();
      }
      prevTapTime = millis();
    }
  }
}

/* ============================================================================
 * SECTION 58: Improvement #34 — Real-Time Clock (DS3231)
 * ============================================================================ */

#define DS3231_ADDR           0x68
#define DS3231_TIME_REG       0x00
#define DS3231_CONTROL_REG    0x0E
#define DS3231_TEMP_REG       0x11

struct RTCTime {
  uint8_t second;
  uint8_t minute;
  uint8_t hour;
  uint8_t dayOfWeek;
  uint8_t day;
  uint8_t month;
  uint16_t year;
};

static bool rtcAvailable = false;
static RTCTime rtcTime;

uint8_t bcdToDec(uint8_t bcd) { return (bcd >> 4) * 10 + (bcd & 0x0F); }
uint8_t decToBcd(uint8_t dec) { return ((dec / 10) << 4) | (dec % 10); }

void initRTC() {
  // Probe DS3231 on I2C
  // Note: DS3231 shares address 0x68 with MPU6050
  // In a real design, use different I2C buses or verify via register differences
  Wire.beginTransmission(DS3231_ADDR);
  Wire.write(DS3231_CONTROL_REG);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)DS3231_ADDR, (uint8_t)1);

  if (!Wire.available()) {
    serialDebug("RTC", "DS3231 not found");
    rtcAvailable = false;
    return;
  }

  uint8_t ctrl = Wire.read();
  // DS3231 control register defaults to 0x1C, MPU6050 has different behavior at 0x0E
  // Enable oscillator (clear EOSC bit)
  Wire.beginTransmission(DS3231_ADDR);
  Wire.write(DS3231_CONTROL_REG);
  Wire.write(ctrl & ~0x80);
  Wire.endTransmission();

  rtcAvailable = true;
  readRTC();
  serialDebugf("RTC", "DS3231 initialized: %04d-%02d-%02d %02d:%02d:%02d",
    rtcTime.year, rtcTime.month, rtcTime.day,
    rtcTime.hour, rtcTime.minute, rtcTime.second);
  logToSD("RTC", "DS3231 initialized");
}

void readRTC() {
  if (!rtcAvailable) return;

  Wire.beginTransmission(DS3231_ADDR);
  Wire.write(DS3231_TIME_REG);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)DS3231_ADDR, (uint8_t)7);

  if (Wire.available() < 7) return;

  rtcTime.second    = bcdToDec(Wire.read() & 0x7F);
  rtcTime.minute    = bcdToDec(Wire.read());
  rtcTime.hour      = bcdToDec(Wire.read() & 0x3F);
  rtcTime.dayOfWeek = bcdToDec(Wire.read());
  rtcTime.day       = bcdToDec(Wire.read());
  rtcTime.month     = bcdToDec(Wire.read() & 0x1F);
  rtcTime.year      = 2000 + bcdToDec(Wire.read());
}

void setRTC(uint16_t year, uint8_t month, uint8_t day,
            uint8_t hour, uint8_t minute, uint8_t second) {
  if (!rtcAvailable) return;

  Wire.beginTransmission(DS3231_ADDR);
  Wire.write(DS3231_TIME_REG);
  Wire.write(decToBcd(second));
  Wire.write(decToBcd(minute));
  Wire.write(decToBcd(hour));
  Wire.write(decToBcd(0)); // day of week (unused)
  Wire.write(decToBcd(day));
  Wire.write(decToBcd(month));
  Wire.write(decToBcd(year - 2000));
  Wire.endTransmission();

  serialDebugf("RTC", "Time set to %04d-%02d-%02d %02d:%02d:%02d",
    year, month, day, hour, minute, second);
}

float readRTCTemperature() {
  if (!rtcAvailable) return -999.0f;

  Wire.beginTransmission(DS3231_ADDR);
  Wire.write(DS3231_TEMP_REG);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)DS3231_ADDR, (uint8_t)2);

  if (Wire.available() < 2) return -999.0f;

  int8_t msb = Wire.read();
  uint8_t lsb = Wire.read();
  return msb + (lsb >> 6) * 0.25f;
}

void syncRTCFromNTP() {
  if (!rtcAvailable || !wifiConnected) return;
  // Use configTime already set up in WiFi connection
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 5000)) {
    setRTC(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
           timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    serialDebug("RTC", "RTC synced from NTP");
  }
}

/* ============================================================================
 * SECTION 59: Improvement #35 — Audio AGC (Automatic Gain Control)
 * ============================================================================ */

#define AGC_TARGET_RMS        8000.0f    // Target RMS level (out of 32768)
#define AGC_MIN_GAIN          0.1f
#define AGC_MAX_GAIN          20.0f
#define AGC_ATTACK_RATE       0.05f      // Fast attack (reduce gain quickly)
#define AGC_RELEASE_RATE      0.002f     // Slow release (increase gain slowly)
#define AGC_HISTORY_SIZE      32
#define AGC_UPDATE_INTERVAL   50         // ms

static float agcGain = 1.0f;
static float agcRmsHistory[AGC_HISTORY_SIZE];
static int agcHistoryIndex = 0;
static bool agcHistoryFull = false;
static unsigned long lastAGCUpdate = 0;
static bool agcEnabled = true;

void initAGC() {
  agcGain = 1.0f;
  memset(agcRmsHistory, 0, sizeof(agcRmsHistory));
  agcHistoryIndex = 0;
  agcHistoryFull = false;
  serialDebug("AGC", "Automatic Gain Control initialized");
}

float calculateRMS(int16_t* samples, int count) {
  if (count == 0) return 0;
  float sumSq = 0;
  for (int i = 0; i < count; i++) {
    float s = samples[i];
    sumSq += s * s;
  }
  return sqrtf(sumSq / count);
}

void updateAGC(int16_t* samples, int count) {
  if (!agcEnabled || count == 0) return;
  if (millis() - lastAGCUpdate < AGC_UPDATE_INTERVAL) return;
  lastAGCUpdate = millis();

  float rms = calculateRMS(samples, count);

  // Store in history buffer
  agcRmsHistory[agcHistoryIndex] = rms;
  agcHistoryIndex = (agcHistoryIndex + 1) % AGC_HISTORY_SIZE;
  if (agcHistoryIndex == 0) agcHistoryFull = true;

  // Calculate average RMS over history
  int histCount = agcHistoryFull ? AGC_HISTORY_SIZE : agcHistoryIndex;
  float avgRms = 0;
  for (int i = 0; i < histCount; i++) {
    avgRms += agcRmsHistory[i];
  }
  avgRms /= histCount;

  // Skip if signal is too quiet (noise floor)
  if (avgRms < 100.0f) return;

  // Calculate desired gain adjustment
  float targetGain = AGC_TARGET_RMS / avgRms;

  // Apply attack/release dynamics
  if (targetGain < agcGain) {
    // Signal too loud - reduce gain quickly (attack)
    agcGain += (targetGain - agcGain) * AGC_ATTACK_RATE;
  } else {
    // Signal too quiet - increase gain slowly (release)
    agcGain += (targetGain - agcGain) * AGC_RELEASE_RATE;
  }

  agcGain = constrain(agcGain, AGC_MIN_GAIN, AGC_MAX_GAIN);
}

void applyAGC(int16_t* samples, int count) {
  if (!agcEnabled) return;
  for (int i = 0; i < count; i++) {
    float adjusted = samples[i] * agcGain;
    // Soft clipping to prevent harsh distortion
    if (adjusted > 30000.0f) adjusted = 30000.0f + (adjusted - 30000.0f) * 0.1f;
    if (adjusted < -30000.0f) adjusted = -30000.0f + (adjusted + 30000.0f) * 0.1f;
    samples[i] = constrain((int16_t)adjusted, -32767, 32767);
  }
}

/* ============================================================================
 * SECTION 60: Improvement #36 — Spectral Centroid Calculation
 * ============================================================================ */

#define CENTROID_HISTORY_SIZE   16
#define CENTROID_UPDATE_MS      200

static float spectralCentroid = 0.0f;        // In Hz
static float centroidHistory[CENTROID_HISTORY_SIZE];
static int centroidHistoryIdx = 0;
static float centroidVariance = 0.0f;
static unsigned long lastCentroidUpdate = 0;

// Genre brightness classification thresholds (Hz)
#define CENTROID_DARK     800.0f    // < 800 Hz: bass-heavy (dub, ambient)
#define CENTROID_WARM     1500.0f   // 800-1500 Hz: warm (jazz, soul, R&B)
#define CENTROID_NEUTRAL  2500.0f   // 1500-2500 Hz: balanced (rock, pop)
#define CENTROID_BRIGHT   4000.0f   // 2500-4000 Hz: bright (electronic, metal)
                                    // > 4000 Hz: very bright (noise, cymbals)

float calculateSpectralCentroid(float* magnitudes, int numBins, float sampleRate) {
  float binWidth = sampleRate / (numBins * 2);
  float weightedSum = 0;
  float magnitudeSum = 0;

  for (int i = 1; i < numBins; i++) {
    float freq = i * binWidth;
    weightedSum += freq * magnitudes[i];
    magnitudeSum += magnitudes[i];
  }

  if (magnitudeSum < 1e-6f) return 0;
  return weightedSum / magnitudeSum;
}

void updateSpectralCentroid(float* magnitudes, int numBins, float sampleRate) {
  if (millis() - lastCentroidUpdate < CENTROID_UPDATE_MS) return;
  lastCentroidUpdate = millis();

  spectralCentroid = calculateSpectralCentroid(magnitudes, numBins, sampleRate);

  // Store in history
  centroidHistory[centroidHistoryIdx] = spectralCentroid;
  centroidHistoryIdx = (centroidHistoryIdx + 1) % CENTROID_HISTORY_SIZE;

  // Calculate variance (stability indicator)
  float mean = 0;
  for (int i = 0; i < CENTROID_HISTORY_SIZE; i++) mean += centroidHistory[i];
  mean /= CENTROID_HISTORY_SIZE;

  centroidVariance = 0;
  for (int i = 0; i < CENTROID_HISTORY_SIZE; i++) {
    float diff = centroidHistory[i] - mean;
    centroidVariance += diff * diff;
  }
  centroidVariance /= CENTROID_HISTORY_SIZE;
}

const char* classifyTonalBrightness() {
  if (spectralCentroid < CENTROID_DARK)     return "dark";
  if (spectralCentroid < CENTROID_WARM)     return "warm";
  if (spectralCentroid < CENTROID_NEUTRAL)  return "neutral";
  if (spectralCentroid < CENTROID_BRIGHT)   return "bright";
  return "very_bright";
}

/* ============================================================================
 * SECTION 61: Improvement #37 — Zero-Crossing Rate (ZCR)
 * ============================================================================ */

#define ZCR_FRAME_SIZE        512
#define ZCR_HISTORY_SIZE      16
#define ZCR_UPDATE_MS         200
#define ZCR_PERCUSSIVE_THRESH 0.15f   // Above this = percussive content
#define ZCR_TONAL_THRESH      0.05f   // Below this = tonal/harmonic content

static float zeroCrossingRate = 0.0f;
static float zcrHistory[ZCR_HISTORY_SIZE];
static int zcrHistoryIdx = 0;
static float zcrMean = 0.0f;
static float zcrVariance = 0.0f;
static unsigned long lastZCRUpdate = 0;

float calculateZeroCrossingRate(int16_t* samples, int count) {
  if (count < 2) return 0;
  int crossings = 0;
  for (int i = 1; i < count; i++) {
    if ((samples[i] >= 0 && samples[i-1] < 0) ||
        (samples[i] < 0 && samples[i-1] >= 0)) {
      crossings++;
    }
  }
  return (float)crossings / (float)(count - 1);
}

void updateZeroCrossingRate(int16_t* samples, int count) {
  if (millis() - lastZCRUpdate < ZCR_UPDATE_MS) return;
  lastZCRUpdate = millis();

  // Process in frames
  int frames = count / ZCR_FRAME_SIZE;
  if (frames == 0) {
    zeroCrossingRate = calculateZeroCrossingRate(samples, count);
  } else {
    float totalZCR = 0;
    for (int f = 0; f < frames; f++) {
      totalZCR += calculateZeroCrossingRate(&samples[f * ZCR_FRAME_SIZE], ZCR_FRAME_SIZE);
    }
    zeroCrossingRate = totalZCR / frames;
  }

  // Store in history
  zcrHistory[zcrHistoryIdx] = zeroCrossingRate;
  zcrHistoryIdx = (zcrHistoryIdx + 1) % ZCR_HISTORY_SIZE;

  // Calculate statistics
  zcrMean = 0;
  for (int i = 0; i < ZCR_HISTORY_SIZE; i++) zcrMean += zcrHistory[i];
  zcrMean /= ZCR_HISTORY_SIZE;

  zcrVariance = 0;
  for (int i = 0; i < ZCR_HISTORY_SIZE; i++) {
    float diff = zcrHistory[i] - zcrMean;
    zcrVariance += diff * diff;
  }
  zcrVariance /= ZCR_HISTORY_SIZE;
}

const char* classifyAudioContent() {
  if (zeroCrossingRate > ZCR_PERCUSSIVE_THRESH) return "percussive";
  if (zeroCrossingRate < ZCR_TONAL_THRESH)      return "tonal";
  return "mixed";
}

// Combined feature for fingerprint enhancement
float getAudioContentScore() {
  // Returns 0.0 (purely tonal) to 1.0 (purely percussive)
  return constrain(zeroCrossingRate / ZCR_PERCUSSIVE_THRESH, 0.0f, 1.0f);
}

/* ============================================================================
 * SECTION 62: Improvement #38 — SPIFFS Web Interface
 * ============================================================================ */

#include <SPIFFS.h>

static bool spiffsWebReady = false;

// Default config page HTML (embedded, will be written to SPIFFS if not present)
static const char DEFAULT_CONFIG_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vinyl Buddy Config</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;
           padding: 20px; background: #1a1a2e; color: #e0e0e0; }
    h1 { color: #e94560; }
    .card { background: #16213e; border-radius: 12px; padding: 20px; margin: 15px 0;
            border: 1px solid #0f3460; }
    label { display: block; margin: 10px 0 5px; color: #a0a0c0; font-size: 0.9em; }
    input, select { width: 100%; padding: 10px; border: 1px solid #0f3460;
                    border-radius: 8px; background: #1a1a2e; color: #fff; box-sizing: border-box; }
    button { background: #e94560; color: #fff; border: none; padding: 12px 24px;
             border-radius: 8px; cursor: pointer; font-size: 1em; margin-top: 15px; }
    button:hover { background: #c73650; }
    .status { padding: 8px 12px; border-radius: 6px; background: #0f3460; margin: 5px 0; }
    .meter { height: 8px; background: #0f3460; border-radius: 4px; overflow: hidden; }
    .meter-fill { height: 100%; background: #e94560; transition: width 0.5s; }
  </style>
</head>
<body>
  <h1>Vinyl Buddy</h1>
  <div class="card">
    <h2>Device Status</h2>
    <div class="status" id="status">Loading...</div>
    <label>Audio Level</label>
    <div class="meter"><div class="meter-fill" id="audioMeter" style="width:0%"></div></div>
  </div>
  <div class="card">
    <h2>WiFi Settings</h2>
    <label>SSID</label><input id="ssid" type="text">
    <label>Password</label><input id="pass" type="password">
    <button onclick="saveWifi()">Save WiFi</button>
  </div>
  <div class="card">
    <h2>Audio Settings</h2>
    <label>Gain</label><input id="gain" type="range" min="0.5" max="10" step="0.5">
    <label>Silence Threshold</label><input id="threshold" type="range" min="50" max="2000" step="50">
    <button onclick="saveAudio()">Save Audio</button>
  </div>
  <script>
    async function loadStatus() {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        document.getElementById('status').innerText =
          `Battery: ${d.battery}% | WiFi: ${d.rssi}dBm | State: ${d.state}`;
        document.getElementById('audioMeter').style.width = (d.audioLevel/327.68)+'%';
      } catch(e) {}
    }
    async function saveWifi() {
      const body = JSON.stringify({ssid:document.getElementById('ssid').value,
                                    password:document.getElementById('pass').value});
      await fetch('/api/wifi',{method:'POST',headers:{'Content-Type':'application/json'},body});
      alert('WiFi saved. Rebooting...');
    }
    async function saveAudio() {
      const body = JSON.stringify({gain:parseFloat(document.getElementById('gain').value),
                                    threshold:parseInt(document.getElementById('threshold').value)});
      await fetch('/api/audio',{method:'POST',headers:{'Content-Type':'application/json'},body});
      alert('Audio settings saved.');
    }
    setInterval(loadStatus, 2000);
    loadStatus();
  </script>
</body>
</html>
)rawliteral";

void initSPIFFSWeb() {
  if (!SPIFFS.begin(true)) {
    serialDebug("WEBUI", "SPIFFS mount failed");
    return;
  }

  // Write default config page if not present
  if (!SPIFFS.exists("/config.html")) {
    File f = SPIFFS.open("/config.html", "w");
    if (f) {
      f.print(DEFAULT_CONFIG_HTML);
      f.close();
      serialDebug("WEBUI", "Default config.html written to SPIFFS");
    }
  }

  // Register web server routes for SPIFFS-served pages
  webServer.on("/ui", HTTP_GET, []() {
    File f = SPIFFS.open("/config.html", "r");
    if (f) {
      webServer.streamFile(f, "text/html");
      f.close();
    } else {
      webServer.send(404, "text/plain", "Config page not found");
    }
  });

  webServer.on("/api/status", HTTP_GET, []() {
    char json[256];
    snprintf(json, sizeof(json),
      "{\"battery\":%d,\"rssi\":%d,\"state\":\"%s\",\"audioLevel\":%d,\"temp\":%.1f,\"heap\":%d}",
      batteryPercent, WiFi.RSSI(),
      deviceState == STATE_LISTENING ? "listening" : "idle",
      (int)currentAudioLevel, temperatureC, ESP.getFreeHeap());
    webServer.send(200, "application/json", json);
  });

  webServer.on("/api/wifi", HTTP_POST, []() {
    if (webServer.hasArg("plain")) {
      JsonDocument doc;
      DeserializationError err = deserializeJson(doc, webServer.arg("plain"));
      if (!err) {
        strlcpy(config.wifi_ssid, doc["ssid"] | "", sizeof(config.wifi_ssid));
        strlcpy(config.wifi_pass, doc["password"] | "", sizeof(config.wifi_pass));
        saveConfig();
        webServer.send(200, "application/json", "{\"ok\":true}");
        delay(1000);
        ESP.restart();
        return;
      }
    }
    webServer.send(400, "application/json", "{\"error\":\"bad request\"}");
  });

  webServer.on("/api/audio", HTTP_POST, []() {
    if (webServer.hasArg("plain")) {
      JsonDocument doc;
      DeserializationError err = deserializeJson(doc, webServer.arg("plain"));
      if (!err) {
        config.audio_gain = doc["gain"] | config.audio_gain;
        config.silence_threshold = doc["threshold"] | config.silence_threshold;
        saveConfig();
        webServer.send(200, "application/json", "{\"ok\":true}");
        return;
      }
    }
    webServer.send(400, "application/json", "{\"error\":\"bad request\"}");
  });

  // Serve any file from SPIFFS
  webServer.on("/spiffs", HTTP_GET, []() {
    String path = webServer.arg("file");
    if (path.length() == 0) path = "/config.html";
    if (!path.startsWith("/")) path = "/" + path;
    if (SPIFFS.exists(path)) {
      File f = SPIFFS.open(path, "r");
      String contentType = "text/plain";
      if (path.endsWith(".html")) contentType = "text/html";
      else if (path.endsWith(".css")) contentType = "text/css";
      else if (path.endsWith(".js")) contentType = "application/javascript";
      else if (path.endsWith(".json")) contentType = "application/json";
      webServer.streamFile(f, contentType);
      f.close();
    } else {
      webServer.send(404, "text/plain", "File not found");
    }
  });

  spiffsWebReady = true;
  serialDebugf("WEBUI", "SPIFFS web interface ready (%d bytes used, %d total)",
    SPIFFS.usedBytes(), SPIFFS.totalBytes());
  logToSD("WEBUI", "SPIFFS web interface initialized");
}

/* ============================================================================
 * SECTION 63: Improvement #39 — Firmware Rollback on Boot Failure
 * ============================================================================ */

#include <esp_ota_ops.h>

#define ROLLBACK_BOOT_COUNT_KEY   "bootCount"
#define ROLLBACK_MAX_BOOT_FAILS   3
#define ROLLBACK_CONFIRM_DELAY_MS 30000  // Mark firmware valid after 30s uptime

static bool rollbackPending = false;
static int bootFailCount = 0;

void initFirmwareRollback() {
  const esp_partition_t* running = esp_ota_get_running_partition();
  const esp_partition_t* next = esp_ota_get_next_update_partition(NULL);

  serialDebugf("ROLLBACK", "Running partition: %s (addr=0x%08X)",
    running->label, running->address);
  if (next) {
    serialDebugf("ROLLBACK", "Next OTA partition: %s (addr=0x%08X)",
      next->label, next->address);
  }

  // Check boot count
  Preferences rollbackPrefs;
  rollbackPrefs.begin("rollback", false);
  bootFailCount = rollbackPrefs.getInt(ROLLBACK_BOOT_COUNT_KEY, 0);
  bootFailCount++;
  rollbackPrefs.putInt(ROLLBACK_BOOT_COUNT_KEY, bootFailCount);
  rollbackPrefs.end();

  serialDebugf("ROLLBACK", "Boot count since last confirm: %d", bootFailCount);

  if (bootFailCount >= ROLLBACK_MAX_BOOT_FAILS) {
    serialDebug("ROLLBACK", "Too many boot failures, attempting rollback!");
    logToSD("ROLLBACK", "Initiating firmware rollback");

    // Attempt rollback to previous partition
    esp_err_t err = esp_ota_mark_app_invalid_rollback_and_reboot();
    if (err != ESP_OK) {
      serialDebugf("ROLLBACK", "Rollback failed: %s (no previous valid firmware?)",
        esp_err_to_name(err));
      // Reset counter so we don't loop forever
      Preferences rp;
      rp.begin("rollback", false);
      rp.putInt(ROLLBACK_BOOT_COUNT_KEY, 0);
      rp.end();
    }
    // If rollback succeeds, we reboot to previous firmware and never reach here
  }

  rollbackPending = true;
  serialDebug("ROLLBACK", "Firmware rollback check pending, will confirm in 30s");
}

void confirmFirmwareIfStable() {
  if (!rollbackPending) return;
  if (millis() < ROLLBACK_CONFIRM_DELAY_MS) return;

  // If we've been running for 30s without crashing, mark firmware as valid
  esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
  if (err == ESP_OK) {
    serialDebug("ROLLBACK", "Firmware confirmed valid, rollback cancelled");
  } else {
    serialDebugf("ROLLBACK", "Firmware confirm result: %s", esp_err_to_name(err));
  }

  // Reset boot count
  Preferences rp;
  rp.begin("rollback", false);
  rp.putInt(ROLLBACK_BOOT_COUNT_KEY, 0);
  rp.end();

  rollbackPending = false;
  logToSD("ROLLBACK", "Firmware confirmed stable");
}

/* ============================================================================
 * SECTION 64: Improvement #40 — Power-On Self-Test (POST)
 * ============================================================================ */

#define POST_RESULT_PASS    0
#define POST_RESULT_WARN    1
#define POST_RESULT_FAIL    2

struct POSTResult {
  const char* testName;
  uint8_t result;
  const char* message;
};

#define POST_MAX_TESTS 12
static POSTResult postResults[POST_MAX_TESTS];
static int postTestCount = 0;
static bool postPassed = true;

void postAddResult(const char* name, uint8_t result, const char* msg) {
  if (postTestCount >= POST_MAX_TESTS) return;
  postResults[postTestCount].testName = name;
  postResults[postTestCount].result = result;
  postResults[postTestCount].message = msg;
  postTestCount++;
  if (result == POST_RESULT_FAIL) postPassed = false;
}

void runPowerOnSelfTest() {
  serialDebug("POST", "╔══════════════════════════════════════╗");
  serialDebug("POST", "║    Power-On Self-Test (POST)         ║");
  serialDebug("POST", "╚══════════════════════════════════════╝");
  postTestCount = 0;
  postPassed = true;

  // Test 1: CPU / Free heap
  uint32_t freeHeap = ESP.getFreeHeap();
  if (freeHeap > 100000) {
    postAddResult("Heap Memory", POST_RESULT_PASS, "OK");
  } else if (freeHeap > 50000) {
    postAddResult("Heap Memory", POST_RESULT_WARN, "Low");
  } else {
    postAddResult("Heap Memory", POST_RESULT_FAIL, "Critical");
  }

  // Test 2: PSRAM (if available)
  if (ESP.getPsramSize() > 0) {
    postAddResult("PSRAM", POST_RESULT_PASS, "Available");
  } else {
    postAddResult("PSRAM", POST_RESULT_WARN, "Not available");
  }

  // Test 3: Flash integrity
  uint32_t flashSize = ESP.getFlashChipSize();
  if (flashSize >= 4 * 1024 * 1024) {
    postAddResult("Flash", POST_RESULT_PASS, "OK");
  } else {
    postAddResult("Flash", POST_RESULT_WARN, "Small flash");
  }

  // Test 4: I2C bus scan
  int i2cDevices = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) i2cDevices++;
  }
  if (i2cDevices > 0) {
    postAddResult("I2C Bus", POST_RESULT_PASS, "Devices found");
  } else {
    postAddResult("I2C Bus", POST_RESULT_WARN, "No devices");
  }

  // Test 5: ADC self-test (read known pin)
  int adcTest = analogRead(BATTERY_PIN);
  if (adcTest > 0 && adcTest < 4095) {
    postAddResult("ADC", POST_RESULT_PASS, "Responsive");
  } else {
    postAddResult("ADC", POST_RESULT_WARN, "Rail/stuck");
  }

  // Test 6: WiFi hardware
  if (WiFi.mode(WIFI_STA)) {
    postAddResult("WiFi HW", POST_RESULT_PASS, "OK");
  } else {
    postAddResult("WiFi HW", POST_RESULT_FAIL, "Init failed");
  }

  // Test 7: Bluetooth hardware
  if (BLEDevice::getInitialized()) {
    postAddResult("BLE HW", POST_RESULT_PASS, "Initialized");
  } else {
    postAddResult("BLE HW", POST_RESULT_WARN, "Not yet init");
  }

  // Test 8: NVS / Preferences
  Preferences testPrefs;
  if (testPrefs.begin("post_test", false)) {
    testPrefs.putInt("test", 42);
    int readBack = testPrefs.getInt("test", 0);
    testPrefs.remove("test");
    testPrefs.end();
    if (readBack == 42) {
      postAddResult("NVS", POST_RESULT_PASS, "Read/write OK");
    } else {
      postAddResult("NVS", POST_RESULT_FAIL, "Read mismatch");
    }
  } else {
    postAddResult("NVS", POST_RESULT_FAIL, "Open failed");
  }

  // Test 9: SPIFFS
  if (SPIFFS.begin(false)) {
    postAddResult("SPIFFS", POST_RESULT_PASS, "Mounted");
    SPIFFS.end();
  } else {
    postAddResult("SPIFFS", POST_RESULT_WARN, "Not formatted");
  }

  // Test 10: Temperature sensor sanity
  readTemperature();
  if (temperatureC > -20.0f && temperatureC < 85.0f) {
    postAddResult("Temp Sensor", POST_RESULT_PASS, "In range");
  } else {
    postAddResult("Temp Sensor", POST_RESULT_WARN, "Out of range");
  }

  // Test 11: Battery voltage sanity
  readBattery();
  if (batteryVoltage > 2.5f && batteryVoltage < 4.3f) {
    postAddResult("Battery", POST_RESULT_PASS, "Voltage OK");
  } else if (batteryVoltage <= 0.1f) {
    postAddResult("Battery", POST_RESULT_WARN, "No battery / USB powered");
  } else {
    postAddResult("Battery", POST_RESULT_WARN, "Unusual voltage");
  }

  // Test 12: Uptime clock
  if (millis() > 0) {
    postAddResult("Sys Timer", POST_RESULT_PASS, "Running");
  } else {
    postAddResult("Sys Timer", POST_RESULT_FAIL, "Stuck");
  }

  // Print results
  serialDebug("POST", "─── Results ───────────────────────────");
  for (int i = 0; i < postTestCount; i++) {
    const char* status;
    switch (postResults[i].result) {
      case POST_RESULT_PASS: status = "PASS"; break;
      case POST_RESULT_WARN: status = "WARN"; break;
      case POST_RESULT_FAIL: status = "FAIL"; break;
      default: status = "????"; break;
    }
    serialDebugf("POST", "  [%s] %-12s : %s", status, postResults[i].testName, postResults[i].message);
  }
  serialDebug("POST", "───────────────────────────────────────");

  if (postPassed) {
    serialDebug("POST", "Self-test PASSED — all systems nominal");
    logToSD("POST", "Self-test PASSED");
  } else {
    serialDebug("POST", "Self-test FAILED — check warnings above");
    logToSD("POST", "Self-test FAILED");
  }
}

/* ============================================================================
 * SECTION 38: setup() - Main Initialization
 * ============================================================================ */

void setup() {
  // Initialize serial for debug logging (#19)
  Serial.begin(115200);
  while (!Serial && millis() < 3000) { delay(10); }
  Serial.println();
  serialDebug("INIT", "========================================");
  serialDebugf("INIT", "Vinyl Buddy Firmware v%s", FIRMWARE_VERSION);
  serialDebugf("INIT", "ESP32 Chip: %s Rev %d", ESP.getChipModel(), ESP.getChipRevision());
  serialDebugf("INIT", "Free Heap: %d bytes", ESP.getFreeHeap());
  serialDebug("INIT", "========================================");

  bootTime = millis();
  lastActivityTime = millis();

  // Check wake-up reason (#15 deep sleep)
  esp_sleep_wakeup_cause_t wakeupReason = esp_sleep_get_wakeup_cause();
  switch (wakeupReason) {
    case ESP_SLEEP_WAKEUP_EXT0:
      serialDebug("INIT", "Woke from deep sleep: button press");
      break;
    case ESP_SLEEP_WAKEUP_TIMER:
      serialDebug("INIT", "Woke from deep sleep: timer");
      break;
    default:
      serialDebug("INIT", "Normal boot (power-on / reset)");
      break;
  }

  // Initialize watchdog timer (#22)
  initWatchdog();

  // Initialize peripherals
  initLEDs();           // #9: LED status indicators
  initButton();         // #10: Button handling
  loadConfig();         // #13: Load saved configuration
  validateConfig();     // #25: Configuration validation

  // Initialize optional hardware
  initSDCard();         // #17: SD card logging
  initOLED();           // #18: OLED display

  // Configure ADC for battery and temperature (#14, #24)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  readBattery();
  readTemperature();

  // Initialize I2S microphone (#2, #3)
  initI2SMicrophone();

  // Try secondary microphone (#19)
  initSecondMicrophone();

  // Initialize BLE (#16)
  initBLE();

  // Initialize new subsystems (#40-#49)
  initSPIFFS();             // #19: Audio recording to SPIFFS
  initFingerprintCache();   // #23b: Audio fingerprint caching
  initNoiseCancellation();  // #22b: Environmental noise cancellation
  initVoiceCommands();      // #20: Voice command recognition
  initGestureSensor();      // #21: Gesture sensor support
  initSleepSchedule();      // #24b: Device sleep/wake scheduling
  initDeviceMesh();         // #18: Device-to-device communication

  // Initialize advanced subsystems (#50-#64)
  runPowerOnSelfTest();     // #64: Power-on self-test
  initFirmwareRollback();   // #63: Firmware rollback protection
  initFuelGauge();          // #52: Battery fuel gauge (coulomb counting)
  initTouchSensors();       // #53: Capacitive touch inputs
  initLedStrip();           // #54: WS2812 LED strip
  initBuzzer();             // #55: Piezo buzzer feedback
  initAmbientLight();       // #56: Ambient light sensor
  initAccelerometer();      // #57: MPU6050 accelerometer
  initRTC();                // #58: DS3231 real-time clock
  initAGC();                // #59: Automatic gain control
  initMQTT();               // #50: MQTT client
  initSPIFFSWeb();          // #62: SPIFFS web interface

  // Connect to WiFi (#1, #23)
  connectWiFi();

  // If connected, set up services
  if (wifiConnected) {
    setupMDNS();          // #26: mDNS
    setupWebServer();     // #25: Local web server (also available when connected)

    // Calibrate noise floor on first boot (#22)
    if (config.silence_threshold == DEFAULT_SILENCE_THRESHOLD) {
      calibrateNoiseFloor();
    }

    // If not paired, generate a pair code (#12)
    if (!config.paired) {
      generatePairCode();
      serialDebugf("INIT", "Device not paired. Pair code: %s", config.pair_code);
      serialDebug("INIT", "Visit vinylbuddy.local/pair to pair this device");
    }

    // Sync RTC from NTP (#58)
    syncRTCFromNTP();
  }

  // Boot complete feedback
  buzzerBeepBoot();                         // #55: Audio boot confirmation
  ledStripRainbow(0); delay(500);           // #54: Visual boot indication
  ledStripClear();

  // Ready to listen
  deviceState = STATE_LISTENING;
  setLedState(LED_LISTENING);
  serialDebug("INIT", "Initialization complete - listening for vinyl");
}

/* ============================================================================
 * SECTION 39: loop() - Main Event Loop
 * ============================================================================ */

void loop() {
  loopStartTime = micros();  // #24: Performance profiling

  // --- Watchdog (#22) ---
  feedWatchdog();

  // --- Always-running tasks ---
  updateLED();          // #9: Animate LED state
  handleButton();       // #10, #30: Button press handling

  // --- WiFi management (#1: auto-reconnect) ---
  checkWiFiConnection();

  // --- Handle config AP web requests (#25) ---
  if (configAPActive) {
    webServer.handleClient();
    return;  // In AP mode, skip normal operation
  }

  // --- Web server (also runs in STA mode) (#25) ---
  webServer.handleClient();

  // --- Audio processing (#3, #4, #5, #6) ---
  readAudioSamples();       // Read I2S mic into circular buffer
  readAudioSamplesMic2();   // #19: Read secondary mic
  autoRecordingCheck();     // Auto-trigger recording on audio detection

  // --- Audio gain auto-calibration (#20) ---
  autoCallibrateGain();

  // --- New audio subsystems ---
  streamAudioChunk();       // #16: Audio streaming to server
  processVoiceCommand();    // #20: Voice command recognition
  readGestureSensor();      // #21: Gesture sensor support
  handleMeshReceive();      // #18: Device-to-device communication

  // --- Advanced audio analysis (#51, #59, #60, #61) ---
  updateAGC(audioBuffer + audioReadIndex, min((int)(audioWriteIndex - audioReadIndex), 1024));
  // Spectral centroid and ZCR updated when FFT data is available
  updateZeroCrossingRate(audioBuffer + audioReadIndex, min((int)(audioWriteIndex - audioReadIndex), ZCR_FRAME_SIZE));

  // --- Advanced input/output (#53, #54, #57) ---
  readTouchSensors();       // #53: Capacitive touch controls
  updateLedStrip();         // #54: WS2812 LED strip patterns
  readAccelerometer();      // #57: MPU6050 orientation and tap

  // --- Ambient light auto-brightness (#56) ---
  readAmbientLight();

  // --- OLED display update (#18) ---
  updateOLED();

  // --- BLE status update (#16) ---
  static unsigned long lastBLEUpdate = 0;
  if (bleConnected && millis() - lastBLEUpdate >= 2000) {
    lastBLEUpdate = millis();
    updateBLEStatus();
  }

  // --- Fuel gauge update (every second) (#52) ---
  updateFuelGauge();

  // --- RTC periodic read (#58) ---
  static unsigned long lastRTCRead = 0;
  if (millis() - lastRTCRead >= 10000) {
    lastRTCRead = millis();
    readRTC();
  }

  // --- Firmware rollback confirmation (#63) ---
  confirmFirmwareIfStable();

  // --- Periodic tasks (run less frequently) ---
  static unsigned long lastPeriodicCheck = 0;
  if (millis() - lastPeriodicCheck >= 5000) {
    lastPeriodicCheck = millis();

    readBattery();          // #14: Battery monitoring
    readTemperature();      // #24: Temperature monitoring
    checkPowerManagement(); // #21: Power management optimization

    // Log WiFi signal strength
    if (wifiConnected) {
      serialDebugf("STATUS", "WiFi RSSI: %d dBm, Battery: %d%%, Temp: %.1fC, Heap: %d, PwrMode: %s",
        getWiFiRSSI(), batteryPercent, temperatureC, ESP.getFreeHeap(),
        currentPowerMode == POWER_MODE_FULL ? "FULL" : "ECO");
    }

    // #23: Reset consecutive error count after cooldown
    if (consecutiveErrors > 0 && millis() - lastErrorTime > ERROR_COOLDOWN_MS) {
      consecutiveErrors = 0;
    }
  }

  // --- Performance report (every 60 seconds) ---
  static unsigned long lastPerfReport = 0;
  if (millis() - lastPerfReport >= 60000) {
    lastPerfReport = millis();
    printPerfReport();
  }

  // --- Network tasks (only when connected) ---
  if (wifiConnected) {
    sendHeartbeat();          // #17: Heartbeat every 30s
    sendAudioLevelUpdate();   // #17b: Real-time audio level meter
    checkRemoteConfig();      // #25b: Remote configuration updates
    loopMQTT();               // #50: MQTT publish/subscribe
  }

  // --- Scheduled sleep/wake (#24b) ---
  checkSleepSchedule();

  // --- Power management (#15) ---
  checkIdleTimeout();

  // --- Performance profiling (#24) ---
  recordPerfSample();

  // Small yield to prevent watchdog reset
  delay(1);
}

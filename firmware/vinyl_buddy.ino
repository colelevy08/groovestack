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
 * SECTION 28: setup() - Main Initialization
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

  // Initialize peripherals
  initLEDs();           // #9: LED status indicators
  initButton();         // #10: Button handling
  loadConfig();         // #13: Load saved configuration

  // Configure ADC for battery and temperature (#14, #24)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  readBattery();
  readTemperature();

  // Initialize I2S microphone (#2, #3)
  initI2SMicrophone();

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
  }

  // Ready to listen
  deviceState = STATE_LISTENING;
  setLedState(LED_LISTENING);
  serialDebug("INIT", "Initialization complete - listening for vinyl");
}

/* ============================================================================
 * SECTION 29: loop() - Main Event Loop
 * ============================================================================ */

void loop() {
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
  autoRecordingCheck();     // Auto-trigger recording on audio detection

  // --- Periodic tasks (run less frequently) ---
  static unsigned long lastPeriodicCheck = 0;
  if (millis() - lastPeriodicCheck >= 5000) {
    lastPeriodicCheck = millis();

    readBattery();          // #14: Battery monitoring
    readTemperature();      // #24: Temperature monitoring

    // #16: Log WiFi signal strength
    if (wifiConnected) {
      serialDebugf("STATUS", "WiFi RSSI: %d dBm, Battery: %d%%, Temp: %.1fC, Heap: %d",
        getWiFiRSSI(), batteryPercent, temperatureC, ESP.getFreeHeap());
    }
  }

  // --- Network tasks (only when connected) ---
  if (wifiConnected) {
    sendHeartbeat();        // #17: Heartbeat every 30s
  }

  // --- Power management (#15) ---
  checkIdleTimeout();

  // Small yield to prevent watchdog reset
  delay(1);
}

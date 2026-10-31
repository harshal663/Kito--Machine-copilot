#pragma once

#if __has_include("secrets.h")
#include "secrets.h"
#elif __has_include("secrets.example.h")
#include "secrets.example.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "Demo_WiFi"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "DemoPassword123"
#endif

#ifndef API_HOST
#define API_HOST "api.machine-copilot.example.com"
#endif

#ifndef API_PORT
#define API_PORT 443
#endif

#ifndef DEVICE_ID
#define DEVICE_ID "dev_01HZX3K2M9V4Q8R7T1Y6N0P5CB"
#endif

#ifndef MACHINE_ID
#define MACHINE_ID "mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB"
#endif

#ifndef DEVICE_KEY
#define DEVICE_KEY "dk_ChangeMeTo32BytesBase64SecretKeyHere12"
#endif

// Sampling configuration
constexpr int FS_HZ = 1000;
constexpr int N_SAMPLES = 512;
constexpr int SAMPLE_INTERVAL_MICROS = 1000; // 1 ms
constexpr int BURST_INTERVAL_MS = 10000;      // 10 s

// Anomaly detection parameters
constexpr int LEARNING_WINDOWS = 18;          // 18 windows x 10s = 180s calibration
constexpr float K_SIGMA = 3.0f;
constexpr int M_CONSECUTIVE_WINDOWS = 3;
constexpr float IDLE_RMS_G = 0.05f;

// Hardware pins
constexpr int PIN_I2C_SDA = 21;
constexpr int PIN_I2C_SCL = 22;

// Heartbeat & Buffers
constexpr unsigned long HEARTBEAT_INTERVAL_MS = 300000UL; // 300 s
constexpr int RING_BUFFER_CAPACITY = 50;
constexpr int MAX_JSON_BUF = 512;
constexpr int MAX_PEAKS = 5;
constexpr int MIN_PEAK_BIN = 2;               // Skip DC and bin 1
constexpr int MAX_PEAK_BIN = (N_SAMPLES / 2) - 1; // Bin 255

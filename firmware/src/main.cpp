#ifdef ARDUINO
#include <Arduino.h>
#include <WiFi.h>
#include "config.h"
#include "sampler.h"
#include "fft_analyzer.h"
#include "baseline.h"
#include "detector.h"
#include "telemetry_client.h"

enum class NodeState {
    BOOT,
    CONNECTING_WIFI,
    LEARNING,
    MONITORING,
};

static NodeState current_state = NodeState::BOOT;
static Sampler sampler;
static FftAnalyzer fft_analyzer;
static BaselineTracker baseline(LEARNING_WINDOWS);
static AnomalyDetector detector(K_SIGMA, M_CONSECUTIVE_WINDOWS, IDLE_RMS_G);
static TelemetryClient telemetry(DEVICE_ID, DEVICE_KEY);

static float sample_buffer[N_SAMPLES];
static SpectralPeak top_peaks[MAX_PEAKS];
static char rule_hints[3][64];
static char json_buffer[MAX_JSON_BUF];

static uint32_t telemetry_seq = 1;
static unsigned long last_burst_time = 0;
static unsigned long last_heartbeat_time = 0;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("INFO: Machine Copilot ESP32 Sensor Node starting...");

#ifdef DEV_INSECURE_TLS
    Serial.println("WARN: DEV_INSECURE_TLS is active. Insecure TLS enabled for bench testing only!");
#endif

    // Initialize Accelerometer
    SamplerStatus status = sampler.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (status != SamplerStatus::OK) {
        Serial.println("ERR: E_I2C_INIT_FAILED - could not communicate with MPU6050");
    } else {
        Serial.println("INFO: MPU6050 configured (+/-4g, 1kHz DLPF 184Hz)");
    }

    // Connect to Wi-Fi
    current_state = NodeState::CONNECTING_WIFI;
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("INFO: Connecting to Wi-Fi SSID '%s'...\n", WIFI_SSID);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("INFO: Wi-Fi connected. IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("WARN: Wi-Fi connection timed out. Will operate in offline queue mode.");
    }

    current_state = NodeState::LEARNING;
    Serial.printf("STATE: LEARNING baseline across %d windows (180s)...\n", LEARNING_WINDOWS);
}

void loop() {
    unsigned long now = millis();

    // 1. Periodic Heartbeat (every 300 seconds)
    if (now - last_heartbeat_time >= HEARTBEAT_INTERVAL_MS) {
        last_heartbeat_time = now;
        uint32_t uptime_s = now / 1000UL;
        int rssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -99;

        TelemetryClient::serialize_heartbeat_json(
            json_buffer,
            sizeof(json_buffer),
            DEVICE_ID,
            telemetry_seq++,
            uptime_s,
            100, // 100% (mains/USB powered)
            rssi
        );

        if (WiFi.status() == WL_CONNECTED) {
            telemetry.send_post("/v1/telemetry/heartbeat", json_buffer);
            Serial.printf("LOG: OK_HEARTBEAT seq=%u uptime=%us rssi=%d\n", telemetry_seq - 1, uptime_s, rssi);
        }
    }

    // 2. Periodic Sampling Burst (every 10 seconds)
    if (now - last_burst_time >= BURST_INTERVAL_MS) {
        last_burst_time = now;

        SamplerStatus sample_res = sampler.read_burst(sample_buffer, N_SAMPLES);
        if (sample_res != SamplerStatus::OK) {
            Serial.println("ERR: E_I2C_NACK during sampling burst");
            return;
        }

        float rms_g = 0.0f;
        int peak_count = fft_analyzer.analyze(
            sample_buffer,
            N_SAMPLES,
            FS_HZ,
            &rms_g,
            top_peaks,
            MAX_PEAKS
        );

        if (current_state == NodeState::LEARNING) {
            baseline.update_learning(rms_g);
            Serial.printf(
                "LOG: OK_LEARNING window=%d/%d rms=%.3fg baseline_mean=%.3fg\n",
                baseline.get_window_count(),
                LEARNING_WINDOWS,
                rms_g,
                baseline.get_mean()
            );

            if (baseline.is_calibrated()) {
                current_state = NodeState::MONITORING;
                Serial.printf(
                    "STATE: MONITORING calibrated mean=%.3fg std=%.4fg threshold=%.3fg\n",
                    baseline.get_mean(),
                    baseline.get_std(),
                    baseline.get_mean() + K_SIGMA * baseline.get_std()
                );
            }
        } else if (current_state == NodeState::MONITORING) {
            float z_score = 0.0f;
            AnomalyDecision decision = detector.evaluate(rms_g, baseline.get_state(), &z_score);

            if (decision == AnomalyDecision::IDLE) {
                Serial.printf("LOG: OK_IDLE rms=%.3fg (machine inactive)\n", rms_g);
            } else if (decision == AnomalyDecision::NORMAL) {
                baseline.update_monitoring(rms_g, z_score);
                Serial.printf("LOG: OK_MONITORING rms=%.3fg z=+%.1f\n", rms_g, z_score);
            } else if (decision == AnomalyDecision::EVALUATING) {
                Serial.printf(
                    "LOG: EVALUATING_PERSISTENCE count=%d/%d rms=%.3fg z=+%.1f\n",
                    detector.get_consecutive_count(),
                    M_CONSECUTIVE_WINDOWS,
                    rms_g,
                    z_score
                );
            } else if (decision == AnomalyDecision::ANOMALY_CONFIRMED) {
                // Generate rule hints
                int hint_count = AnomalyDetector::generate_hints(
                    top_peaks,
                    peak_count,
                    1465.0f, // Demo default rated RPM
                    rule_hints,
                    3
                );

                // Serialize payload
                TelemetryClient::serialize_telemetry_json(
                    json_buffer,
                    sizeof(json_buffer),
                    DEVICE_ID,
                    telemetry_seq++,
                    "2026-10-24T12:00:00Z", // Timestamp from RTC/NTP or local
                    rms_g,
                    baseline.get_state(),
                    z_score,
                    top_peaks,
                    peak_count,
                    rule_hints,
                    hint_count
                );

                Serial.printf("ALARM: ANOMALY_CONFIRMED z=+%.1f seq=%u payload_len=%d\n", z_score, telemetry_seq - 1, (int)strlen(json_buffer));

                if (WiFi.status() == WL_CONNECTED) {
                    bool sent = telemetry.send_post("/v1/telemetry", json_buffer);
                    if (!sent) {
                        Serial.println("WARN: POST failed, event queued in ring buffer");
                    }
                }
            }
        }
    }

    delay(10);
}
#endif

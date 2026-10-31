#include <unity.h>
#include <cmath>
#include <cstring>
#include "fft_analyzer.h"
#include "baseline.h"
#include "detector.h"
#include "telemetry_client.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846f
#endif

void setUp(void) {}
void tearDown(void) {}

/**
 * Test 1: Radix-2 FFT Peak Identification on synthetic multi-tone signal.
 * Generates 1x (24.4 Hz, amp 0.35g) and 2x (48.8 Hz, amp 0.15g) at fs = 1000 Hz.
 */
void test_fft_peak_accuracy(void) {
    FftAnalyzer analyzer;
    float samples[512];
    constexpr int fs = 1000;
    constexpr int n = 512;

    // Synthesize: 0.35 * sin(2*pi*24.4*t) + 0.15 * sin(2*pi*48.8*t) + 0.05 * noise
    for (int i = 0; i < n; i++) {
        float t = (float)i / (float)fs;
        samples[i] = 0.35f * sinf(2.0f * (float)M_PI * 24.4f * t) +
                     0.15f * sinf(2.0f * (float)M_PI * 48.8f * t);
    }

    float rms = 0.0f;
    SpectralPeak peaks[5];
    int peak_count = analyzer.analyze(samples, n, fs, &rms, peaks, 5);

    TEST_ASSERT_GREATER_OR_EQUAL(2, peak_count);

    // Bin width = 1000 / 512 = ~1.953 Hz.
    // 24.4 Hz falls at bin ~12.5 (12 * 1.953 = 23.44 Hz or 13 * 1.953 = 25.39 Hz)
    TEST_ASSERT_FLOAT_WITHIN(2.5f, 24.4f, peaks[0].freq_hz);
    TEST_ASSERT_GREATER_THAN(0.10f, peaks[0].amp_g);

    // Second peak at ~48.8 Hz (bin ~25 = 48.83 Hz)
    TEST_ASSERT_FLOAT_WITHIN(3.0f, 48.8f, peaks[1].freq_hz);
}

/**
 * Test 2: Baseline calibration & convergence over learning windows.
 */
void test_baseline_calibration(void) {
    BaselineTracker tracker(18);
    TEST_ASSERT_FALSE(tracker.is_calibrated());

    // Feed 18 windows of healthy baseline around 0.120g
    for (int i = 0; i < 18; i++) {
        float val = 0.120f + (float)(i % 5 - 2) * 0.002f;
        tracker.update_learning(val);
    }

    TEST_ASSERT_TRUE(tracker.is_calibrated());
    TEST_ASSERT_EQUAL(18, tracker.get_window_count());
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.120f, tracker.get_mean());
    TEST_ASSERT_GREATER_THAN(0.0005f, tracker.get_std());
}

/**
 * Test 3: Z-score & M-consecutive-window persistence confirmation.
 */
void test_detector_persistence_and_idle(void) {
    AnomalyDetector detector(3.0f, 3, 0.05f);
    BaselineState baseline{0.120f, 0.020f, 18};
    float z_score = 0.0f;

    // Window 1: High vibration (0.45g -> z = (0.45 - 0.12)/0.02 = 16.5)
    AnomalyDecision d1 = detector.evaluate(0.45f, baseline, &z_score);
    TEST_ASSERT_EQUAL(AnomalyDecision::EVALUATING, d1);
    TEST_ASSERT_EQUAL(1, detector.get_consecutive_count());
    TEST_ASSERT_GREATER_THAN(15.0f, z_score);

    // Window 2: High vibration continues
    AnomalyDecision d2 = detector.evaluate(0.48f, baseline, &z_score);
    TEST_ASSERT_EQUAL(AnomalyDecision::EVALUATING, d2);
    TEST_ASSERT_EQUAL(2, detector.get_consecutive_count());

    // Window 3: Persistent 3rd window -> Anomaly confirmed!
    AnomalyDecision d3 = detector.evaluate(0.46f, baseline, &z_score);
    TEST_ASSERT_EQUAL(AnomalyDecision::ANOMALY_CONFIRMED, d3);
    TEST_ASSERT_EQUAL(3, detector.get_consecutive_count());

    // Normal window resets consecutive count
    AnomalyDecision d4 = detector.evaluate(0.125f, baseline, &z_score);
    TEST_ASSERT_EQUAL(AnomalyDecision::NORMAL, d4);
    TEST_ASSERT_EQUAL(0, detector.get_consecutive_count());

    // Idle window (< 0.05g) returns IDLE
    AnomalyDecision d_idle = detector.evaluate(0.02f, baseline, &z_score);
    TEST_ASSERT_EQUAL(AnomalyDecision::IDLE, d_idle);
    TEST_ASSERT_EQUAL(0, detector.get_consecutive_count());
}

/**
 * Test 4: JSON payload length constraints (<= 512 bytes).
 */
void test_json_payload_length_constraint(void) {
    char json_buf[512];
    BaselineState baseline{0.120f, 0.020f, 18};
    SpectralPeak peaks[5] = {
        {24.4f, 0.3521f},
        {48.8f, 0.1482f},
        {73.2f, 0.0811f},
        {97.6f, 0.0452f},
        {122.0f, 0.0312f},
    };
    char hints[3][64] = {
        "1x peak detected (24.4 Hz) - probable imbalance",
        "2x peak detected (48.8 Hz) - probable misalignment",
        "Harmonic peaks detected (3x/4x)",
    };

    int len = TelemetryClient::serialize_telemetry_json(
        json_buf,
        sizeof(json_buf),
        "dev_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        1001,
        "2026-10-24T12:00:00Z",
        0.452f,
        baseline,
        16.6f,
        peaks,
        5,
        hints,
        3
    );

    TEST_ASSERT_GREATER_THAN(100, len);
    TEST_ASSERT_LESS_OR_EQUAL(512, len);
    TEST_ASSERT_EQUAL(len, (int)strlen(json_buf));

    // Verify key fields are present
    TEST_ASSERT_NOT_NULL(strstr(json_buf, "\"device_id\":\"dev_01HZX3K2M9V4Q8R7T1Y6N0P5CB\""));
    TEST_ASSERT_NOT_NULL(strstr(json_buf, "\"rms_g\":0.452"));
    TEST_ASSERT_NOT_NULL(strstr(json_buf, "\"z_score\":16.6"));
    TEST_ASSERT_NOT_NULL(strstr(json_buf, "\"peaks\":["));
    TEST_ASSERT_NOT_NULL(strstr(json_buf, "\"hints\":["));
}

/**
 * Test 5: Rule-based hint generator.
 */
void test_hint_generation(void) {
    SpectralPeak peaks[2] = {
        {24.4f, 0.35f},
        {48.8f, 0.15f},
    };
    char hints[3][64];

    // Rated RPM 1465 -> f0 = 24.417 Hz
    int count = AnomalyDetector::generate_hints(peaks, 2, 1465.0f, hints, 3);
    TEST_ASSERT_GREATER_OR_EQUAL(1, count);
    TEST_ASSERT_NOT_NULL(strstr(hints[0], "1x peak detected"));
}

int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_fft_peak_accuracy);
    RUN_TEST(test_baseline_calibration);
    RUN_TEST(test_detector_persistence_and_idle);
    RUN_TEST(test_json_payload_length_constraint);
    RUN_TEST(test_hint_generation);
    return UNITY_END();
}

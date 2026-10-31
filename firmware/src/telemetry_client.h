#pragma once

#include <cstdint>
#include "fft_analyzer.h"
#include "baseline.h"

struct QueuedTelemetry {
    uint32_t seq;
    uint32_t uptime_s;
    float rms_g;
    BaselineState baseline;
    float z_score;
    SpectralPeak peaks[5];
    int peak_count;
    char hints[3][64];
    int hint_count;
};

/**
 * Telemetry formatting and queue manager.
 * Serializes payloads matching TelemetryIn schema (<= 512 bytes).
 */
class TelemetryClient {
public:
    TelemetryClient(const char* device_id, const char* device_key);

    /**
     * Serialize full anomaly event payload into destination buffer.
     * Guaranteed <= max_len bytes. Returns written length.
     */
    static int serialize_telemetry_json(
        char* dest,
        int max_len,
        const char* device_id,
        uint32_t seq,
        const char* iso_timestamp,
        float rms_g,
        const BaselineState& baseline,
        float z_score,
        const SpectralPeak* peaks,
        int peak_count,
        const char hints[][64],
        int hint_count
    );

    /**
     * Serialize heartbeat JSON payload into destination buffer.
     */
    static int serialize_heartbeat_json(
        char* dest,
        int max_len,
        const char* device_id,
        uint32_t seq,
        uint32_t uptime_s,
        int battery_pct,
        int rssi
    );

    // Ring buffer queue management
    bool enqueue_event(const QueuedTelemetry& item);
    bool dequeue_event(QueuedTelemetry* out_item);
    int get_queue_size() const { return queue_count_; }
    void clear_queue();

    // Network transmission (implemented for ESP32; no-op/mocked for native)
    bool send_post(const char* endpoint, const char* json_body);

private:
    const char* device_id_;
    const char* device_key_;
    static constexpr int QUEUE_CAPACITY = 50;
    QueuedTelemetry ring_buffer_[QUEUE_CAPACITY];
    int queue_head_;
    int queue_tail_;
    int queue_count_;
};

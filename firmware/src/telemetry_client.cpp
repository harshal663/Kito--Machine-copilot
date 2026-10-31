#include "telemetry_client.h"

#include <cstdio>
#include <cstring>

#ifdef ARDUINO
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "config.h"
#endif

TelemetryClient::TelemetryClient(const char* device_id, const char* device_key)
    : device_id_(device_id),
      device_key_(device_key),
      queue_head_(0),
      queue_tail_(0),
      queue_count_(0) {}

void TelemetryClient::clear_queue() {
    queue_head_ = 0;
    queue_tail_ = 0;
    queue_count_ = 0;
}

bool TelemetryClient::enqueue_event(const QueuedTelemetry& item) {
    if (queue_count_ >= QUEUE_CAPACITY) {
        // Drop oldest element (advance tail)
        queue_tail_ = (queue_tail_ + 1) % QUEUE_CAPACITY;
        queue_count_--;
    }

    ring_buffer_[queue_head_] = item;
    queue_head_ = (queue_head_ + 1) % QUEUE_CAPACITY;
    queue_count_++;
    return true;
}

bool TelemetryClient::dequeue_event(QueuedTelemetry* out_item) {
    if (queue_count_ == 0 || !out_item) {
        return false;
    }
    *out_item = ring_buffer_[queue_tail_];
    queue_tail_ = (queue_tail_ + 1) % QUEUE_CAPACITY;
    queue_count_--;
    return true;
}

int TelemetryClient::serialize_telemetry_json(
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
) {
    if (!dest || max_len < 128) return 0;

    int offset = 0;
    offset += snprintf(
        dest + offset,
        max_len - offset,
        "{\"device_id\":\"%s\",\"seq\":%u,\"ts\":\"%s\",\"rms_g\":%.3f,\"baseline\":{\"mean\":%.3f,\"std\":%.4f,\"window_count\":%d},\"z_score\":%.1f",
        device_id,
        (unsigned int)seq,
        iso_timestamp,
        rms_g,
        baseline.mean,
        baseline.std,
        baseline.window_count,
        z_score
    );

    // Append peaks array
    if (offset < max_len - 12) {
        offset += snprintf(dest + offset, max_len - offset, ",\"peaks\":[");
        for (int i = 0; i < peak_count && i < 5 && offset < max_len - 32; i++) {
            offset += snprintf(
                dest + offset,
                max_len - offset,
                "%s{\"freq_hz\":%.1f,\"amp_g\":%.4f}",
                (i > 0) ? "," : "",
                peaks[i].freq_hz,
                peaks[i].amp_g
            );
        }
        if (offset < max_len - 2) {
            dest[offset++] = ']';
            dest[offset] = '\0';
        }
    }

    // Append hints array
    if (offset < max_len - 12) {
        offset += snprintf(dest + offset, max_len - offset, ",\"hints\":[");
        for (int i = 0; i < hint_count && i < 3 && offset < max_len - 64; i++) {
            offset += snprintf(
                dest + offset,
                max_len - offset,
                "%s\"%s\"",
                (i > 0) ? "," : "",
                hints[i]
            );
        }
        if (offset < max_len - 2) {
            dest[offset++] = ']';
            dest[offset] = '\0';
        }
    }

    if (offset < max_len - 1) {
        dest[offset++] = '}';
        dest[offset] = '\0';
    }

    return offset;
}

int TelemetryClient::serialize_heartbeat_json(
    char* dest,
    int max_len,
    const char* device_id,
    uint32_t seq,
    uint32_t uptime_s,
    int battery_pct,
    int rssi
) {
    if (!dest || max_len < 64) return 0;
    return snprintf(
        dest,
        max_len,
        "{\"device_id\":\"%s\",\"seq\":%u,\"uptime_s\":%u,\"battery_pct\":%d,\"rssi\":%d}",
        device_id,
        (unsigned int)seq,
        (unsigned int)uptime_s,
        battery_pct,
        rssi
    );
}

bool TelemetryClient::send_post(const char* endpoint, const char* json_body) {
#ifdef ARDUINO
    WiFiClientSecure client;
#ifdef DEV_INSECURE_TLS
    client.setInsecure();
#else
    if (ROOT_CA_CERT != nullptr && strlen(ROOT_CA_CERT) > 0) {
        client.setCACert(ROOT_CA_CERT);
    } else {
        client.setInsecure();
    }
#endif

    HTTPClient https;
    char url[128];
    snprintf(url, sizeof(url), "https://%s:%d%s", API_HOST, API_PORT, endpoint);

    if (!https.begin(client, url)) {
        return false;
    }

    https.addHeader("Content-Type", "application/json");
    https.addHeader("X-Device-Key", device_key_);
    https.setTimeout(5000);

    int httpCode = https.POST(reinterpret_cast<const uint8_t*>(json_body), strlen(json_body));
    https.end();

    return (httpCode >= 200 && httpCode < 300);
#else
    // Native mock test mode: always succeeds
    (void)endpoint;
    (void)json_body;
    return true;
#endif
}

#include "detector.h"

#include <cmath>
#include <cstdio>
#include <cstring>

AnomalyDetector::AnomalyDetector(float k_sigma, int m_consecutive, float idle_threshold)
    : k_sigma_(k_sigma),
      m_consecutive_(m_consecutive),
      idle_threshold_(idle_threshold),
      consecutive_count_(0) {}

void AnomalyDetector::reset() {
    consecutive_count_ = 0;
}

float AnomalyDetector::compute_z_score(float rms_g, float baseline_mean, float baseline_std) {
    float std_floor = (baseline_std > 0.001f) ? baseline_std : 0.001f;
    return (rms_g - baseline_mean) / std_floor;
}

AnomalyDecision AnomalyDetector::evaluate(
    float rms_g,
    const BaselineState& baseline,
    float* out_z_score
) {
    // 1. Idle check: if machine is shut off or stationary, do not trigger alerts
    if (rms_g < idle_threshold_) {
        consecutive_count_ = 0;
        if (out_z_score) *out_z_score = 0.0f;
        return AnomalyDecision::IDLE;
    }

    // 2. Compute Z-score
    float z = compute_z_score(rms_g, baseline.mean, baseline.std);
    if (out_z_score) {
        *out_z_score = z;
    }

    // 3. Persistent M-window verification
    if (z >= k_sigma_) {
        consecutive_count_++;
        if (consecutive_count_ >= m_consecutive_) {
            return AnomalyDecision::ANOMALY_CONFIRMED;
        }
        return AnomalyDecision::EVALUATING;
    }

    // Normal vibration resets the consecutive confirmation counter
    consecutive_count_ = 0;
    return AnomalyDecision::NORMAL;
}

int AnomalyDetector::generate_hints(
    const SpectralPeak* peaks,
    int peak_count,
    float rated_rpm,
    char hints[][64],
    int max_hints
) {
    if (!peaks || peak_count <= 0 || max_hints <= 0) return 0;
    int hint_idx = 0;

    if (rated_rpm > 0.0f) {
        float f0 = rated_rpm / 60.0f; // Fundamental frequency in Hz
        constexpr float tol = 0.08f;  // 8% frequency tolerance window

        bool has_1x = false;
        bool has_2x = false;
        bool has_harmonics = false;
        bool has_sub = false;

        for (int i = 0; i < peak_count; i++) {
            float f = peaks[i].freq_hz;
            if (f < f0 * (1.0f - tol) && f > 2.0f) {
                has_sub = true;
            } else if (std::abs(f - f0) <= f0 * tol) {
                has_1x = true;
            } else if (std::abs(f - 2.0f * f0) <= 2.0f * f0 * tol) {
                has_2x = true;
            } else if (std::abs(f - 3.0f * f0) <= 3.0f * f0 * tol ||
                       std::abs(f - 4.0f * f0) <= 4.0f * f0 * tol) {
                has_harmonics = true;
            }
        }

        if (has_1x && hint_idx < max_hints) {
            snprintf(hints[hint_idx++], 64, "1x peak detected (%.1f Hz) - probable imbalance", f0);
        }
        if (has_2x && hint_idx < max_hints) {
            snprintf(hints[hint_idx++], 64, "2x peak detected (%.1f Hz) - probable misalignment", 2.0f * f0);
        }
        if (has_harmonics && hint_idx < max_hints) {
            snprintf(hints[hint_idx++], 64, "Harmonic peaks detected (3x/4x) - probable mechanical looseness");
        }
        if (has_sub && hint_idx < max_hints) {
            snprintf(hints[hint_idx++], 64, "Sub-synchronous peak detected (< 1x)");
        }
    } else {
        if (peak_count > 0 && hint_idx < max_hints) {
            snprintf(hints[hint_idx++], 64, "Dominant peak at %.1f Hz (%.3fg)", peaks[0].freq_hz, peaks[0].amp_g);
        }
    }

    return hint_idx;
}

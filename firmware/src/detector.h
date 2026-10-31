#pragma once

#include "fft_analyzer.h"
#include "baseline.h"

enum class AnomalyDecision {
    NORMAL,
    IDLE,
    EVALUATING, // Above threshold but consecutive window count < M
    ANOMALY_CONFIRMED,
};

/**
 * Anomaly detector implementing Z-score calculation, idle filtering,
 * and M-consecutive-window persistence confirmation.
 */
class AnomalyDetector {
public:
    AnomalyDetector(float k_sigma = 3.0f, int m_consecutive = 3, float idle_threshold = 0.05f);

    void reset();

    /**
     * Compute statistical Z-score for RMS given baseline.
     */
    static float compute_z_score(float rms_g, float baseline_mean, float baseline_std);

    /**
     * Evaluate current window. Returns ANOMALY_CONFIRMED only if M consecutive
     * non-idle windows exceed K*sigma.
     */
    AnomalyDecision evaluate(float rms_g, const BaselineState& baseline, float* out_z_score);

    int get_consecutive_count() const { return consecutive_count_; }

    /**
     * Inspect top spectral peaks to produce rule-based hints.
     */
    static int generate_hints(
        const SpectralPeak* peaks,
        int peak_count,
        float rated_rpm,
        char hints[][64],
        int max_hints
    );

private:
    float k_sigma_;
    int m_consecutive_;
    float idle_threshold_;
    int consecutive_count_;
};

#pragma once

struct BaselineState {
    float mean;
    float std;
    int window_count;
};

/**
 * Online baseline calibration using Welford / EMA algorithm.
 * Maintains running mean and variance without buffering historical samples.
 */
class BaselineTracker {
public:
    explicit BaselineTracker(int min_learning_windows = 18);

    void reset();

    /**
     * Update baseline during initial LEARNING phase.
     */
    void update_learning(float rms_g);

    /**
     * Update baseline during MONITORING phase.
     * Only incorporates data when z_score < 2.0f (healthy operation).
     */
    void update_monitoring(float rms_g, float z_score);

    bool is_calibrated() const;
    float get_mean() const;
    float get_std() const;
    int get_window_count() const;
    BaselineState get_state() const;

private:
    int min_learning_windows_;
    int count_;
    float mean_;
    float m2_; // Running sum of squared differences for Welford's algorithm
};

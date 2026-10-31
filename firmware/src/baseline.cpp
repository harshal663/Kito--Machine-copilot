#include "baseline.h"

#include <cmath>

BaselineTracker::BaselineTracker(int min_learning_windows)
    : min_learning_windows_(min_learning_windows),
      count_(0),
      mean_(0.0f),
      m2_(0.0f) {}

void BaselineTracker::reset() {
    count_ = 0;
    mean_ = 0.0f;
    m2_ = 0.0f;
}

void BaselineTracker::update_learning(float rms_g) {
    count_++;
    float delta = rms_g - mean_;
    mean_ += delta / (float)count_;
    float delta2 = rms_g - mean_;
    m2_ += delta * delta2;
}

void BaselineTracker::update_monitoring(float rms_g, float z_score) {
    // Only update if vibration is within normal range (z_score < 2.0)
    if (z_score >= 2.0f) {
        return;
    }

    // Exponential moving adaptation with weight alpha = 0.05
    constexpr float alpha = 0.05f;
    float delta = rms_g - mean_;
    mean_ += alpha * delta;

    float current_var = (count_ > 1) ? (m2_ / (float)(count_ - 1)) : 0.0001f;
    float new_var = (1.0f - alpha) * current_var + alpha * (delta * delta);
    m2_ = new_var * (float)(count_ > 1 ? count_ - 1 : 1);
    count_++;
}

bool BaselineTracker::is_calibrated() const {
    return count_ >= min_learning_windows_;
}

float BaselineTracker::get_mean() const {
    return mean_;
}

float BaselineTracker::get_std() const {
    if (count_ < 2) return 0.01f; // Safe fallback standard deviation
    float var = m2_ / (float)(count_ - 1);
    float std_val = sqrtf(var);
    // Minimum standard deviation floor to avoid division by near-zero
    return (std_val < 0.001f) ? 0.001f : std_val;
}

int BaselineTracker::get_window_count() const {
    return count_;
}

BaselineState BaselineTracker::get_state() const {
    return BaselineState{
        mean_,
        get_std(),
        count_,
    };
}

#pragma once

#include <cstddef>

struct SpectralPeak {
    float freq_hz;
    float amp_g;
};

/**
 * Pure C++ Radix-2 FFT Analyzer for vibration spectral decomposition.
 * Zero external dependencies; fully testable on native host.
 */
class FftAnalyzer {
public:
    static constexpr int N = 512;

    FftAnalyzer();

    /**
     * Compute acceleration RMS across raw sample array.
     */
    float compute_rms(const float* samples, int n) const;

    /**
     * Run Hann windowing, in-place radix-2 FFT, and return RMS + top local spectral peaks.
     * @param samples Raw input acceleration buffer (size n, where n == 512)
     * @param n Number of samples (must be power of 2, typically 512)
     * @param fs Sampling frequency in Hz (e.g. 1000)
     * @param out_rms Output parameter populated with window RMS
     * @param out_peaks Array to store top peaks (capacity max_peaks)
     * @param max_peaks Maximum peaks to return (typically 5)
     * @return Number of valid peaks found
     */
    int analyze(
        const float* samples,
        int n,
        int fs,
        float* out_rms,
        SpectralPeak* out_peaks,
        int max_peaks
    );

    /**
     * In-place radix-2 Cooley-Tukey FFT.
     */
    static void radix2_fft(float* re, float* im, int n);

private:
    float window_[N];
    float re_[N];
    float im_[N];
    float mag_[N / 2];

    void init_hann_window();
};

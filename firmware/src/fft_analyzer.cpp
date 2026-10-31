#include "fft_analyzer.h"

#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846f
#endif

FftAnalyzer::FftAnalyzer() {
    init_hann_window();
}

void FftAnalyzer::init_hann_window() {
    for (int i = 0; i < N; i++) {
        // Hann window: 0.5 * (1 - cos(2 * PI * i / (N - 1)))
        window_[i] = 0.5f * (1.0f - cosf(2.0f * (float)M_PI * (float)i / (float)(N - 1)));
    }
}

float FftAnalyzer::compute_rms(const float* samples, int n) const {
    if (n <= 0) return 0.0f;
    float sum_sq = 0.0f;
    for (int i = 0; i < n; i++) {
        sum_sq += samples[i] * samples[i];
    }
    return sqrtf(sum_sq / (float)n);
}

void FftAnalyzer::radix2_fft(float* re, float* im, int n) {
    // 1. Bit-reversal permutation
    for (int i = 1, j = 0; i < n; i++) {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            float tr = re[i]; re[i] = re[j]; re[j] = tr;
            float ti = im[i]; im[i] = im[j]; im[j] = ti;
        }
    }

    // 2. Cooley-Tukey butterfly stages
    for (int len = 2; len <= n; len <<= 1) {
        float angle = -2.0f * (float)M_PI / (float)len;
        float wlen_r = cosf(angle);
        float wlen_i = sinf(angle);
        int half_len = len >> 1;

        for (int i = 0; i < n; i += len) {
            float w_r = 1.0f;
            float w_i = 0.0f;
            for (int j = 0; j < half_len; j++) {
                float u_r = re[i + j];
                float u_i = im[i + j];
                float v_r = re[i + j + half_len] * w_r - im[i + j + half_len] * w_i;
                float v_i = re[i + j + half_len] * w_i + im[i + j + half_len] * w_r;

                re[i + j] = u_r + v_r;
                im[i + j] = u_i + v_i;
                re[i + j + half_len] = u_r - v_r;
                im[i + j + half_len] = u_i - v_i;

                float next_w_r = w_r * wlen_r - w_i * wlen_i;
                float next_w_i = w_r * wlen_i + w_i * wlen_r;
                w_r = next_w_r;
                w_i = next_w_i;
            }
        }
    }
}

int FftAnalyzer::analyze(
    const float* samples,
    int n,
    int fs,
    float* out_rms,
    SpectralPeak* out_peaks,
    int max_peaks
) {
    if (n != N || n <= 0) return 0;

    // 1. Compute RMS on raw unwindowed samples
    if (out_rms) {
        *out_rms = compute_rms(samples, n);
    }

    // 2. Compute DC bias (mean)
    float dc = 0.0f;
    for (int i = 0; i < n; i++) {
        dc += samples[i];
    }
    dc /= (float)n;

    // 3. Remove DC and apply Hann window
    for (int i = 0; i < n; i++) {
        re_[i] = (samples[i] - dc) * window_[i];
        im_[i] = 0.0f;
    }

    // 4. In-place Radix-2 FFT
    radix2_fft(re_, im_, n);

    // 5. Compute single-sided amplitude spectrum in g
    int half_n = n / 2;
    for (int i = 0; i < half_n; i++) {
        float mag = sqrtf(re_[i] * re_[i] + im_[i] * im_[i]);
        // Scale factor: 2 / N for single-sided AC spectrum
        mag_[i] = mag * 2.0f / (float)n;
    }

    // 6. Local peak picking from bin 2 to half_n - 2 (skip DC and fundamental bin 1)
    struct CandidatePeak {
        int bin;
        float amp;
    };
    CandidatePeak candidates[64];
    int candidate_count = 0;

    for (int i = 2; i < half_n - 1; i++) {
        if (mag_[i] > mag_[i - 1] && mag_[i] > mag_[i + 1]) {
            // Local maximum
            if (candidate_count < 64) {
                candidates[candidate_count].bin = i;
                candidates[candidate_count].amp = mag_[i];
                candidate_count++;
            }
        }
    }

    // 7. Sort candidate peaks by descending amplitude
    std::sort(candidates, candidates + candidate_count, [](const CandidatePeak& a, const CandidatePeak& b) {
        return a.amp > b.amp;
    });

    // 8. Output top peaks
    int return_count = std::min(candidate_count, max_peaks);
    for (int i = 0; i < return_count; i++) {
        out_peaks[i].freq_hz = (float)candidates[i].bin * (float)fs / (float)n;
        out_peaks[i].amp_g = candidates[i].amp;
    }

    return return_count;
}

#include "sampler.h"

#include <cmath>

#ifdef ARDUINO
#include <Arduino.h>
#include <Wire.h>
#endif

Sampler::Sampler() : nack_count_(0) {}

#ifdef ARDUINO

bool Sampler::write_register(uint8_t reg, uint8_t value) {
    Wire.beginTransmission(MPU6050_ADDR);
    Wire.write(reg);
    Wire.write(value);
    if (Wire.endTransmission() != 0) {
        nack_count_++;
        return false;
    }
    return true;
}

bool Sampler::read_accel_raw(int16_t* ax, int16_t* ay, int16_t* az) {
    Wire.beginTransmission(MPU6050_ADDR);
    Wire.write(0x3B); // ACCEL_XOUT_H
    if (Wire.endTransmission(false) != 0) {
        nack_count_++;
        return false;
    }

    if (Wire.requestFrom(static_cast<uint8_t>(MPU6050_ADDR), static_cast<size_t>(6)) != 6) {
        nack_count_++;
        return false;
    }

    *ax = (static_cast<int16_t>(Wire.read()) << 8) | Wire.read();
    *ay = (static_cast<int16_t>(Wire.read()) << 8) | Wire.read();
    *az = (static_cast<int16_t>(Wire.read()) << 8) | Wire.read();
    return true;
}

SamplerStatus Sampler::begin(int sda_pin, int scl_pin) {
    Wire.begin(sda_pin, scl_pin, 400000); // 400 kHz Fast I2C

    // 1. Wake device: PWR_MGMT_1 (0x6B) = 0x00
    if (!write_register(0x6B, 0x00)) return SamplerStatus::INIT_FAILED;

    // 2. DLPF 184 Hz bandwidth: CONFIG (0x1A) = 0x01
    if (!write_register(0x1A, 0x01)) return SamplerStatus::INIT_FAILED;

    // 3. Accelerometer full-scale range +/-4g: ACCEL_CONFIG (0x1C) = 0x08
    if (!write_register(0x1C, 0x08)) return SamplerStatus::INIT_FAILED;

    // 4. Sample rate divider 0 (1 kHz with DLPF): SMPLRT_DIV (0x19) = 0x00
    if (!write_register(0x19, 0x00)) return SamplerStatus::INIT_FAILED;

    return SamplerStatus::OK;
}

SamplerStatus Sampler::read_burst(float* buffer, int n) {
    if (!buffer || n <= 0) return SamplerStatus::INIT_FAILED;

    // +/-4g range: sensitivity is 8192 LSB/g
    constexpr float scale_to_g = 1.0f / 8192.0f;
    constexpr unsigned long sample_period_us = 1000; // 1 ms pacing (fs = 1000 Hz)

    unsigned long next_sample_time = micros();

    for (int i = 0; i < n; i++) {
        // Precise busy-wait pacing (no delay())
        while (static_cast<long>(micros() - next_sample_time) < 0) {
            // yield or tight wait for sub-millisecond precision
        }

        int16_t raw_x = 0, raw_y = 0, raw_z = 0;
        if (!read_accel_raw(&raw_x, &raw_y, &raw_z)) {
            // Re-attempt once on I2C failure
            if (!read_accel_raw(&raw_x, &raw_y, &raw_z)) {
                return SamplerStatus::I2C_NACK;
            }
        }

        float ax = static_cast<float>(raw_x) * scale_to_g;
        float ay = static_cast<float>(raw_y) * scale_to_g;
        float az = static_cast<float>(raw_z) * scale_to_g;

        // Tri-axial vector magnitude in g
        buffer[i] = sqrtf(ax * ax + ay * ay + az * az);

        next_sample_time += sample_period_us;
    }

    return SamplerStatus::OK;
}

#else

// Host / Native stub implementation
bool Sampler::write_register(uint8_t, uint8_t) { return true; }
bool Sampler::read_accel_raw(int16_t* ax, int16_t* ay, int16_t* az) {
    *ax = 0; *ay = 0; *az = 8192; // 1g static gravity
    return true;
}
SamplerStatus Sampler::begin(int, int) { return SamplerStatus::OK; }
SamplerStatus Sampler::read_burst(float* buffer, int n) {
    if (!buffer) return SamplerStatus::INIT_FAILED;
    for (int i = 0; i < n; i++) buffer[i] = 1.0f;
    return SamplerStatus::OK;
}

#endif

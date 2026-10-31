#pragma once

#include <cstdint>

enum class SamplerStatus {
    OK,
    I2C_NACK,
    OVERRUN,
    INIT_FAILED,
};

/**
 * MPU6050 Accelerometer Burst Sampler.
 * Paced at 1 kHz using microsecond hardware timer.
 */
class Sampler {
public:
    Sampler();

    /**
     * Initialize I2C bus and MPU6050 registers (DLPF 184Hz, +/-4g, 1kHz sample rate).
     */
    SamplerStatus begin(int sda_pin = 21, int scl_pin = 22);

    /**
     * Acquire a burst of N samples at fs = 1000 Hz.
     * Paced using micros() without internal delays.
     */
    SamplerStatus read_burst(float* buffer, int n);

    uint32_t get_nack_count() const { return nack_count_; }

private:
    uint32_t nack_count_;
    static constexpr uint8_t MPU6050_ADDR = 0x68;

    bool write_register(uint8_t reg, uint8_t value);
    bool read_accel_raw(int16_t* ax, int16_t* ay, int16_t* az);
};

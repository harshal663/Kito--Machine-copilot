"""Unit tests for FFT rule-based hints per ARCHITECTURE.md §3.5 and §4.4."""

from app.schemas.telemetry import PeakIn
from app.services.rules import calculate_fft_hints


def test_rpm_unknown() -> None:
    """Ensure missing or non-positive RPM returns ['rpm unknown']."""
    peaks = [{"freq_hz": 24.4, "amp_g": 0.5}]
    assert calculate_fft_hints(peaks, None) == ["rpm unknown"]
    assert calculate_fft_hints(peaks, 0) == ["rpm unknown"]
    assert calculate_fft_hints(peaks, -100) == ["rpm unknown"]


def test_1465_rpm_imbalance() -> None:
    """Ensure 24.4 Hz peak at 1465 RPM triggers 1x imbalance hint."""
    peaks = [PeakIn(freq_hz=24.4, amp_g=0.52)]
    hints = calculate_fft_hints(peaks, 1465.0)
    assert "1x dominant: imbalance" in hints
    assert "2x peak: misalignment" not in hints
    assert "harmonics detected: mechanical looseness" not in hints


def test_1465_rpm_misalignment() -> None:
    """Ensure 48.8 Hz peak at 1465 RPM triggers 2x misalignment hint."""
    peaks = [{"freq_hz": 48.8, "amp_g": 0.35}]
    hints = calculate_fft_hints(peaks, 1465.0)
    assert "2x peak: misalignment" in hints
    assert "1x dominant: imbalance" not in hints


def test_1465_rpm_harmonics_looseness() -> None:
    """Ensure peaks at 24.4, 48.8, and 73.2 Hz trigger 1x, 2x, and harmonics hints."""
    peaks = [
        {"freq_hz": 24.4, "amp_g": 0.40},
        {"freq_hz": 48.8, "amp_g": 0.30},
        {"freq_hz": 73.2, "amp_g": 0.20},
    ]
    hints = calculate_fft_hints(peaks, 1465.0)
    assert "1x dominant: imbalance" in hints
    assert "2x peak: misalignment" in hints
    assert "harmonics detected: mechanical looseness" in hints


def test_sub_synchronous_peak() -> None:
    """Ensure low frequency peak (< 0.9x) triggers sub-synchronous hint."""
    peaks = [PeakIn(freq_hz=12.0, amp_g=0.15)]
    hints = calculate_fft_hints(peaks, 1465.0)
    assert "sub-synchronous peak: bearing cage or belt flutter" in hints

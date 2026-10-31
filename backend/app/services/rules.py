"""Rule-based vibration diagnostic hints per ARCHITECTURE.md §3.5 and §4.4."""

from typing import Any

from app.schemas.telemetry import PeakIn

# Tolerances for frequency ratio matching
RATIO_1X_MIN: float = 0.9
RATIO_1X_MAX: float = 1.1
RATIO_2X_MIN: float = 1.9
RATIO_2X_MAX: float = 2.1
SUB_SYNCHRONOUS_MAX: float = 0.9
HARMONIC_TOLERANCE: float = 0.1


def extract_freq_and_amp(peak: PeakIn | dict[str, Any]) -> tuple[float, float]:
    """Extract frequency and amplitude from PeakIn or dict."""
    if isinstance(peak, PeakIn):
        return peak.freq_hz, peak.amp_g
    freq = float(peak.get("freq_hz", 0.0))
    amp = float(peak.get("amp_g", 0.0))
    return freq, amp


def calculate_fft_hints(
    peaks: list[PeakIn] | list[dict[str, Any]],
    rpm: float | None = None,
) -> list[str]:
    """Calculate heuristic diagnostic hints from spectral peaks and running RPM."""
    if rpm is None or rpm <= 0:
        return ["rpm unknown"]

    f0 = rpm / 60.0
    if f0 <= 0:
        return ["rpm unknown"]

    hints: list[str] = []
    has_1x = False
    has_2x = False
    has_sub = False
    detected_harmonics: set[int] = set()

    for p in peaks:
        freq, _amp = extract_freq_and_amp(p)
        if freq <= 0:
            continue
        ratio = freq / f0

        # Sub-synchronous check
        if ratio < SUB_SYNCHRONOUS_MAX:
            has_sub = True

        # 1x check
        if RATIO_1X_MIN <= ratio <= RATIO_1X_MAX:
            has_1x = True

        # 2x check
        if RATIO_2X_MIN <= ratio <= RATIO_2X_MAX:
            has_2x = True

        # Harmonics check (integer multiples 1, 2, 3, 4, 5, ...)
        nearest_int = round(ratio)
        if nearest_int >= 1 and abs(ratio - nearest_int) <= HARMONIC_TOLERANCE:
            detected_harmonics.add(nearest_int)

    if has_1x:
        hints.append("1x dominant: imbalance")
    if has_2x:
        hints.append("2x peak: misalignment")
    if len(detected_harmonics) >= 3:
        hints.append("harmonics detected: mechanical looseness")
    if has_sub:
        hints.append("sub-synchronous peak: bearing cage or belt flutter")

    return hints

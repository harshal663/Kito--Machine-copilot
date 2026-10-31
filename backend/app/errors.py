"""Application errors and closed error code hierarchy per ARCHITECTURE.md §3.6."""

from typing import Any


class AppError(Exception):
    """Base application error with standardized code and HTTP status."""

    code: str = "INTERNAL"
    http_status: int = 500
    default_message: str = "An unexpected error occurred."

    def __init__(
        self,
        message: str | None = None,
        details: dict[str, Any] | list[dict[str, Any]] | None = None,
    ) -> None:
        self.message = message or self.default_message
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(AppError):
    """Request body or query failed validation."""

    code = "VALIDATION_ERROR"
    http_status = 422
    default_message = "Request validation failed."


class UnauthenticatedError(AppError):
    """Missing or invalid dashboard token."""

    code = "UNAUTHENTICATED"
    http_status = 401
    default_message = "Authentication required."


class DeviceKeyInvalidError(AppError):
    """Missing or unknown X-Device-Key."""

    code = "DEVICE_KEY_INVALID"
    http_status = 401
    default_message = "Invalid or missing device key."


class WebhookSignatureInvalidError(AppError):
    """HMAC check failed on webhook request."""

    code = "WEBHOOK_SIGNATURE_INVALID"
    http_status = 401
    default_message = "Invalid webhook signature."


class ForbiddenError(AppError):
    """Authenticated but not allowed on this resource."""

    code = "FORBIDDEN"
    http_status = 403
    default_message = "Access forbidden."


class NotFoundError(AppError):
    """Resource does not exist or is not visible to caller."""

    code = "NOT_FOUND"
    http_status = 404
    default_message = "Resource not found."


class ConflictError(AppError):
    """Duplicate resource (e.g. device already bound)."""

    code = "CONFLICT"
    http_status = 409
    default_message = "Resource conflict."


class EmailTakenError(AppError):
    """Account with this email already exists (Added in run 2)."""

    code = "EMAIL_TAKEN"
    http_status = 409
    default_message = "An account with this email address already exists."


class OnboardingIncompleteError(AppError):
    """Onboarding requirements not met (Added in run 2)."""

    code = "ONBOARDING_INCOMPLETE"
    http_status = 409
    default_message = "Onboarding cannot be completed without required factory and machine details."


class InvalidStateTransitionError(AppError):
    """Action not allowed in current event status."""

    code = "INVALID_STATE_TRANSITION"
    http_status = 409
    default_message = "Invalid state transition."


class RateLimitedError(AppError):
    """Per-device or per-machine limit exceeded."""

    code = "RATE_LIMITED"
    http_status = 429
    default_message = "Rate limit exceeded. Please try again later."


class ManualParseFailedError(AppError):
    """PDF could not be read or contains no text."""

    code = "MANUAL_PARSE_FAILED"
    http_status = 422
    default_message = "Manual file could not be parsed."


class LLMUnavailableError(AppError):
    """LLM service is unreachable or timed out."""

    code = "LLM_UNAVAILABLE"
    http_status = 503
    default_message = "Diagnosis model is temporarily unavailable."


class LLMInvalidOutputError(AppError):
    """LLM output failed parsing or validation."""

    code = "LLM_INVALID_OUTPUT"
    http_status = 502
    default_message = "Diagnosis model returned invalid output."


class VoiceProviderError(AppError):
    """Voice call provider error."""

    code = "VOICE_PROVIDER_ERROR"
    http_status = 502
    default_message = "Failed to place outbound voice call."


class NotifyProviderError(AppError):
    """SMS or WhatsApp fallback notification error."""

    code = "NOTIFY_PROVIDER_ERROR"
    http_status = 502
    default_message = "Failed to send notification."


class InternalError(AppError):
    """Internal server error."""

    code = "INTERNAL"
    http_status = 500
    default_message = "Something went wrong. Please try again."

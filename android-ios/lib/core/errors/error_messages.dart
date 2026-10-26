import '../../app/localization/generated/app_localizations.dart';
import 'api_failure.dart';

/// Server error code → localised, user-facing text. Unknown codes fall back to a
/// generic message; the server's English text is never shown verbatim.
String messageForFailure(AppLocalizations l10n, Object error) {
  if (error is! ApiFailure) {
    return l10n.errorGeneric;
  }
  return switch (error.code) {
    'NETWORK_UNAVAILABLE' => l10n.errorNetwork,
    'TIMEOUT' => l10n.errorTimeout,
    'INSECURE_CONNECTION' => l10n.errorInsecureConnection,
    'RATE_LIMITED' => l10n.errorRateLimited,
    'OTP_INVALID' => l10n.errorOtpInvalid,
    'OTP_EXPIRED' => l10n.errorOtpExpired,
    'OTP_ATTEMPTS_EXCEEDED' => l10n.errorOtpAttempts,
    'PIN_INVALID' => l10n.errorPinInvalid,
    'PIN_LOCKED' => l10n.errorPinLocked,
    'SESSION_REVOKED' || 'UNAUTHENTICATED' => l10n.errorSessionEnded,
    'ACCOUNT_BLOCKED' => l10n.errorAccountBlocked,
    'PAYEE_NOT_FOUND' || 'PAYEE_INACTIVE' => l10n.errorPayeeNotFound,
    'NETWORK_NOT_SUPPORTED' => l10n.errorNetworkNotSupported,
    'INVALID_PAYEE_IDENTIFIER' => l10n.errorInvalidPayee,
    'PAYEE_BLOCKED' => l10n.errorPayeeBlocked,
    'QUOTE_EXPIRED' => l10n.errorQuoteExpired,
    'AMOUNT_OUT_OF_RANGE' => l10n.errorAmountRange,
    'LIMIT_EXCEEDED' => l10n.errorLimitExceeded,
    'PAYMENT_PENDING_REVIEW' => l10n.errorPendingReview,
    'CARD_NOT_ELIGIBLE' => l10n.errorCardNotEligible,
    'CARD_LIMIT_REACHED' => l10n.errorCardLimit,
    'CARD_SETUP_FAILED' => l10n.errorCardSetupFailed,
    'CAPABILITY_NOT_CONFIGURED' ||
    'CONFIGURATION_NOT_APPROVED' ||
    'FEATURE_DISABLED' => l10n.errorCapabilityNotConfigured,
    'PROVIDER_UNAVAILABLE' => l10n.errorProviderUnavailable,
    _ => l10n.errorGeneric,
  };
}

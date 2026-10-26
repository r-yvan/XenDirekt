// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'XenDirekt';

  @override
  String get tagline =>
      'Pay any MTN MoMo account in Rwanda with the card you already carry.';

  @override
  String get continueLabel => 'Continue';

  @override
  String get retry => 'Try again';

  @override
  String get cancel => 'Cancel';

  @override
  String get done => 'Done';

  @override
  String get undo => 'Undo';

  @override
  String get close => 'Close';

  @override
  String get loading => 'Loading…';

  @override
  String get sandboxBanner => 'Sandbox: no real money moves';

  @override
  String get offlineBanner =>
      'You\'re offline. We\'ll reconnect automatically.';

  @override
  String get providerOutageBanner =>
      'Payments are slower than usual right now. You will never be charged twice.';

  @override
  String get tabPay => 'Pay';

  @override
  String get tabHistory => 'History';

  @override
  String get tabProfile => 'Profile';

  @override
  String get welcomeTitle => 'Pay any shop in Rwanda with your own card';

  @override
  String get continueWithEmail => 'Continue with email';

  @override
  String get continueWithPhone => 'Continue with phone';

  @override
  String get continueWithApple => 'Continue with Apple';

  @override
  String get continueWithGoogle => 'Continue with Google';

  @override
  String get emailTitle => 'What\'s your email?';

  @override
  String get emailLabel => 'Email';

  @override
  String get phoneTitle => 'What\'s your phone number?';

  @override
  String get phoneLabel => 'Phone number with country code';

  @override
  String get phoneHint => '+1 415 555 2671';

  @override
  String get invalidEmail => 'Enter a valid email address.';

  @override
  String get invalidPhone =>
      'Enter your number with its country code, starting with +.';

  @override
  String get otpTitle => 'Enter the 6-digit code';

  @override
  String otpSentTo(String destination) {
    return 'We sent it to $destination.';
  }

  @override
  String get otpResend => 'Send a new code';

  @override
  String otpResendIn(int seconds) {
    return 'New code in $seconds s';
  }

  @override
  String get otpFieldLabel => 'One-time code';

  @override
  String get profileTitle => 'About you';

  @override
  String get fullNameLabel => 'Full name';

  @override
  String get countryLabel => 'Country of residence';

  @override
  String get dateOfBirthLabel => 'Date of birth';

  @override
  String get termsNotice =>
      'By tapping Continue you accept the Terms of Service and Privacy Policy.';

  @override
  String get viewTerms => 'Terms of Service';

  @override
  String get viewPrivacy => 'Privacy Policy';

  @override
  String get fieldRequired => 'Required';

  @override
  String get invalidDateOfBirth => 'You must be at least 18.';

  @override
  String get pinCreateTitle => 'Create a 6-digit PIN';

  @override
  String get pinCreateBody =>
      'You\'ll use it if Face ID or fingerprint isn\'t available.';

  @override
  String get pinConfirmTitle => 'Enter the same PIN again';

  @override
  String get pinMismatch => 'The PINs don\'t match. Try again.';

  @override
  String get pinEnterTitle => 'Enter your PIN';

  @override
  String get pinFieldLabel => 'PIN';

  @override
  String get enableBiometricsTitle => 'Approve with Face ID or fingerprint?';

  @override
  String get enableBiometricsBody =>
      'Payments start your biometric check automatically. Your PIN stays the fallback.';

  @override
  String get enableBiometrics => 'Turn on';

  @override
  String get notNow => 'Not now';

  @override
  String get biometricReasonUnlock => 'Unlock XenDirekt';

  @override
  String get biometricReasonPay => 'Approve this payment';

  @override
  String get biometricReasonSensitive => 'Confirm it\'s you';

  @override
  String get unlockTitle => 'Welcome back';

  @override
  String get unlockWithBiometrics => 'Unlock';

  @override
  String get usePinInstead => 'Use PIN instead';

  @override
  String get logOut => 'Log out';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String get errorNetwork =>
      'No connection. Check your internet and try again.';

  @override
  String get errorTimeout =>
      'This is taking longer than usual. Please check again in a moment.';

  @override
  String get errorRateLimited =>
      'Too many attempts. Please wait a moment and try again.';

  @override
  String get errorOtpInvalid => 'That code is not correct.';

  @override
  String get errorOtpExpired => 'That code has expired. Request a new one.';

  @override
  String get errorOtpAttempts => 'Too many wrong codes. Request a new one.';

  @override
  String get errorPinInvalid => 'That PIN is not correct.';

  @override
  String get errorPinLocked =>
      'PIN entry is locked for a while after too many attempts.';

  @override
  String get errorSessionEnded =>
      'Your session has ended. Please sign in again.';

  @override
  String get errorAccountBlocked =>
      'This account is blocked. Please contact support.';

  @override
  String get errorPayeeNotFound =>
      'We couldn\'t find this MoMo account. Check the number with the seller.';

  @override
  String get errorNetworkNotSupported =>
      'XenDirekt currently supports MTN MoMo numbers only.';

  @override
  String get errorInvalidPayee => 'Enter a valid Rwandan MoMo number.';

  @override
  String get errorPayeeBlocked => 'Payments to this account are not available.';

  @override
  String get errorQuoteExpired =>
      'The price was updated. Please confirm the new total.';

  @override
  String get errorAmountRange => 'The amount is outside the allowed range.';

  @override
  String get errorLimitExceeded =>
      'This payment is above your limit. Verify your identity to raise it.';

  @override
  String get errorCardDeclined =>
      'Your bank declined this payment. Try another card or contact your bank.';

  @override
  String get errorThreeDsAbandoned =>
      'Payment not completed. You were not charged.';

  @override
  String get errorPayoutFailed =>
      'The seller\'s MoMo couldn\'t receive this payment. You have not been charged.';

  @override
  String get errorPendingReview =>
      'Your payment is being checked. We\'ll notify you within 30 minutes.';

  @override
  String get errorCardNotEligible => 'This card can\'t be used with XenDirekt.';

  @override
  String get errorCardLimit => 'You can save up to 3 cards.';

  @override
  String get errorCapabilityNotConfigured => 'This isn\'t available yet.';

  @override
  String get errorProviderUnavailable =>
      'Our payment partner isn\'t responding. Please try again shortly.';

  @override
  String get errorInsecureConnection =>
      'We couldn\'t open a secure connection. Check your network.';

  @override
  String get chooseCountry => 'Choose your country';

  @override
  String get searchCountry => 'Search';

  @override
  String get language => 'Language';

  @override
  String get languageSystem => 'Device language';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageFrench => 'Français';

  @override
  String get biometricsToggle => 'Face ID / fingerprint';

  @override
  String get changePin => 'Change PIN';

  @override
  String get newPinTitle => 'Choose a new PIN';

  @override
  String get pinChanged => 'PIN changed.';

  @override
  String get deleteAccount => 'Delete account';

  @override
  String get deleteAccountBody =>
      'Your profile and cards are removed and you are signed out everywhere. Payment records are kept as the law requires.';

  @override
  String get holdToDelete => 'Hold to delete';

  @override
  String get termsAndPrivacy => 'Terms and privacy';

  @override
  String get profileSection => 'Your details';

  @override
  String get securitySection => 'Security';

  @override
  String get notSet => 'Not set';

  @override
  String get checking => 'Checking…';

  @override
  String get offlineRetry => 'We can\'t reach XenDirekt right now.';

  @override
  String get payTitle => 'Pay';

  @override
  String get historyTitle => 'History';

  @override
  String get profileTitleTab => 'Profile';

  @override
  String get cardsSection => 'Cards';

  @override
  String get addCard => 'Add card';

  @override
  String get defaultCard => 'Default';

  @override
  String get makeDefault => 'Make default';

  @override
  String get removeCard => 'Remove';

  @override
  String get cardRemoved => 'Card removed';

  @override
  String get cardAdded => 'Card added';

  @override
  String get addCardTitle => 'Add a card';

  @override
  String get noCards => 'Add a card to start paying.';

  @override
  String cardExpires(String date) {
    return 'Expires $date';
  }

  @override
  String get errorCardSetupFailed =>
      'Your bank couldn\'t verify this card. Try another card.';
}

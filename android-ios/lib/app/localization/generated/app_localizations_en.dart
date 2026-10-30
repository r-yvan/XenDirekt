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
  String get hostedPageInNewTab =>
      'The page opened in a new tab. Finish there, then come back and tap Continue.';

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
  String get paymentsPausedBanner =>
      'Payments are paused for a moment. Nothing you paid is affected.';

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
      'Your bank\'s security check wasn\'t completed, so the payment was stopped.';

  @override
  String get errorPayoutFailed =>
      'The seller\'s MoMo account couldn\'t receive this payment, so we stopped it.';

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
  String get errorPaymentsPaused =>
      'Payments are paused for a moment. You have not been charged. Please try again shortly.';

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

  @override
  String get momoNumberLabel => 'Seller\'s MTN MoMo number';

  @override
  String get momoNumberHint => '078 123 4567';

  @override
  String get mtnMomo => 'MTN MoMo';

  @override
  String get lookingUp => 'Finding the account…';

  @override
  String get checkNameHint => 'Check the name with the seller before you pay.';

  @override
  String get amountLabel => 'Amount in RWF';

  @override
  String get sellerReceives => 'Seller receives';

  @override
  String get xendirektFee => 'XenDirekt fee';

  @override
  String get youPay => 'You pay';

  @override
  String get exchangeRate => 'Rate';

  @override
  String get payWithCard => 'Card';

  @override
  String get chooseCard => 'Choose a card';

  @override
  String get recentPayees => 'Recent';

  @override
  String get payButton => 'Pay';

  @override
  String get quoteRefreshing => 'Updating the price…';

  @override
  String get noteLabel => 'Note for the seller (optional)';

  @override
  String get stepProcessing => 'Processing';

  @override
  String get stepSent => 'Sent';

  @override
  String get stepReceived => 'Received';

  @override
  String get checkingPayment => 'Checking your payment…';

  @override
  String get confirmWithBank => 'Confirm with your bank';

  @override
  String get confirmWithBankBody => 'Your bank needs to confirm this payment.';

  @override
  String get openBankCheck => 'Continue';

  @override
  String get successTitle => 'Payment sent';

  @override
  String successBody(String name, String amount) {
    return '$name received $amount.';
  }

  @override
  String get failedTitle => 'Payment not completed';

  @override
  String get notCharged => 'You have not been charged.';

  @override
  String get holdReleasing =>
      'Your bank\'s hold is being released. You have not been charged.';

  @override
  String get reviewTitle => 'We\'re checking your payment';

  @override
  String get refundedTitle => 'Payment refunded';

  @override
  String get shareReceipt => 'Share receipt';

  @override
  String get receiptTitle => 'Receipt';

  @override
  String get reference => 'Reference';

  @override
  String get dateTime => 'Date (Kigali time)';

  @override
  String get merchant => 'Seller';

  @override
  String get cardCharged => 'Card';

  @override
  String get statusLabel => 'Status';

  @override
  String get statusCompleted => 'Completed';

  @override
  String get statusFailed => 'Failed';

  @override
  String get statusInProgress => 'In progress';

  @override
  String get statusInReview => 'Being checked';

  @override
  String get statusRefunded => 'Refunded';

  @override
  String get filterAll => 'All';

  @override
  String get noPayments => 'Your payments will appear here.';

  @override
  String get loadMore => 'Load more';

  @override
  String get payAgain => 'Pay again';

  @override
  String get addCardToPay => 'Add a card to pay';

  @override
  String get sandboxReceiptNote => 'Sandbox: simulated, no real money moved.';

  @override
  String receiptShareText(
    String reference,
    String amountRwf,
    String merchant,
    String date,
    String total,
    String card,
  ) {
    return 'XenDirekt receipt $reference\nPaid $amountRwf to $merchant on $date (Kigali).\nCharged $total to $card.';
  }

  @override
  String get reportProblem => 'Report a problem';

  @override
  String get reportProblemTitle => 'What went wrong?';

  @override
  String reportSent(String reference) {
    return 'Thanks — we\'ve received your report $reference.';
  }

  @override
  String get ticketSellerNotPaid => 'Seller didn\'t receive it';

  @override
  String get ticketWrongAmount => 'Wrong amount';

  @override
  String get ticketChargedButFailed => 'Charged but it failed';

  @override
  String get ticketChargedTwice => 'Charged twice';

  @override
  String get ticketWrongSeller => 'Paid the wrong seller';

  @override
  String get ticketRefundRequest => 'I need a refund';

  @override
  String get ticketAppProblem => 'Problem with the app';

  @override
  String get ticketOther => 'Something else';

  @override
  String get addDetails => 'Add details (optional)';

  @override
  String get send => 'Send';

  @override
  String get helpCentre => 'Help';

  @override
  String get myRequests => 'My requests';

  @override
  String get noRequests => 'You haven\'t reported any problems.';

  @override
  String get contactSupport => 'Contact support';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get noNotifications => 'You\'re all caught up.';

  @override
  String get ticketStatusOpen => 'Open';

  @override
  String get ticketStatusInProgress => 'In progress';

  @override
  String get ticketStatusResolved => 'Resolved';

  @override
  String get ticketStatusClosed => 'Closed';

  @override
  String get faq1q => 'How does XenDirekt work?';

  @override
  String get faq1a =>
      'Type the seller\'s MTN MoMo number and the amount in Rwandan francs. We show the name registered to that account, the fee and what your card will be charged. Tap Pay, confirm with Face ID or your PIN, and the seller receives francs in their MoMo account.';

  @override
  String get faq2q => 'Will I be charged if a payment fails?';

  @override
  String get faq2a =>
      'No. Your card is only held first and charged after the seller\'s MoMo account has received the money. If the seller can\'t receive it, the hold is released and you are not charged.';

  @override
  String get faq3q => 'Which numbers can I pay?';

  @override
  String get faq3a =>
      'Any active MTN MoMo account in Rwanda. Other networks are not supported yet.';

  @override
  String get faq4q => 'Is my card safe?';

  @override
  String get faq4a =>
      'Your card details are entered on our licensed payment partner\'s secure page. XenDirekt never sees or stores your card number or security code.';

  @override
  String get faq5q => 'What fees do I pay?';

  @override
  String get faq5a =>
      'You see the XenDirekt fee, the exchange rate and the exact total in your card\'s currency before you pay. Your bank may add its own foreign transaction fees.';

  @override
  String get faq6q => 'What is the extra check from my bank?';

  @override
  String get faq6a =>
      'Banks often ask you to confirm the first payment with a card (3-D Secure), for example with a code or in your banking app. It protects you from fraud.';

  @override
  String get faq7q => 'The seller says the money didn\'t arrive. What now?';

  @override
  String get faq7a =>
      'Open the payment in History and tap Report a problem. The payment reference is attached automatically and our team will look into it.';

  @override
  String get faq8q => 'Why is my payment being checked?';

  @override
  String get faq8a =>
      'Sometimes the mobile money network doesn\'t answer in time, or a payment needs a quick safety review. We\'ll update you within 30 minutes, and you\'ll never be charged twice.';

  @override
  String ageYears(int age) {
    String _temp0 = intl.Intl.pluralLogic(
      age,
      locale: localeName,
      other: '$age years old',
      one: '1 year old',
    );
    return '$_temp0';
  }

  @override
  String get dobPickerSubtitle => 'You must be 18 or older to use XenDirekt.';

  @override
  String get profileSubtitle =>
      'A few details to keep your payments safe. It takes 30 seconds.';

  @override
  String stepOf(int current, int total) {
    return 'Step $current of $total';
  }

  @override
  String get selectPlaceholder => 'Select';

  @override
  String get sectionPreferences => 'Preferences';

  @override
  String get sectionSupport => 'Support';

  @override
  String get sectionDangerZone => 'Danger zone';

  @override
  String get sandboxAccount => 'Sandbox account';

  @override
  String get verifiedAccount => 'Verified';

  @override
  String cardsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count of 3 cards',
      one: '1 of 3 cards',
      zero: 'No cards yet',
    );
    return '$_temp0';
  }

  @override
  String get addFirstCardTitle => 'Add your first card';

  @override
  String get addFirstCardBody =>
      'Card details go straight to our payment partner. XenDirekt never sees your card number.';

  @override
  String get biometricsSubtitle => 'Approve payments with a glance or a touch';

  @override
  String get changePinSubtitle => 'Your 6-digit fallback code';

  @override
  String get notificationsSubtitle => 'Payment updates and messages';

  @override
  String get helpSubtitle => 'Questions, problems and requests';

  @override
  String get termsSubtitle => 'How we handle your data';

  @override
  String get greetingMorning => 'Good morning';

  @override
  String get greetingAfternoon => 'Good afternoon';

  @override
  String get greetingEvening => 'Good evening';

  @override
  String greetingWithName(String greeting, String name) {
    return '$greeting, $name';
  }

  @override
  String get paySubtitle => 'Pay any MTN MoMo account with your card.';

  @override
  String get sendTo => 'Send to';

  @override
  String get amountSection => 'Amount';

  @override
  String get payWithLabel => 'Pay with';

  @override
  String get summarySection => 'Summary';

  @override
  String rateHeldFor(String time) {
    return 'Rate held for $time';
  }

  @override
  String get registeredNameVerified => 'Registered name';

  @override
  String get historySubtitle => 'Every payment you have made, newest first.';

  @override
  String get today => 'Today';

  @override
  String get yesterday => 'Yesterday';

  @override
  String get noPaymentsTitle => 'No payments yet';

  @override
  String get makePayment => 'Make a payment';

  @override
  String get featureMomo => 'Pay any MTN MoMo number or shop';

  @override
  String get featureCard => 'Use the Visa or Mastercard you already carry';

  @override
  String get featureName => 'See the seller\'s registered name before you pay';

  @override
  String get securedByPartner =>
      'Card details are handled by our licensed payment partner.';

  @override
  String get signInSubtitleEmail =>
      'We\'ll send you a 6-digit code. No password needed.';

  @override
  String get signInSubtitlePhone =>
      'We\'ll text you a 6-digit code. No password needed.';

  @override
  String get appearance => 'Appearance';

  @override
  String get themeSystem => 'Same as device';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';
}

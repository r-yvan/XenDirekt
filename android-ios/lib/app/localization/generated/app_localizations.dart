import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_fr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('fr'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'XenDirekt'**
  String get appName;

  /// No description provided for @tagline.
  ///
  /// In en, this message translates to:
  /// **'Pay any MTN MoMo account in Rwanda with the card you already carry.'**
  String get tagline;

  /// No description provided for @continueLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueLabel;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retry;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @hostedPageInNewTab.
  ///
  /// In en, this message translates to:
  /// **'The page opened in a new tab. Finish there, then come back and tap Continue.'**
  String get hostedPageInNewTab;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @undo.
  ///
  /// In en, this message translates to:
  /// **'Undo'**
  String get undo;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get loading;

  /// No description provided for @sandboxBanner.
  ///
  /// In en, this message translates to:
  /// **'Sandbox: no real money moves'**
  String get sandboxBanner;

  /// No description provided for @offlineBanner.
  ///
  /// In en, this message translates to:
  /// **'You\'re offline. We\'ll reconnect automatically.'**
  String get offlineBanner;

  /// No description provided for @providerOutageBanner.
  ///
  /// In en, this message translates to:
  /// **'Payments are slower than usual right now. You will never be charged twice.'**
  String get providerOutageBanner;

  /// No description provided for @paymentsPausedBanner.
  ///
  /// In en, this message translates to:
  /// **'Payments are paused for a moment. Nothing you paid is affected.'**
  String get paymentsPausedBanner;

  /// No description provided for @tabPay.
  ///
  /// In en, this message translates to:
  /// **'Pay'**
  String get tabPay;

  /// No description provided for @tabHistory.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get tabHistory;

  /// No description provided for @tabProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get tabProfile;

  /// No description provided for @welcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Pay any shop in Rwanda with your own card'**
  String get welcomeTitle;

  /// No description provided for @continueWithEmail.
  ///
  /// In en, this message translates to:
  /// **'Continue with email'**
  String get continueWithEmail;

  /// No description provided for @continueWithPhone.
  ///
  /// In en, this message translates to:
  /// **'Continue with phone'**
  String get continueWithPhone;

  /// No description provided for @continueWithApple.
  ///
  /// In en, this message translates to:
  /// **'Continue with Apple'**
  String get continueWithApple;

  /// No description provided for @continueWithGoogle.
  ///
  /// In en, this message translates to:
  /// **'Continue with Google'**
  String get continueWithGoogle;

  /// No description provided for @emailTitle.
  ///
  /// In en, this message translates to:
  /// **'What\'s your email?'**
  String get emailTitle;

  /// No description provided for @emailLabel.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get emailLabel;

  /// No description provided for @phoneTitle.
  ///
  /// In en, this message translates to:
  /// **'What\'s your phone number?'**
  String get phoneTitle;

  /// No description provided for @phoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Phone number with country code'**
  String get phoneLabel;

  /// No description provided for @phoneHint.
  ///
  /// In en, this message translates to:
  /// **'+1 415 555 2671'**
  String get phoneHint;

  /// No description provided for @invalidEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address.'**
  String get invalidEmail;

  /// No description provided for @invalidPhone.
  ///
  /// In en, this message translates to:
  /// **'Enter your number with its country code, starting with +.'**
  String get invalidPhone;

  /// No description provided for @otpTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code'**
  String get otpTitle;

  /// No description provided for @otpSentTo.
  ///
  /// In en, this message translates to:
  /// **'We sent it to {destination}.'**
  String otpSentTo(String destination);

  /// No description provided for @otpResend.
  ///
  /// In en, this message translates to:
  /// **'Send a new code'**
  String get otpResend;

  /// No description provided for @otpResendIn.
  ///
  /// In en, this message translates to:
  /// **'New code in {seconds} s'**
  String otpResendIn(int seconds);

  /// No description provided for @otpFieldLabel.
  ///
  /// In en, this message translates to:
  /// **'One-time code'**
  String get otpFieldLabel;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'About you'**
  String get profileTitle;

  /// No description provided for @fullNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get fullNameLabel;

  /// No description provided for @countryLabel.
  ///
  /// In en, this message translates to:
  /// **'Country of residence'**
  String get countryLabel;

  /// No description provided for @dateOfBirthLabel.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get dateOfBirthLabel;

  /// No description provided for @termsNotice.
  ///
  /// In en, this message translates to:
  /// **'By tapping Continue you accept the Terms of Service and Privacy Policy.'**
  String get termsNotice;

  /// No description provided for @viewTerms.
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get viewTerms;

  /// No description provided for @viewPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get viewPrivacy;

  /// No description provided for @fieldRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get fieldRequired;

  /// No description provided for @invalidDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'You must be at least 18.'**
  String get invalidDateOfBirth;

  /// No description provided for @pinCreateTitle.
  ///
  /// In en, this message translates to:
  /// **'Create a 6-digit PIN'**
  String get pinCreateTitle;

  /// No description provided for @pinCreateBody.
  ///
  /// In en, this message translates to:
  /// **'You\'ll use it if Face ID or fingerprint isn\'t available.'**
  String get pinCreateBody;

  /// No description provided for @pinConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the same PIN again'**
  String get pinConfirmTitle;

  /// No description provided for @pinMismatch.
  ///
  /// In en, this message translates to:
  /// **'The PINs don\'t match. Try again.'**
  String get pinMismatch;

  /// No description provided for @pinEnterTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your PIN'**
  String get pinEnterTitle;

  /// No description provided for @pinFieldLabel.
  ///
  /// In en, this message translates to:
  /// **'PIN'**
  String get pinFieldLabel;

  /// No description provided for @enableBiometricsTitle.
  ///
  /// In en, this message translates to:
  /// **'Approve with Face ID or fingerprint?'**
  String get enableBiometricsTitle;

  /// No description provided for @enableBiometricsBody.
  ///
  /// In en, this message translates to:
  /// **'Payments start your biometric check automatically. Your PIN stays the fallback.'**
  String get enableBiometricsBody;

  /// No description provided for @enableBiometrics.
  ///
  /// In en, this message translates to:
  /// **'Turn on'**
  String get enableBiometrics;

  /// No description provided for @notNow.
  ///
  /// In en, this message translates to:
  /// **'Not now'**
  String get notNow;

  /// No description provided for @biometricReasonUnlock.
  ///
  /// In en, this message translates to:
  /// **'Unlock XenDirekt'**
  String get biometricReasonUnlock;

  /// No description provided for @biometricReasonPay.
  ///
  /// In en, this message translates to:
  /// **'Approve this payment'**
  String get biometricReasonPay;

  /// No description provided for @biometricReasonSensitive.
  ///
  /// In en, this message translates to:
  /// **'Confirm it\'s you'**
  String get biometricReasonSensitive;

  /// No description provided for @unlockTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get unlockTitle;

  /// No description provided for @unlockWithBiometrics.
  ///
  /// In en, this message translates to:
  /// **'Unlock'**
  String get unlockWithBiometrics;

  /// No description provided for @usePinInstead.
  ///
  /// In en, this message translates to:
  /// **'Use PIN instead'**
  String get usePinInstead;

  /// No description provided for @logOut.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logOut;

  /// No description provided for @errorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'No connection. Check your internet and try again.'**
  String get errorNetwork;

  /// No description provided for @errorTimeout.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than usual. Please check again in a moment.'**
  String get errorTimeout;

  /// No description provided for @errorRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait a moment and try again.'**
  String get errorRateLimited;

  /// No description provided for @errorOtpInvalid.
  ///
  /// In en, this message translates to:
  /// **'That code is not correct.'**
  String get errorOtpInvalid;

  /// No description provided for @errorOtpExpired.
  ///
  /// In en, this message translates to:
  /// **'That code has expired. Request a new one.'**
  String get errorOtpExpired;

  /// No description provided for @errorOtpAttempts.
  ///
  /// In en, this message translates to:
  /// **'Too many wrong codes. Request a new one.'**
  String get errorOtpAttempts;

  /// No description provided for @errorPinInvalid.
  ///
  /// In en, this message translates to:
  /// **'That PIN is not correct.'**
  String get errorPinInvalid;

  /// No description provided for @errorPinLocked.
  ///
  /// In en, this message translates to:
  /// **'PIN entry is locked for a while after too many attempts.'**
  String get errorPinLocked;

  /// No description provided for @errorSessionEnded.
  ///
  /// In en, this message translates to:
  /// **'Your session has ended. Please sign in again.'**
  String get errorSessionEnded;

  /// No description provided for @errorAccountBlocked.
  ///
  /// In en, this message translates to:
  /// **'This account is blocked. Please contact support.'**
  String get errorAccountBlocked;

  /// No description provided for @errorPayeeNotFound.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t find this MoMo account. Check the number with the seller.'**
  String get errorPayeeNotFound;

  /// No description provided for @errorNetworkNotSupported.
  ///
  /// In en, this message translates to:
  /// **'XenDirekt currently supports MTN MoMo numbers only.'**
  String get errorNetworkNotSupported;

  /// No description provided for @errorInvalidPayee.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid Rwandan MoMo number.'**
  String get errorInvalidPayee;

  /// No description provided for @errorPayeeBlocked.
  ///
  /// In en, this message translates to:
  /// **'Payments to this account are not available.'**
  String get errorPayeeBlocked;

  /// No description provided for @errorQuoteExpired.
  ///
  /// In en, this message translates to:
  /// **'The price was updated. Please confirm the new total.'**
  String get errorQuoteExpired;

  /// No description provided for @errorAmountRange.
  ///
  /// In en, this message translates to:
  /// **'The amount is outside the allowed range.'**
  String get errorAmountRange;

  /// No description provided for @errorLimitExceeded.
  ///
  /// In en, this message translates to:
  /// **'This payment is above your limit. Verify your identity to raise it.'**
  String get errorLimitExceeded;

  /// No description provided for @errorCardDeclined.
  ///
  /// In en, this message translates to:
  /// **'Your bank declined this payment. Try another card or contact your bank.'**
  String get errorCardDeclined;

  /// No description provided for @errorThreeDsAbandoned.
  ///
  /// In en, this message translates to:
  /// **'Your bank\'s security check wasn\'t completed, so the payment was stopped.'**
  String get errorThreeDsAbandoned;

  /// No description provided for @errorPayoutFailed.
  ///
  /// In en, this message translates to:
  /// **'The seller\'s MoMo account couldn\'t receive this payment, so we stopped it.'**
  String get errorPayoutFailed;

  /// No description provided for @errorPendingReview.
  ///
  /// In en, this message translates to:
  /// **'Your payment is being checked. We\'ll notify you within 30 minutes.'**
  String get errorPendingReview;

  /// No description provided for @errorCardNotEligible.
  ///
  /// In en, this message translates to:
  /// **'This card can\'t be used with XenDirekt.'**
  String get errorCardNotEligible;

  /// No description provided for @errorCardLimit.
  ///
  /// In en, this message translates to:
  /// **'You can save up to 3 cards.'**
  String get errorCardLimit;

  /// No description provided for @errorCapabilityNotConfigured.
  ///
  /// In en, this message translates to:
  /// **'This isn\'t available yet.'**
  String get errorCapabilityNotConfigured;

  /// No description provided for @errorProviderUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Our payment partner isn\'t responding. Please try again shortly.'**
  String get errorProviderUnavailable;

  /// No description provided for @errorPaymentsPaused.
  ///
  /// In en, this message translates to:
  /// **'Payments are paused for a moment. You have not been charged. Please try again shortly.'**
  String get errorPaymentsPaused;

  /// No description provided for @errorInsecureConnection.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t open a secure connection. Check your network.'**
  String get errorInsecureConnection;

  /// No description provided for @chooseCountry.
  ///
  /// In en, this message translates to:
  /// **'Choose your country'**
  String get chooseCountry;

  /// No description provided for @searchCountry.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get searchCountry;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @languageSystem.
  ///
  /// In en, this message translates to:
  /// **'Device language'**
  String get languageSystem;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageFrench.
  ///
  /// In en, this message translates to:
  /// **'Français'**
  String get languageFrench;

  /// No description provided for @biometricsToggle.
  ///
  /// In en, this message translates to:
  /// **'Face ID / fingerprint'**
  String get biometricsToggle;

  /// No description provided for @changePin.
  ///
  /// In en, this message translates to:
  /// **'Change PIN'**
  String get changePin;

  /// No description provided for @newPinTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a new PIN'**
  String get newPinTitle;

  /// No description provided for @pinChanged.
  ///
  /// In en, this message translates to:
  /// **'PIN changed.'**
  String get pinChanged;

  /// No description provided for @deleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get deleteAccount;

  /// No description provided for @deleteAccountBody.
  ///
  /// In en, this message translates to:
  /// **'Your profile and cards are removed and you are signed out everywhere. Payment records are kept as the law requires.'**
  String get deleteAccountBody;

  /// No description provided for @holdToDelete.
  ///
  /// In en, this message translates to:
  /// **'Hold to delete'**
  String get holdToDelete;

  /// No description provided for @termsAndPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Terms and privacy'**
  String get termsAndPrivacy;

  /// No description provided for @profileSection.
  ///
  /// In en, this message translates to:
  /// **'Your details'**
  String get profileSection;

  /// No description provided for @securitySection.
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get securitySection;

  /// No description provided for @notSet.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get notSet;

  /// No description provided for @checking.
  ///
  /// In en, this message translates to:
  /// **'Checking…'**
  String get checking;

  /// No description provided for @offlineRetry.
  ///
  /// In en, this message translates to:
  /// **'We can\'t reach XenDirekt right now.'**
  String get offlineRetry;

  /// No description provided for @payTitle.
  ///
  /// In en, this message translates to:
  /// **'Pay'**
  String get payTitle;

  /// No description provided for @historyTitle.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get historyTitle;

  /// No description provided for @profileTitleTab.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitleTab;

  /// No description provided for @cardsSection.
  ///
  /// In en, this message translates to:
  /// **'Cards'**
  String get cardsSection;

  /// No description provided for @addCard.
  ///
  /// In en, this message translates to:
  /// **'Add card'**
  String get addCard;

  /// No description provided for @defaultCard.
  ///
  /// In en, this message translates to:
  /// **'Default'**
  String get defaultCard;

  /// No description provided for @makeDefault.
  ///
  /// In en, this message translates to:
  /// **'Make default'**
  String get makeDefault;

  /// No description provided for @removeCard.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get removeCard;

  /// No description provided for @cardRemoved.
  ///
  /// In en, this message translates to:
  /// **'Card removed'**
  String get cardRemoved;

  /// No description provided for @cardAdded.
  ///
  /// In en, this message translates to:
  /// **'Card added'**
  String get cardAdded;

  /// No description provided for @addCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Add a card'**
  String get addCardTitle;

  /// No description provided for @noCards.
  ///
  /// In en, this message translates to:
  /// **'Add a card to start paying.'**
  String get noCards;

  /// No description provided for @cardExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires {date}'**
  String cardExpires(String date);

  /// No description provided for @errorCardSetupFailed.
  ///
  /// In en, this message translates to:
  /// **'Your bank couldn\'t verify this card. Try another card.'**
  String get errorCardSetupFailed;

  /// No description provided for @momoNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Seller\'s MTN MoMo number'**
  String get momoNumberLabel;

  /// No description provided for @momoNumberHint.
  ///
  /// In en, this message translates to:
  /// **'078 123 4567'**
  String get momoNumberHint;

  /// No description provided for @mtnMomo.
  ///
  /// In en, this message translates to:
  /// **'MTN MoMo'**
  String get mtnMomo;

  /// No description provided for @lookingUp.
  ///
  /// In en, this message translates to:
  /// **'Finding the account…'**
  String get lookingUp;

  /// No description provided for @checkNameHint.
  ///
  /// In en, this message translates to:
  /// **'Check the name with the seller before you pay.'**
  String get checkNameHint;

  /// No description provided for @amountLabel.
  ///
  /// In en, this message translates to:
  /// **'Amount in RWF'**
  String get amountLabel;

  /// No description provided for @sellerReceives.
  ///
  /// In en, this message translates to:
  /// **'Seller receives'**
  String get sellerReceives;

  /// No description provided for @xendirektFee.
  ///
  /// In en, this message translates to:
  /// **'XenDirekt fee'**
  String get xendirektFee;

  /// No description provided for @youPay.
  ///
  /// In en, this message translates to:
  /// **'You pay'**
  String get youPay;

  /// No description provided for @exchangeRate.
  ///
  /// In en, this message translates to:
  /// **'Rate'**
  String get exchangeRate;

  /// No description provided for @payWithCard.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get payWithCard;

  /// No description provided for @chooseCard.
  ///
  /// In en, this message translates to:
  /// **'Choose a card'**
  String get chooseCard;

  /// No description provided for @recentPayees.
  ///
  /// In en, this message translates to:
  /// **'Recent'**
  String get recentPayees;

  /// No description provided for @payButton.
  ///
  /// In en, this message translates to:
  /// **'Pay'**
  String get payButton;

  /// No description provided for @quoteRefreshing.
  ///
  /// In en, this message translates to:
  /// **'Updating the price…'**
  String get quoteRefreshing;

  /// No description provided for @noteLabel.
  ///
  /// In en, this message translates to:
  /// **'Note for the seller (optional)'**
  String get noteLabel;

  /// No description provided for @stepProcessing.
  ///
  /// In en, this message translates to:
  /// **'Processing'**
  String get stepProcessing;

  /// No description provided for @stepSent.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get stepSent;

  /// No description provided for @stepReceived.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get stepReceived;

  /// No description provided for @checkingPayment.
  ///
  /// In en, this message translates to:
  /// **'Checking your payment…'**
  String get checkingPayment;

  /// No description provided for @confirmWithBank.
  ///
  /// In en, this message translates to:
  /// **'Confirm with your bank'**
  String get confirmWithBank;

  /// No description provided for @confirmWithBankBody.
  ///
  /// In en, this message translates to:
  /// **'Your bank needs to confirm this payment.'**
  String get confirmWithBankBody;

  /// No description provided for @openBankCheck.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get openBankCheck;

  /// No description provided for @successTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment sent'**
  String get successTitle;

  /// No description provided for @successBody.
  ///
  /// In en, this message translates to:
  /// **'{name} received {amount}.'**
  String successBody(String name, String amount);

  /// No description provided for @failedTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment not completed'**
  String get failedTitle;

  /// No description provided for @notCharged.
  ///
  /// In en, this message translates to:
  /// **'You have not been charged.'**
  String get notCharged;

  /// No description provided for @holdReleasing.
  ///
  /// In en, this message translates to:
  /// **'Your bank\'s hold is being released. You have not been charged.'**
  String get holdReleasing;

  /// No description provided for @reviewTitle.
  ///
  /// In en, this message translates to:
  /// **'We\'re checking your payment'**
  String get reviewTitle;

  /// No description provided for @refundedTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment refunded'**
  String get refundedTitle;

  /// No description provided for @shareReceipt.
  ///
  /// In en, this message translates to:
  /// **'Share receipt'**
  String get shareReceipt;

  /// No description provided for @receiptTitle.
  ///
  /// In en, this message translates to:
  /// **'Receipt'**
  String get receiptTitle;

  /// No description provided for @reference.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get reference;

  /// No description provided for @dateTime.
  ///
  /// In en, this message translates to:
  /// **'Date (Kigali time)'**
  String get dateTime;

  /// No description provided for @merchant.
  ///
  /// In en, this message translates to:
  /// **'Seller'**
  String get merchant;

  /// No description provided for @cardCharged.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get cardCharged;

  /// No description provided for @statusLabel.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get statusLabel;

  /// No description provided for @statusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get statusCompleted;

  /// No description provided for @statusFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get statusFailed;

  /// No description provided for @statusInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get statusInProgress;

  /// No description provided for @statusInReview.
  ///
  /// In en, this message translates to:
  /// **'Being checked'**
  String get statusInReview;

  /// No description provided for @statusRefunded.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get statusRefunded;

  /// No description provided for @filterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get filterAll;

  /// No description provided for @noPayments.
  ///
  /// In en, this message translates to:
  /// **'Your payments will appear here.'**
  String get noPayments;

  /// No description provided for @loadMore.
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get loadMore;

  /// No description provided for @payAgain.
  ///
  /// In en, this message translates to:
  /// **'Pay again'**
  String get payAgain;

  /// No description provided for @addCardToPay.
  ///
  /// In en, this message translates to:
  /// **'Add a card to pay'**
  String get addCardToPay;

  /// No description provided for @sandboxReceiptNote.
  ///
  /// In en, this message translates to:
  /// **'Sandbox: simulated, no real money moved.'**
  String get sandboxReceiptNote;

  /// No description provided for @receiptShareText.
  ///
  /// In en, this message translates to:
  /// **'XenDirekt receipt {reference}\nPaid {amountRwf} to {merchant} on {date} (Kigali).\nCharged {total} to {card}.'**
  String receiptShareText(
    String reference,
    String amountRwf,
    String merchant,
    String date,
    String total,
    String card,
  );

  /// No description provided for @reportProblem.
  ///
  /// In en, this message translates to:
  /// **'Report a problem'**
  String get reportProblem;

  /// No description provided for @reportProblemTitle.
  ///
  /// In en, this message translates to:
  /// **'What went wrong?'**
  String get reportProblemTitle;

  /// No description provided for @reportSent.
  ///
  /// In en, this message translates to:
  /// **'Thanks — we\'ve received your report {reference}.'**
  String reportSent(String reference);

  /// No description provided for @ticketSellerNotPaid.
  ///
  /// In en, this message translates to:
  /// **'Seller didn\'t receive it'**
  String get ticketSellerNotPaid;

  /// No description provided for @ticketWrongAmount.
  ///
  /// In en, this message translates to:
  /// **'Wrong amount'**
  String get ticketWrongAmount;

  /// No description provided for @ticketChargedButFailed.
  ///
  /// In en, this message translates to:
  /// **'Charged but it failed'**
  String get ticketChargedButFailed;

  /// No description provided for @ticketChargedTwice.
  ///
  /// In en, this message translates to:
  /// **'Charged twice'**
  String get ticketChargedTwice;

  /// No description provided for @ticketWrongSeller.
  ///
  /// In en, this message translates to:
  /// **'Paid the wrong seller'**
  String get ticketWrongSeller;

  /// No description provided for @ticketRefundRequest.
  ///
  /// In en, this message translates to:
  /// **'I need a refund'**
  String get ticketRefundRequest;

  /// No description provided for @ticketAppProblem.
  ///
  /// In en, this message translates to:
  /// **'Problem with the app'**
  String get ticketAppProblem;

  /// No description provided for @ticketOther.
  ///
  /// In en, this message translates to:
  /// **'Something else'**
  String get ticketOther;

  /// No description provided for @addDetails.
  ///
  /// In en, this message translates to:
  /// **'Add details (optional)'**
  String get addDetails;

  /// No description provided for @send.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get send;

  /// No description provided for @helpCentre.
  ///
  /// In en, this message translates to:
  /// **'Help'**
  String get helpCentre;

  /// No description provided for @myRequests.
  ///
  /// In en, this message translates to:
  /// **'My requests'**
  String get myRequests;

  /// No description provided for @noRequests.
  ///
  /// In en, this message translates to:
  /// **'You haven\'t reported any problems.'**
  String get noRequests;

  /// No description provided for @contactSupport.
  ///
  /// In en, this message translates to:
  /// **'Contact support'**
  String get contactSupport;

  /// No description provided for @notificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notificationsTitle;

  /// No description provided for @noNotifications.
  ///
  /// In en, this message translates to:
  /// **'You\'re all caught up.'**
  String get noNotifications;

  /// No description provided for @ticketStatusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get ticketStatusOpen;

  /// No description provided for @ticketStatusInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get ticketStatusInProgress;

  /// No description provided for @ticketStatusResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved'**
  String get ticketStatusResolved;

  /// No description provided for @ticketStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get ticketStatusClosed;

  /// No description provided for @faq1q.
  ///
  /// In en, this message translates to:
  /// **'How does XenDirekt work?'**
  String get faq1q;

  /// No description provided for @faq1a.
  ///
  /// In en, this message translates to:
  /// **'Type the seller\'s MTN MoMo number and the amount in Rwandan francs. We show the name registered to that account, the fee and what your card will be charged. Tap Pay, confirm with Face ID or your PIN, and the seller receives francs in their MoMo account.'**
  String get faq1a;

  /// No description provided for @faq2q.
  ///
  /// In en, this message translates to:
  /// **'Will I be charged if a payment fails?'**
  String get faq2q;

  /// No description provided for @faq2a.
  ///
  /// In en, this message translates to:
  /// **'No. Your card is only held first and charged after the seller\'s MoMo account has received the money. If the seller can\'t receive it, the hold is released and you are not charged.'**
  String get faq2a;

  /// No description provided for @faq3q.
  ///
  /// In en, this message translates to:
  /// **'Which numbers can I pay?'**
  String get faq3q;

  /// No description provided for @faq3a.
  ///
  /// In en, this message translates to:
  /// **'Any active MTN MoMo account in Rwanda. Other networks are not supported yet.'**
  String get faq3a;

  /// No description provided for @faq4q.
  ///
  /// In en, this message translates to:
  /// **'Is my card safe?'**
  String get faq4q;

  /// No description provided for @faq4a.
  ///
  /// In en, this message translates to:
  /// **'Your card details are entered on our licensed payment partner\'s secure page. XenDirekt never sees or stores your card number or security code.'**
  String get faq4a;

  /// No description provided for @faq5q.
  ///
  /// In en, this message translates to:
  /// **'What fees do I pay?'**
  String get faq5q;

  /// No description provided for @faq5a.
  ///
  /// In en, this message translates to:
  /// **'You see the XenDirekt fee, the exchange rate and the exact total in your card\'s currency before you pay. Your bank may add its own foreign transaction fees.'**
  String get faq5a;

  /// No description provided for @faq6q.
  ///
  /// In en, this message translates to:
  /// **'What is the extra check from my bank?'**
  String get faq6q;

  /// No description provided for @faq6a.
  ///
  /// In en, this message translates to:
  /// **'Banks often ask you to confirm the first payment with a card (3-D Secure), for example with a code or in your banking app. It protects you from fraud.'**
  String get faq6a;

  /// No description provided for @faq7q.
  ///
  /// In en, this message translates to:
  /// **'The seller says the money didn\'t arrive. What now?'**
  String get faq7q;

  /// No description provided for @faq7a.
  ///
  /// In en, this message translates to:
  /// **'Open the payment in History and tap Report a problem. The payment reference is attached automatically and our team will look into it.'**
  String get faq7a;

  /// No description provided for @faq8q.
  ///
  /// In en, this message translates to:
  /// **'Why is my payment being checked?'**
  String get faq8q;

  /// No description provided for @faq8a.
  ///
  /// In en, this message translates to:
  /// **'Sometimes the mobile money network doesn\'t answer in time, or a payment needs a quick safety review. We\'ll update you within 30 minutes, and you\'ll never be charged twice.'**
  String get faq8a;

  /// No description provided for @ageYears.
  ///
  /// In en, this message translates to:
  /// **'{age, plural, =1{1 year old} other{{age} years old}}'**
  String ageYears(int age);

  /// No description provided for @dobPickerSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You must be 18 or older to use XenDirekt.'**
  String get dobPickerSubtitle;

  /// No description provided for @profileSubtitle.
  ///
  /// In en, this message translates to:
  /// **'A few details to keep your payments safe. It takes 30 seconds.'**
  String get profileSubtitle;

  /// No description provided for @stepOf.
  ///
  /// In en, this message translates to:
  /// **'Step {current} of {total}'**
  String stepOf(int current, int total);

  /// No description provided for @selectPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get selectPlaceholder;

  /// No description provided for @sectionPreferences.
  ///
  /// In en, this message translates to:
  /// **'Preferences'**
  String get sectionPreferences;

  /// No description provided for @sectionSupport.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get sectionSupport;

  /// No description provided for @sectionDangerZone.
  ///
  /// In en, this message translates to:
  /// **'Danger zone'**
  String get sectionDangerZone;

  /// No description provided for @sandboxAccount.
  ///
  /// In en, this message translates to:
  /// **'Sandbox account'**
  String get sandboxAccount;

  /// No description provided for @verifiedAccount.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get verifiedAccount;

  /// No description provided for @cardsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No cards yet} =1{1 of 3 cards} other{{count} of 3 cards}}'**
  String cardsCount(int count);

  /// No description provided for @addFirstCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Add your first card'**
  String get addFirstCardTitle;

  /// No description provided for @addFirstCardBody.
  ///
  /// In en, this message translates to:
  /// **'Card details go straight to our payment partner. XenDirekt never sees your card number.'**
  String get addFirstCardBody;

  /// No description provided for @biometricsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Approve payments with a glance or a touch'**
  String get biometricsSubtitle;

  /// No description provided for @changePinSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your 6-digit fallback code'**
  String get changePinSubtitle;

  /// No description provided for @notificationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Payment updates and messages'**
  String get notificationsSubtitle;

  /// No description provided for @helpSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Questions, problems and requests'**
  String get helpSubtitle;

  /// No description provided for @termsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'How we handle your data'**
  String get termsSubtitle;

  /// No description provided for @greetingMorning.
  ///
  /// In en, this message translates to:
  /// **'Good morning'**
  String get greetingMorning;

  /// No description provided for @greetingAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Good afternoon'**
  String get greetingAfternoon;

  /// No description provided for @greetingEvening.
  ///
  /// In en, this message translates to:
  /// **'Good evening'**
  String get greetingEvening;

  /// No description provided for @greetingWithName.
  ///
  /// In en, this message translates to:
  /// **'{greeting}, {name}'**
  String greetingWithName(String greeting, String name);

  /// No description provided for @paySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pay any MTN MoMo account with your card.'**
  String get paySubtitle;

  /// No description provided for @sendTo.
  ///
  /// In en, this message translates to:
  /// **'Send to'**
  String get sendTo;

  /// No description provided for @amountSection.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get amountSection;

  /// No description provided for @payWithLabel.
  ///
  /// In en, this message translates to:
  /// **'Pay with'**
  String get payWithLabel;

  /// No description provided for @summarySection.
  ///
  /// In en, this message translates to:
  /// **'Summary'**
  String get summarySection;

  /// No description provided for @rateHeldFor.
  ///
  /// In en, this message translates to:
  /// **'Rate held for {time}'**
  String rateHeldFor(String time);

  /// No description provided for @registeredNameVerified.
  ///
  /// In en, this message translates to:
  /// **'Registered name'**
  String get registeredNameVerified;

  /// No description provided for @historySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Every payment you have made, newest first.'**
  String get historySubtitle;

  /// No description provided for @today.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get today;

  /// No description provided for @yesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get yesterday;

  /// No description provided for @noPaymentsTitle.
  ///
  /// In en, this message translates to:
  /// **'No payments yet'**
  String get noPaymentsTitle;

  /// No description provided for @makePayment.
  ///
  /// In en, this message translates to:
  /// **'Make a payment'**
  String get makePayment;

  /// No description provided for @featureMomo.
  ///
  /// In en, this message translates to:
  /// **'Pay any MTN MoMo number or shop'**
  String get featureMomo;

  /// No description provided for @featureCard.
  ///
  /// In en, this message translates to:
  /// **'Use the Visa or Mastercard you already carry'**
  String get featureCard;

  /// No description provided for @featureName.
  ///
  /// In en, this message translates to:
  /// **'See the seller\'s registered name before you pay'**
  String get featureName;

  /// No description provided for @securedByPartner.
  ///
  /// In en, this message translates to:
  /// **'Card details are handled by our licensed payment partner.'**
  String get securedByPartner;

  /// No description provided for @signInSubtitleEmail.
  ///
  /// In en, this message translates to:
  /// **'We\'ll send you a 6-digit code. No password needed.'**
  String get signInSubtitleEmail;

  /// No description provided for @signInSubtitlePhone.
  ///
  /// In en, this message translates to:
  /// **'We\'ll text you a 6-digit code. No password needed.'**
  String get signInSubtitlePhone;

  /// No description provided for @appearance.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get appearance;

  /// No description provided for @themeSystem.
  ///
  /// In en, this message translates to:
  /// **'Same as device'**
  String get themeSystem;

  /// No description provided for @themeLight.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get themeDark;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'fr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'fr':
      return AppLocalizationsFr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}

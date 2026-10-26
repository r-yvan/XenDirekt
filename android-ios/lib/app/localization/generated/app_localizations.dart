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
  /// **'Payment not completed. You were not charged.'**
  String get errorThreeDsAbandoned;

  /// No description provided for @errorPayoutFailed.
  ///
  /// In en, this message translates to:
  /// **'The seller\'s MoMo couldn\'t receive this payment. You have not been charged.'**
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

// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appName => 'XenDirekt';

  @override
  String get tagline =>
      'Payez n\'importe quel compte MTN MoMo au Rwanda avec votre propre carte.';

  @override
  String get continueLabel => 'Continuer';

  @override
  String get retry => 'Réessayer';

  @override
  String get cancel => 'Annuler';

  @override
  String get done => 'Terminé';

  @override
  String get undo => 'Annuler l\'action';

  @override
  String get close => 'Fermer';

  @override
  String get loading => 'Chargement…';

  @override
  String get sandboxBanner =>
      'Bac à sable : aucun argent réel n\'est transféré';

  @override
  String get offlineBanner => 'Vous êtes hors ligne. Reconnexion automatique.';

  @override
  String get providerOutageBanner =>
      'Les paiements sont plus lents que d\'habitude. Vous ne serez jamais débité deux fois.';

  @override
  String get tabPay => 'Payer';

  @override
  String get tabHistory => 'Historique';

  @override
  String get tabProfile => 'Profil';

  @override
  String get welcomeTitle =>
      'Payez n\'importe quelle boutique au Rwanda avec votre carte';

  @override
  String get continueWithEmail => 'Continuer avec l\'e-mail';

  @override
  String get continueWithPhone => 'Continuer avec le téléphone';

  @override
  String get continueWithApple => 'Continuer avec Apple';

  @override
  String get continueWithGoogle => 'Continuer avec Google';

  @override
  String get emailTitle => 'Quelle est votre adresse e-mail ?';

  @override
  String get emailLabel => 'E-mail';

  @override
  String get phoneTitle => 'Quel est votre numéro de téléphone ?';

  @override
  String get phoneLabel => 'Numéro avec indicatif du pays';

  @override
  String get phoneHint => '+33 6 12 34 56 78';

  @override
  String get invalidEmail => 'Saisissez une adresse e-mail valide.';

  @override
  String get invalidPhone =>
      'Saisissez votre numéro avec l\'indicatif, en commençant par +.';

  @override
  String get otpTitle => 'Saisissez le code à 6 chiffres';

  @override
  String otpSentTo(String destination) {
    return 'Nous l\'avons envoyé à $destination.';
  }

  @override
  String get otpResend => 'Recevoir un nouveau code';

  @override
  String otpResendIn(int seconds) {
    return 'Nouveau code dans $seconds s';
  }

  @override
  String get otpFieldLabel => 'Code à usage unique';

  @override
  String get profileTitle => 'À propos de vous';

  @override
  String get fullNameLabel => 'Nom complet';

  @override
  String get countryLabel => 'Pays de résidence';

  @override
  String get dateOfBirthLabel => 'Date de naissance';

  @override
  String get termsNotice =>
      'En appuyant sur Continuer, vous acceptez les Conditions d\'utilisation et la Politique de confidentialité.';

  @override
  String get viewTerms => 'Conditions d\'utilisation';

  @override
  String get viewPrivacy => 'Politique de confidentialité';

  @override
  String get fieldRequired => 'Obligatoire';

  @override
  String get invalidDateOfBirth => 'Vous devez avoir au moins 18 ans.';

  @override
  String get pinCreateTitle => 'Créez un code PIN à 6 chiffres';

  @override
  String get pinCreateBody =>
      'Il servira si Face ID ou l\'empreinte n\'est pas disponible.';

  @override
  String get pinConfirmTitle => 'Saisissez à nouveau le même code';

  @override
  String get pinMismatch => 'Les codes ne correspondent pas. Réessayez.';

  @override
  String get pinEnterTitle => 'Saisissez votre code PIN';

  @override
  String get pinFieldLabel => 'Code PIN';

  @override
  String get enableBiometricsTitle => 'Valider avec Face ID ou l\'empreinte ?';

  @override
  String get enableBiometricsBody =>
      'Chaque paiement lance automatiquement la vérification biométrique. Le code PIN reste disponible.';

  @override
  String get enableBiometrics => 'Activer';

  @override
  String get notNow => 'Plus tard';

  @override
  String get biometricReasonUnlock => 'Déverrouiller XenDirekt';

  @override
  String get biometricReasonPay => 'Valider ce paiement';

  @override
  String get biometricReasonSensitive => 'Confirmez votre identité';

  @override
  String get unlockTitle => 'Bon retour';

  @override
  String get unlockWithBiometrics => 'Déverrouiller';

  @override
  String get usePinInstead => 'Utiliser le code PIN';

  @override
  String get logOut => 'Se déconnecter';

  @override
  String get errorGeneric => 'Une erreur s\'est produite. Veuillez réessayer.';

  @override
  String get errorNetwork =>
      'Pas de connexion. Vérifiez votre accès Internet et réessayez.';

  @override
  String get errorTimeout =>
      'Cela prend plus de temps que prévu. Vérifiez de nouveau dans un instant.';

  @override
  String get errorRateLimited =>
      'Trop de tentatives. Patientez un instant puis réessayez.';

  @override
  String get errorOtpInvalid => 'Ce code est incorrect.';

  @override
  String get errorOtpExpired => 'Ce code a expiré. Demandez-en un nouveau.';

  @override
  String get errorOtpAttempts =>
      'Trop de codes erronés. Demandez-en un nouveau.';

  @override
  String get errorPinInvalid => 'Ce code PIN est incorrect.';

  @override
  String get errorPinLocked =>
      'La saisie du code PIN est bloquée temporairement après trop de tentatives.';

  @override
  String get errorSessionEnded =>
      'Votre session a pris fin. Veuillez vous reconnecter.';

  @override
  String get errorAccountBlocked =>
      'Ce compte est bloqué. Veuillez contacter l\'assistance.';

  @override
  String get errorPayeeNotFound =>
      'Nous n\'avons pas trouvé ce compte MoMo. Vérifiez le numéro avec le vendeur.';

  @override
  String get errorNetworkNotSupported =>
      'XenDirekt prend en charge uniquement les numéros MTN MoMo pour le moment.';

  @override
  String get errorInvalidPayee => 'Saisissez un numéro MoMo rwandais valide.';

  @override
  String get errorPayeeBlocked =>
      'Les paiements vers ce compte ne sont pas disponibles.';

  @override
  String get errorQuoteExpired =>
      'Le prix a été mis à jour. Veuillez confirmer le nouveau total.';

  @override
  String get errorAmountRange =>
      'Le montant est en dehors de la plage autorisée.';

  @override
  String get errorLimitExceeded =>
      'Ce paiement dépasse votre limite. Vérifiez votre identité pour l\'augmenter.';

  @override
  String get errorCardDeclined =>
      'Votre banque a refusé ce paiement. Essayez une autre carte ou contactez votre banque.';

  @override
  String get errorThreeDsAbandoned =>
      'Paiement non effectué. Vous n\'avez pas été débité.';

  @override
  String get errorPayoutFailed =>
      'Le compte MoMo du vendeur n\'a pas pu recevoir ce paiement. Vous n\'avez pas été débité.';

  @override
  String get errorPendingReview =>
      'Votre paiement est en cours de vérification. Nous vous informerons dans les 30 minutes.';

  @override
  String get errorCardNotEligible =>
      'Cette carte ne peut pas être utilisée avec XenDirekt.';

  @override
  String get errorCardLimit => 'Vous pouvez enregistrer jusqu\'à 3 cartes.';

  @override
  String get errorCapabilityNotConfigured =>
      'Ce service n\'est pas encore disponible.';

  @override
  String get errorProviderUnavailable =>
      'Notre partenaire de paiement ne répond pas. Réessayez dans quelques instants.';

  @override
  String get errorInsecureConnection =>
      'Impossible d\'établir une connexion sécurisée. Vérifiez votre réseau.';

  @override
  String get chooseCountry => 'Choisissez votre pays';

  @override
  String get searchCountry => 'Rechercher';

  @override
  String get language => 'Langue';

  @override
  String get languageSystem => 'Langue de l\'appareil';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageFrench => 'Français';

  @override
  String get biometricsToggle => 'Face ID / empreinte';

  @override
  String get changePin => 'Modifier le code PIN';

  @override
  String get newPinTitle => 'Choisissez un nouveau code PIN';

  @override
  String get pinChanged => 'Code PIN modifié.';

  @override
  String get deleteAccount => 'Supprimer le compte';

  @override
  String get deleteAccountBody =>
      'Votre profil et vos cartes sont supprimés et vous êtes déconnecté partout. Les relevés de paiement sont conservés comme l\'exige la loi.';

  @override
  String get holdToDelete => 'Maintenir pour supprimer';

  @override
  String get termsAndPrivacy => 'Conditions et confidentialité';

  @override
  String get profileSection => 'Vos informations';

  @override
  String get securitySection => 'Sécurité';

  @override
  String get notSet => 'Non renseigné';

  @override
  String get checking => 'Vérification…';

  @override
  String get offlineRetry => 'Impossible de joindre XenDirekt pour le moment.';

  @override
  String get payTitle => 'Payer';

  @override
  String get historyTitle => 'Historique';

  @override
  String get profileTitleTab => 'Profil';

  @override
  String get cardsSection => 'Cartes';

  @override
  String get addCard => 'Ajouter une carte';

  @override
  String get defaultCard => 'Par défaut';

  @override
  String get makeDefault => 'Définir par défaut';

  @override
  String get removeCard => 'Retirer';

  @override
  String get cardRemoved => 'Carte retirée';

  @override
  String get cardAdded => 'Carte ajoutée';

  @override
  String get addCardTitle => 'Ajouter une carte';

  @override
  String get noCards => 'Ajoutez une carte pour commencer à payer.';

  @override
  String cardExpires(String date) {
    return 'Expire $date';
  }

  @override
  String get errorCardSetupFailed =>
      'Votre banque n\'a pas pu vérifier cette carte. Essayez une autre carte.';
}

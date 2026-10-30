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
  String get hostedPageInNewTab =>
      'La page s\'est ouverte dans un nouvel onglet. Terminez-la, puis revenez et appuyez sur Continuer.';

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
  String get paymentsPausedBanner =>
      'Les paiements sont suspendus un instant. Vos paiements passés ne sont pas concernés.';

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
      'La vérification de sécurité de votre banque n\'a pas été terminée : le paiement a été arrêté.';

  @override
  String get errorPayoutFailed =>
      'Le compte MoMo du vendeur n\'a pas pu recevoir ce paiement : nous l\'avons arrêté.';

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
  String get errorPaymentsPaused =>
      'Les paiements sont suspendus un instant. Vous n\'avez pas été débité. Réessayez dans quelques instants.';

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

  @override
  String get momoNumberLabel => 'Numéro MTN MoMo du vendeur';

  @override
  String get momoNumberHint => '078 123 4567';

  @override
  String get mtnMomo => 'MTN MoMo';

  @override
  String get lookingUp => 'Recherche du compte…';

  @override
  String get checkNameHint => 'Vérifiez le nom avec le vendeur avant de payer.';

  @override
  String get amountLabel => 'Montant en RWF';

  @override
  String get sellerReceives => 'Le vendeur reçoit';

  @override
  String get xendirektFee => 'Frais XenDirekt';

  @override
  String get youPay => 'Vous payez';

  @override
  String get exchangeRate => 'Taux';

  @override
  String get payWithCard => 'Carte';

  @override
  String get chooseCard => 'Choisir une carte';

  @override
  String get recentPayees => 'Récents';

  @override
  String get payButton => 'Payer';

  @override
  String get quoteRefreshing => 'Mise à jour du prix…';

  @override
  String get noteLabel => 'Note pour le vendeur (facultatif)';

  @override
  String get stepProcessing => 'Traitement';

  @override
  String get stepSent => 'Envoyé';

  @override
  String get stepReceived => 'Reçu';

  @override
  String get checkingPayment => 'Vérification de votre paiement…';

  @override
  String get confirmWithBank => 'Confirmez avec votre banque';

  @override
  String get confirmWithBankBody => 'Votre banque doit confirmer ce paiement.';

  @override
  String get openBankCheck => 'Continuer';

  @override
  String get successTitle => 'Paiement envoyé';

  @override
  String successBody(String name, String amount) {
    return '$name a reçu $amount.';
  }

  @override
  String get failedTitle => 'Paiement non effectué';

  @override
  String get notCharged => 'Vous n\'avez pas été débité.';

  @override
  String get holdReleasing =>
      'La réservation de votre banque est en cours d\'annulation. Vous n\'avez pas été débité.';

  @override
  String get reviewTitle => 'Nous vérifions votre paiement';

  @override
  String get refundedTitle => 'Paiement remboursé';

  @override
  String get shareReceipt => 'Partager le reçu';

  @override
  String get receiptTitle => 'Reçu';

  @override
  String get reference => 'Référence';

  @override
  String get dateTime => 'Date (heure de Kigali)';

  @override
  String get merchant => 'Vendeur';

  @override
  String get cardCharged => 'Carte';

  @override
  String get statusLabel => 'Statut';

  @override
  String get statusCompleted => 'Effectué';

  @override
  String get statusFailed => 'Échoué';

  @override
  String get statusInProgress => 'En cours';

  @override
  String get statusInReview => 'En vérification';

  @override
  String get statusRefunded => 'Remboursé';

  @override
  String get filterAll => 'Tous';

  @override
  String get noPayments => 'Vos paiements apparaîtront ici.';

  @override
  String get loadMore => 'Voir plus';

  @override
  String get payAgain => 'Payer à nouveau';

  @override
  String get addCardToPay => 'Ajoutez une carte pour payer';

  @override
  String get sandboxReceiptNote =>
      'Bac à sable : simulé, aucun argent réel transféré.';

  @override
  String receiptShareText(
    String reference,
    String amountRwf,
    String merchant,
    String date,
    String total,
    String card,
  ) {
    return 'Reçu XenDirekt $reference\nPayé $amountRwf à $merchant le $date (Kigali).\nDébité $total sur $card.';
  }

  @override
  String get reportProblem => 'Signaler un problème';

  @override
  String get reportProblemTitle => 'Quel est le problème ?';

  @override
  String reportSent(String reference) {
    return 'Merci, nous avons reçu votre signalement $reference.';
  }

  @override
  String get ticketSellerNotPaid => 'Le vendeur n\'a rien reçu';

  @override
  String get ticketWrongAmount => 'Montant incorrect';

  @override
  String get ticketChargedButFailed => 'Débité mais échoué';

  @override
  String get ticketChargedTwice => 'Débité deux fois';

  @override
  String get ticketWrongSeller => 'Mauvais vendeur payé';

  @override
  String get ticketRefundRequest => 'J\'ai besoin d\'un remboursement';

  @override
  String get ticketAppProblem => 'Problème avec l\'application';

  @override
  String get ticketOther => 'Autre chose';

  @override
  String get addDetails => 'Ajouter des détails (facultatif)';

  @override
  String get send => 'Envoyer';

  @override
  String get helpCentre => 'Aide';

  @override
  String get myRequests => 'Mes demandes';

  @override
  String get noRequests => 'Vous n\'avez signalé aucun problème.';

  @override
  String get contactSupport => 'Contacter l\'assistance';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get noNotifications => 'Vous êtes à jour.';

  @override
  String get ticketStatusOpen => 'Ouverte';

  @override
  String get ticketStatusInProgress => 'En cours';

  @override
  String get ticketStatusResolved => 'Résolue';

  @override
  String get ticketStatusClosed => 'Fermée';

  @override
  String get faq1q => 'Comment fonctionne XenDirekt ?';

  @override
  String get faq1a =>
      'Saisissez le numéro MTN MoMo du vendeur et le montant en francs rwandais. Nous affichons le nom enregistré pour ce compte, les frais et le montant débité sur votre carte. Appuyez sur Payer, confirmez avec Face ID ou votre code PIN, et le vendeur reçoit des francs sur son compte MoMo.';

  @override
  String get faq2q => 'Serai-je débité si le paiement échoue ?';

  @override
  String get faq2a =>
      'Non. Le montant est d\'abord réservé sur votre carte, puis débité seulement après la réception de l\'argent par le vendeur. Si le vendeur ne peut pas le recevoir, la réservation est annulée et vous n\'êtes pas débité.';

  @override
  String get faq3q => 'Quels numéros puis-je payer ?';

  @override
  String get faq3a =>
      'Tout compte MTN MoMo actif au Rwanda. Les autres réseaux ne sont pas encore pris en charge.';

  @override
  String get faq4q => 'Ma carte est-elle en sécurité ?';

  @override
  String get faq4a =>
      'Vos données de carte sont saisies sur la page sécurisée de notre partenaire de paiement agréé. XenDirekt ne voit ni ne conserve jamais votre numéro de carte ni votre code de sécurité.';

  @override
  String get faq5q => 'Quels frais vais-je payer ?';

  @override
  String get faq5a =>
      'Avant de payer, vous voyez les frais XenDirekt, le taux de change et le total exact dans la devise de votre carte. Votre banque peut ajouter ses propres frais à l\'étranger.';

  @override
  String get faq6q => 'Qu\'est-ce que la vérification de ma banque ?';

  @override
  String get faq6a =>
      'Les banques demandent souvent de confirmer le premier paiement avec une carte (3-D Secure), par exemple avec un code ou dans votre application bancaire. Cela vous protège contre la fraude.';

  @override
  String get faq7q =>
      'Le vendeur dit que l\'argent n\'est pas arrivé. Que faire ?';

  @override
  String get faq7a =>
      'Ouvrez le paiement dans l\'Historique et appuyez sur Signaler un problème. La référence du paiement est jointe automatiquement et notre équipe s\'en occupe.';

  @override
  String get faq8q => 'Pourquoi mon paiement est-il en vérification ?';

  @override
  String get faq8a =>
      'Parfois, le réseau de mobile money ne répond pas à temps ou un paiement nécessite une vérification de sécurité rapide. Nous vous informerons dans les 30 minutes, et vous ne serez jamais débité deux fois.';

  @override
  String ageYears(int age) {
    String _temp0 = intl.Intl.pluralLogic(
      age,
      locale: localeName,
      other: '$age ans',
      one: '1 an',
    );
    return '$_temp0';
  }

  @override
  String get dobPickerSubtitle =>
      'Vous devez avoir 18 ans ou plus pour utiliser XenDirekt.';

  @override
  String get profileSubtitle =>
      'Quelques informations pour sécuriser vos paiements. Cela prend 30 secondes.';

  @override
  String stepOf(int current, int total) {
    return 'Étape $current sur $total';
  }

  @override
  String get selectPlaceholder => 'Choisir';

  @override
  String get sectionPreferences => 'Préférences';

  @override
  String get sectionSupport => 'Assistance';

  @override
  String get sectionDangerZone => 'Zone sensible';

  @override
  String get sandboxAccount => 'Compte bac à sable';

  @override
  String get verifiedAccount => 'Vérifié';

  @override
  String cardsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count cartes sur 3',
      one: '1 carte sur 3',
      zero: 'Aucune carte',
    );
    return '$_temp0';
  }

  @override
  String get addFirstCardTitle => 'Ajoutez votre première carte';

  @override
  String get addFirstCardBody =>
      'Les données de carte vont directement à notre partenaire de paiement. XenDirekt ne voit jamais votre numéro de carte.';

  @override
  String get biometricsSubtitle =>
      'Approuvez vos paiements d\'un regard ou d\'un geste';

  @override
  String get changePinSubtitle => 'Votre code de secours à 6 chiffres';

  @override
  String get notificationsSubtitle => 'Suivi des paiements et messages';

  @override
  String get helpSubtitle => 'Questions, problèmes et demandes';

  @override
  String get termsSubtitle => 'Comment nous traitons vos données';

  @override
  String get greetingMorning => 'Bonjour';

  @override
  String get greetingAfternoon => 'Bon après-midi';

  @override
  String get greetingEvening => 'Bonsoir';

  @override
  String greetingWithName(String greeting, String name) {
    return '$greeting, $name';
  }

  @override
  String get paySubtitle =>
      'Payez n\'importe quel compte MTN MoMo avec votre carte.';

  @override
  String get sendTo => 'Destinataire';

  @override
  String get amountSection => 'Montant';

  @override
  String get payWithLabel => 'Payer avec';

  @override
  String get summarySection => 'Récapitulatif';

  @override
  String rateHeldFor(String time) {
    return 'Taux garanti pendant $time';
  }

  @override
  String get registeredNameVerified => 'Nom enregistré';

  @override
  String get historySubtitle =>
      'Tous vos paiements, du plus récent au plus ancien.';

  @override
  String get today => 'Aujourd\'hui';

  @override
  String get yesterday => 'Hier';

  @override
  String get noPaymentsTitle => 'Aucun paiement pour l\'instant';

  @override
  String get makePayment => 'Effectuer un paiement';

  @override
  String get featureMomo => 'Payez n\'importe quel numéro ou commerce MTN MoMo';

  @override
  String get featureCard =>
      'Utilisez la carte Visa ou Mastercard que vous avez déjà';

  @override
  String get featureName => 'Voyez le nom enregistré du vendeur avant de payer';

  @override
  String get securedByPartner =>
      'Les données de carte sont traitées par notre partenaire de paiement agréé.';

  @override
  String get signInSubtitleEmail =>
      'Nous vous enverrons un code à 6 chiffres. Aucun mot de passe.';

  @override
  String get signInSubtitlePhone =>
      'Nous vous enverrons un code à 6 chiffres par SMS. Aucun mot de passe.';

  @override
  String get appearance => 'Apparence';

  @override
  String get themeSystem => 'Comme l\'appareil';

  @override
  String get themeLight => 'Clair';

  @override
  String get themeDark => 'Sombre';
}

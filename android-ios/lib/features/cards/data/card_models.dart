import '../../../shared/models/json.dart';

/// Mirrors contracts/fixtures/card_added.json. No card number is ever present.
class PaymentCard {
  const PaymentCard({
    required this.id,
    required this.brand,
    required this.last4,
    required this.expiryMonth,
    required this.expiryYear,
    required this.isDefault,
    required this.simulated,
    this.issuingCountry,
    this.cardCurrency,
  });

  factory PaymentCard.fromJson(Json json) => PaymentCard(
    id: readString(json, 'id'),
    brand: readString(json, 'brand'),
    last4: readString(json, 'last4'),
    expiryMonth: readInt(json, 'expiryMonth'),
    expiryYear: readInt(json, 'expiryYear'),
    isDefault: readBool(json, 'isDefault'),
    simulated: readBool(json, 'simulated'),
    issuingCountry: readStringOrNull(json, 'issuingCountry'),
    cardCurrency: readStringOrNull(json, 'cardCurrency'),
  );

  final String id;
  final String brand;
  final String last4;
  final int expiryMonth;
  final int expiryYear;
  final bool isDefault;
  final bool simulated;
  final String? issuingCountry;
  final String? cardCurrency;

  String get brandLabel => switch (brand) {
    'VISA' => 'Visa',
    'MASTERCARD' => 'Mastercard',
    _ => brand,
  };

  String get expiryLabel =>
      '${expiryMonth.toString().padLeft(2, '0')}/${(expiryYear % 100).toString().padLeft(2, '0')}';
}

class CardSetupSession {
  const CardSetupSession({
    required this.setupId,
    required this.hostedUrl,
    required this.returnUrlPrefix,
  });

  factory CardSetupSession.fromJson(Json json) => CardSetupSession(
    setupId: readString(json, 'setupId'),
    hostedUrl: Uri.parse(readString(json, 'hostedUrl')),
    returnUrlPrefix: readString(json, 'returnUrlPrefix'),
  );

  final String setupId;
  final Uri hostedUrl;
  final String returnUrlPrefix;
}

import '../../../shared/models/json.dart';

/// Mirrors contracts/fixtures/quote_created.json. Every figure is computed by
/// the server; the app only displays it (FR-QTE-02).
class Quote {
  const Quote({
    required this.quoteId,
    required this.expiresAt,
    required this.amountRwf,
    required this.feeRwf,
    required this.totalRwf,
    required this.cardCurrency,
    required this.totalCardDisplay,
    required this.fxRateDisplay,
    required this.payeeId,
    required this.payeeName,
    required this.payeeMasked,
    required this.cardId,
    required this.cardLabel,
    required this.simulated,
  });

  factory Quote.fromJson(Json json) {
    final payee = readObject(json, 'payee');
    final card = readObject(json, 'card');
    final brand = readString(card, 'brand');
    return Quote(
      quoteId: readString(json, 'quoteId'),
      expiresAt: readDate(json, 'expiresAt'),
      amountRwf: readInt(json, 'amountRwf'),
      feeRwf: readInt(json, 'feeRwf'),
      totalRwf: readInt(json, 'totalRwf'),
      cardCurrency: readString(json, 'cardCurrency'),
      totalCardDisplay: readString(json, 'totalCardDisplay'),
      fxRateDisplay: readString(json, 'fxRateDisplay'),
      payeeId: readString(payee, 'payeeId'),
      payeeName: readString(payee, 'registeredName'),
      payeeMasked: readString(payee, 'maskedIdentifier'),
      cardId: readString(card, 'id'),
      cardLabel:
          '${brand == 'MASTERCARD'
              ? 'Mastercard'
              : brand == 'VISA'
              ? 'Visa'
              : brand} •••• ${readString(card, 'last4')}',
      simulated: readBool(json, 'simulated'),
    );
  }

  final String quoteId;
  final DateTime expiresAt;
  final int amountRwf;
  final int feeRwf;
  final int totalRwf;
  final String cardCurrency;
  final String totalCardDisplay;
  final String fxRateDisplay;
  final String payeeId;
  final String payeeName;
  final String payeeMasked;
  final String cardId;
  final String cardLabel;
  final bool simulated;

  bool isExpired(DateTime now) => !now.isBefore(expiresAt);
}

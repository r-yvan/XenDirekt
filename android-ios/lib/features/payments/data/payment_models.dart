import '../../../shared/models/json.dart';

/// Mirrors contracts/fixtures/payment_*.json. The server is the only authority
/// for state, charge status and every amount.
class Payment {
  const Payment({
    required this.id,
    required this.reference,
    required this.state,
    required this.status,
    required this.chargeStatus,
    required this.steps,
    required this.amountRwf,
    required this.feeRwf,
    required this.totalRwf,
    required this.totalCardDisplay,
    required this.fxRateDisplay,
    required this.payeeName,
    required this.payeeMasked,
    required this.cardLabel,
    required this.simulated,
    required this.createdAt,
    this.failureReason,
    this.nextAction,
    this.completedAt,
    this.note,
  });

  factory Payment.fromJson(Json json) {
    final payee = readObject(json, 'payee');
    final card = readObject(json, 'card');
    final steps = readObject(json, 'steps');
    final action = readObjectOrNull(json, 'nextAction');
    final brand = readString(card, 'brand');
    return Payment(
      id: readString(json, 'id'),
      reference: readString(json, 'reference'),
      state: readString(json, 'state'),
      status: readString(json, 'status'),
      chargeStatus: readString(json, 'chargeStatus'),
      failureReason: readStringOrNull(json, 'failureReason'),
      steps: (
        processing: readBool(steps, 'processing'),
        sent: readBool(steps, 'sent'),
        received: readBool(steps, 'received'),
      ),
      nextAction: action == null
          ? null
          : (
              url: Uri.parse(readString(action, 'url')),
              returnUrlPrefix: readString(action, 'returnUrlPrefix'),
            ),
      amountRwf: readInt(json, 'amountRwf'),
      feeRwf: readInt(json, 'feeRwf'),
      totalRwf: readInt(json, 'totalRwf'),
      totalCardDisplay: readString(json, 'totalCardDisplay'),
      fxRateDisplay: readString(json, 'fxRateDisplay'),
      payeeName: readString(payee, 'registeredName'),
      payeeMasked: readString(payee, 'maskedIdentifier'),
      cardLabel:
          '${brand == 'MASTERCARD'
              ? 'Mastercard'
              : brand == 'VISA'
              ? 'Visa'
              : brand} •••• ${readString(card, 'last4')}',
      simulated: readBool(json, 'simulated'),
      createdAt: readDate(json, 'createdAt'),
      completedAt: readDateOrNull(json, 'completedAt'),
      note: readStringOrNull(json, 'note'),
    );
  }

  final String id;
  final String reference;
  final String state;

  /// PROCESSING | ACTION_REQUIRED | SENT | RECEIVED | COMPLETED | FAILED | IN_REVIEW | REFUNDED
  final String status;

  /// NOT_CHARGED | HOLD | HOLD_RELEASING | CHARGED | REFUNDED | UNKNOWN
  final String chargeStatus;
  final String? failureReason;
  final ({bool processing, bool sent, bool received}) steps;
  final ({Uri url, String returnUrlPrefix})? nextAction;
  final int amountRwf;
  final int feeRwf;
  final int totalRwf;
  final String totalCardDisplay;
  final String fxRateDisplay;
  final String payeeName;
  final String payeeMasked;
  final String cardLabel;
  final bool simulated;
  final DateTime createdAt;
  final DateTime? completedAt;
  final String? note;

  /// Nothing more will happen without operations: stop polling.
  bool get isSettled =>
      const {'COMPLETED', 'FAILED', 'REFUNDED'}.contains(status) &&
      chargeStatus != 'HOLD_RELEASING';
  bool get isInReview => status == 'IN_REVIEW';
}

class PaymentPage {
  const PaymentPage({required this.payments, this.nextCursor});

  factory PaymentPage.fromJson(Json json) => PaymentPage(
    payments: readObjectList(json, 'payments').map(Payment.fromJson).toList(),
    nextCursor: readStringOrNull(json, 'nextCursor'),
  );

  final List<Payment> payments;
  final String? nextCursor;
}

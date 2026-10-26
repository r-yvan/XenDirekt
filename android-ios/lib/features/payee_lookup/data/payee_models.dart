import '../../../shared/models/json.dart';

/// Mirrors contracts/fixtures/payee_lookup.json. The name always comes from the partner.
class PayeeLookup {
  const PayeeLookup({
    required this.payeeId,
    required this.registeredName,
    required this.maskedIdentifier,
    required this.displayIdentifier,
    required this.simulated,
  });

  factory PayeeLookup.fromJson(Json json) => PayeeLookup(
    payeeId: readString(json, 'payeeId'),
    registeredName: readString(json, 'registeredName'),
    maskedIdentifier: readString(json, 'maskedIdentifier'),
    displayIdentifier: readString(json, 'displayIdentifier'),
    simulated: readBool(json, 'simulated'),
  );

  final String payeeId;
  final String registeredName;
  final String maskedIdentifier;
  final String displayIdentifier;
  final bool simulated;
}

class RecentPayee {
  const RecentPayee({
    required this.payeeId,
    required this.registeredName,
    required this.maskedIdentifier,
    this.lastAmountRwf,
  });

  factory RecentPayee.fromJson(Json json) => RecentPayee(
    payeeId: readString(json, 'payeeId'),
    registeredName: readStringOrNull(json, 'registeredName') ?? '',
    maskedIdentifier: readString(json, 'maskedIdentifier'),
    lastAmountRwf: readIntOrNull(json, 'lastAmountRwf'),
  );

  final String payeeId;
  final String registeredName;
  final String maskedIdentifier;
  final int? lastAmountRwf;

  PayeeLookup asLookup() => PayeeLookup(
    payeeId: payeeId,
    registeredName: registeredName,
    maskedIdentifier: maskedIdentifier,
    displayIdentifier: maskedIdentifier,
    simulated: false,
  );
}

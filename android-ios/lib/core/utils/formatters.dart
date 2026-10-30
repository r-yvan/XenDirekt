import 'package:intl/intl.dart';

/// RWF has no minor unit; amounts are whole francs grouped per locale.
String formatRwf(int amount, String locale) =>
    'RWF ${NumberFormat.decimalPattern(locale).format(amount)}';

/// Kigali is UTC+02:00 with no daylight saving. The server sends receipt times
/// with that offset; this keeps display in Kigali time regardless of the phone's zone.
DateTime toKigali(DateTime instant) =>
    instant.toUtc().add(const Duration(hours: 2));

String formatKigaliDateTime(DateTime instant, String locale) {
  final kigali = toKigali(instant);
  return DateFormat.yMMMd(locale).add_Hm().format(
    DateTime(kigali.year, kigali.month, kigali.day, kigali.hour, kigali.minute),
  );
}

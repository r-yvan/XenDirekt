import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../../app/localization/generated/app_localizations.dart';
import '../../app/theme/app_colors.dart';
import '../../app/theme/app_theme.dart';
import 'primary_button.dart';

/// A bottom sheet with day / month / year wheels: quick to spin to a birth
/// date, impossible to enter an invalid one (31 February, under-age).
Future<DateTime?> showDateWheelPicker(
  BuildContext context, {
  required DateTime initial,
  required DateTime first,
  required DateTime last,
  required String title,
  String? subtitle,
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    useRootNavigator: true,
    // Size to content: the default 9/16-of-screen cap cuts off the wheels on
    // smaller phones and large font sizes.
    isScrollControlled: true,
    builder: (_) => _DateWheelSheet(
      initial: _clamp(initial, first, last),
      first: first,
      last: last,
      title: title,
      subtitle: subtitle,
    ),
  );
}

DateTime _clamp(DateTime date, DateTime first, DateTime last) =>
    date.isBefore(first)
    ? first
    : date.isAfter(last)
    ? last
    : date;

int _daysIn(int year, int month) => DateUtils.getDaysInMonth(year, month);

class _DateWheelSheet extends StatefulWidget {
  const _DateWheelSheet({
    required this.initial,
    required this.first,
    required this.last,
    required this.title,
    this.subtitle,
  });

  final DateTime initial;
  final DateTime first;
  final DateTime last;
  final String title;
  final String? subtitle;

  @override
  State<_DateWheelSheet> createState() => _DateWheelSheetState();
}

class _DateWheelSheetState extends State<_DateWheelSheet> {
  static const _itemExtent = 46.0;

  late int _day = widget.initial.day;
  late int _month = widget.initial.month;
  late int _year = widget.initial.year;

  late final _dayController = FixedExtentScrollController(
    initialItem: _day - 1,
  );
  late final _monthController = FixedExtentScrollController(
    initialItem: _month - 1,
  );
  late final _yearController = FixedExtentScrollController(
    initialItem: _year - widget.first.year,
  );

  @override
  void dispose() {
    _dayController.dispose();
    _monthController.dispose();
    _yearController.dispose();
    super.dispose();
  }

  DateTime get _value => DateTime(_year, _month, _day);

  /// Brings the wheels back to a real, allowed date after any spin.
  void _settle() {
    final maxDay = _daysIn(_year, _month);
    if (_day > maxDay) {
      _day = maxDay;
      _dayController.animateToItem(
        _day - 1,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      );
    }
    final clamped = _clamp(_value, widget.first, widget.last);
    if (clamped != _value) {
      _day = clamped.day;
      _month = clamped.month;
      _year = clamped.year;
      for (final (controller, item) in [
        (_dayController, _day - 1),
        (_monthController, _month - 1),
        (_yearController, _year - widget.first.year),
      ]) {
        controller.animateToItem(
          item,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
        );
      }
    }
    setState(() {});
  }

  void _changed(void Function() update) {
    HapticFeedback.selectionClick();
    update();
    _settle();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toString();
    final monthFormat = DateFormat.MMMM(locale);
    String monthName(int month) {
      final name = monthFormat.format(DateTime(2000, month));
      return name[0].toUpperCase() + name.substring(1);
    }

    final today = DateUtils.dateOnly(DateTime.now());
    var age = today.year - _value.year;
    if (DateTime(today.year, _value.month, _value.day).isAfter(today)) {
      age -= 1;
    }
    final daysInMonth = _daysIn(_year, _month);

    Widget wheel({
      required Key key,
      required FixedExtentScrollController controller,
      required int count,
      required String Function(int index) label,
      required ValueChanged<int> onChanged,
      bool Function(int index)? enabled,
    }) {
      return CupertinoPicker.builder(
        key: key,
        scrollController: controller,
        itemExtent: _itemExtent,
        diameterRatio: 1.35,
        squeeze: 1.0,
        useMagnifier: true,
        magnification: 1.08,
        selectionOverlay: const SizedBox.shrink(),
        backgroundColor: Colors.transparent,
        onSelectedItemChanged: (index) => _changed(() => onChanged(index)),
        childCount: count,
        itemBuilder: (context, index) => Center(
          child: Text(
            label(index),
            style: TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
              color: enabled == null || enabled(index)
                  ? context.xd.textPrimary
                  : context.xd.textTertiary.withValues(alpha: 0.45),
            ),
          ),
        ),
      );
    }

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.title, style: theme.titleLarge),
            if (widget.subtitle != null) ...[
              const SizedBox(height: 4),
              Text(
                widget.subtitle!,
                style: theme.bodyMedium?.copyWith(
                  color: context.xd.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: 18),
            Semantics(
              liveRegion: true,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.brandOrange.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: AppColors.brandOrange.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.cake_outlined,
                      size: 20,
                      color: AppColors.brandOrange,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        DateFormat.yMMMMd(locale).format(_value),
                        style: theme.titleMedium,
                      ),
                    ),
                    Text(
                      l10n.ageYears(age),
                      style: theme.bodyMedium?.copyWith(
                        color: context.xd.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: _itemExtent * 5,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // The selection band the three wheels share.
                  Container(
                    height: _itemExtent,
                    decoration: BoxDecoration(
                      color: context.xd.surface2,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: context.xd.hairlineStrong),
                    ),
                  ),
                  ShaderMask(
                    blendMode: BlendMode.dstIn,
                    shaderCallback: (bounds) => const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.white,
                        Colors.white,
                        Colors.transparent,
                      ],
                      stops: [0, 0.28, 0.72, 1],
                    ).createShader(bounds),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: wheel(
                            key: const Key('dob-day'),
                            controller: _dayController,
                            count: 31,
                            label: (index) => '${index + 1}',
                            enabled: (index) => index < daysInMonth,
                            onChanged: (index) => _day = index + 1,
                          ),
                        ),
                        Expanded(
                          flex: 4,
                          child: wheel(
                            key: const Key('dob-month'),
                            controller: _monthController,
                            count: 12,
                            label: (index) => monthName(index + 1),
                            onChanged: (index) => _month = index + 1,
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: wheel(
                            key: const Key('dob-year'),
                            controller: _yearController,
                            count: widget.last.year - widget.first.year + 1,
                            label: (index) => '${widget.first.year + index}',
                            onChanged: (index) =>
                                _year = widget.first.year + index,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: l10n.done,
              onPressed: () => Navigator.of(context).pop(_value),
            ),
          ],
        ),
      ),
    );
  }
}

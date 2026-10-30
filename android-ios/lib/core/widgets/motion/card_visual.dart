import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';

/// A rendered payment card: flat brand colour, chip, last four, expiry.
/// Shows only what the server returned (brand, last 4, expiry); never a PAN.
class CardVisual extends StatelessWidget {
  const CardVisual({
    required this.brand,
    required this.last4,
    required this.expiry,
    this.selected = false,
    this.compact = false,
    this.badge,
    super.key,
  });

  final String brand;
  final String last4;
  final String expiry;
  final bool selected;
  final bool compact;
  final String? badge;

  Color get _color => switch (brand) {
    'VISA' => const Color(0xFF1A3A8F),
    'MASTERCARD' => const Color(0xFF222226),
    _ => const Color(0xFF2A2A2E),
  };

  @override
  Widget build(BuildContext context) {
    final height = compact ? 92.0 : 184.0;
    return Semantics(
      label:
          '${brand == 'MASTERCARD' ? 'Mastercard' : 'Visa'} ending $last4, expires $expiry',
      selected: selected,
      excludeSemantics: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        height: height,
        padding: EdgeInsets.all(compact ? 14 : 20),
        decoration: BoxDecoration(
          color: _color,
          borderRadius: BorderRadius.circular(compact ? 14 : 18),
          border: Border.all(
            color: selected ? AppColors.brandOrange : Colors.transparent,
            width: 2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: compact ? 26 : 36,
                  height: compact ? 19 : 27,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(5),
                    color: const Color(0xFFD4B26A),
                  ),
                ),
                if (!compact) ...[
                  const SizedBox(width: 10),
                  Icon(
                    Icons.contactless_outlined,
                    size: 22,
                    color: Colors.white.withValues(alpha: 0.7),
                  ),
                ],
                const Spacer(),
                if (badge != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.brandOrange,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      badge!,
                      style: const TextStyle(
                        color: AppColors.brandBlack,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0,
                      ),
                    ),
                  ),
              ],
            ),
            const Spacer(),
            // One line always; shrinks rather than wraps on narrow cards
            // or large system font sizes.
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                '••••  ••••  ••••  $last4',
                maxLines: 1,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: compact ? 15 : 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                  height: 1.2,
                ),
              ),
            ),
            SizedBox(height: compact ? 4 : 10),
            Row(
              children: [
                Text(
                  expiry,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                    fontSize: compact ? 11 : 13,
                    height: 1.2,
                  ),
                ),
                const Spacer(),
                _BrandMark(brand: brand, size: compact ? 0.7 : 1),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark({required this.brand, required this.size});

  final String brand;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (brand == 'MASTERCARD') {
      return SizedBox(
        width: 44 * size,
        height: 28 * size,
        child: Stack(
          children: [
            Positioned(left: 0, child: _circle(const Color(0xFFEB001B))),
            Positioned(
              right: 0,
              child: _circle(const Color(0xFFF79E1B).withValues(alpha: 0.9)),
            ),
          ],
        ),
      );
    }
    return Text(
      'VISA',
      style: TextStyle(
        color: Colors.white,
        fontStyle: FontStyle.italic,
        fontWeight: FontWeight.w900,
        fontSize: 22 * size,
        letterSpacing: 1,
        height: 1.1,
      ),
    );
  }

  Widget _circle(Color color) => Container(
    width: 28 * size,
    height: 28 * size,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

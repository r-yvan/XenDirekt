# ADR 0005: Authentication, sessions, PIN and step-up

## Context

PRD: sign-up by Apple, Google, email or international phone; 6-digit OTP with 5-minute expiry
and at most 5 attempts; a PIN; biometrics replacing PIN typing; 15-minute access tokens;
device-bound refresh tokens; app lock after 5 minutes in the background. The brief adds:
store OTPs only as verifiers, never log them, hash PINs server-side, and treat biometrics as
unlocking a local key rather than as a secret sent to the server.

## Decision

- **OTP:** `POST /v1/auth/otp` creates a challenge storing only an HMAC-SHA-256 of the code
  (server secret plus challenge ID), the HMAC of the destination and a masked destination.
  Each challenge allows 5 verification attempts and lasts 5 minutes. A code verifies once.
  Requests are rate-limited per destination, IP and device. Codes are never logged. Delivery
  uses a channel port: SMTP email (Mailpit locally) and an SMS port that is not configured
  by default.
- **Federated sign-in (Apple/Google):** server-side ID-token verification behind a feature flag
  that is off until client IDs exist (OQ-29). The app hides those buttons until the API reports
  them enabled.
- **Tokens:** 15-minute HS256 access JWTs whose audience separates tourist tokens from admin
  tokens. Refresh tokens are 256-bit random values stored as SHA-256 hashes, bound to the
  app-generated install ID and rotated on every use. Reusing a rotated token revokes the whole
  token family. Every request checks that its session is still active, so logout and admin
  blocks apply immediately.
- **PIN:** a fixed 6 digits (OQ-21). Stored as Argon2id with the pepper passed as Argon2's
  native `secret` input (Node's built-in `crypto.argon2`; PHC string, 19 MiB, t=2). The pepper lives in the secret manager, not the database, so a
  database leak alone does not allow offline guessing of the small PIN space. Five wrong
  attempts lock PIN use for 15 minutes.
- **Step-up for sensitive actions** (create payment, change PIN, delete account): the app
  obtains a single-use, 2-minute step-up grant bound to the session and the purpose, either by
  - **PIN**, verified by the server; or
  - **device key**: an Ed25519 key pair created on the device, whose private seed sits in
    secure storage behind a biometric prompt. The server stores only the public key and checks
    a signature over a fresh server nonce (`xendirekt-step-up:v1:<challengeId>:<nonce>:<purpose>`).
    The server also accepts ES256 (P-256) keys, so a later move to Secure Enclave keys (P-256
    only) needs no API change. Ed25519 was chosen because the Dart `cryptography` package
    implements it in pure Dart, while its pure-Dart ECDSA does not sign.
- **App lock:** after 5 minutes in the background the app requires biometrics or the PIN. That
  check is local, unless it falls back to the PIN, in which case the server verifies it.

## Consequences

- The PIN's small search space is protected by the pepper and by online lockout.
- The software-held device key is weaker than a hardware-bound biometric key. Moving it to
  Android Keystore / Secure Enclave with user-authentication-required keys is a tracked hardening
  item (see `docs/security.md`). The server interface does not change when that happens.
- Admin identities are separate (email + password + TOTP) and use a different token audience.

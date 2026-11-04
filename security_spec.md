# Security Specification (Phase 0 TDD & Red Team Audit)

## 1. Data Invariants
1. **Authentication & Verification**: All reads and writes require a signed-in user with `request.auth.token.email_verified == true`.
2. **Ownership & Admin Isolation**: Every document in `/orders`, `/debtPayments`, `/cashflows`, `/deliveries`, and `/settings` contains an immutable `ownerId` matching `request.auth.uid` on creation. Only the document owner (`resource.data.ownerId == request.auth.uid`) or verified bootstrapped admin (`lehoanghuythach@gmail.com`) can read, update, or delete records.
3. **Strict Key & Size Enforcement**: Every create and update operation validates exact field allowlists via `hasAll` and `hasOnly`, enforces string `.size()` bounds, numeric bounds, and temporal integrity (`createdAt == request.time` on create, `createdAt == existing().createdAt` and `updatedAt == request.time` on update).
4. **Query Enforcer on List**: Every `allow list` rule explicitly checks `resource.data.ownerId == request.auth.uid || isAdmin()` without delegating filtering to the client.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/orders/order_1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth.token.email = "lehoanghuythach@gmail.com"`, `email_verified = false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: `auth.uid = "user_a"`, `incoming().ownerId = "user_b"` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Adding `"isSuperAdmin": true` to `/orders/order_1` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection on Update**: Adding `"hacked": 1` during update on `/orders/order_1` -> `PERMISSION_DENIED`.
6. **Owner Hijack on Update**: Changing `ownerId` from `"user_a"` to `"user_b"` on update -> `PERMISSION_DENIED`.
7. **Timestamp Forgery on Create**: Setting `createdAt` to past/future client timestamp instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immortal Field Mutation**: Modifying `createdAt` during an `update` -> `PERMISSION_DENIED`.
9. **Resource Exhaustion (1MB String)**: Passing a 5,000-character string to `patientName` (max 200) -> `PERMISSION_DENIED`.
10. **ID Poisoning**: Creating a document with path ID containing spaces/slashes or > 128 chars -> `PERMISSION_DENIED`.
11. **Cross-Tenant PII Read**: Authenticated `"user_b"` attempting `get` on `/orders/order_owned_by_a` -> `PERMISSION_DENIED`.
12. **Unscoped List Scraping**: Authenticated `"user_b"` executing an unfiltered `list` query across `/orders` -> `PERMISSION_DENIED`.

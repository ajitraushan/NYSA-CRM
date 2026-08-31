# CRM Test dev.158 — Actual Record Cross-reference

Evidence source: sanitized CRM Test dump generated 18 August 2026 at 11:05:14 UTC. This is the authoritative bridge between checklist shorthand and records visible in CRM Test. Never search for shorthand such as “Sales Agent A” as though it were a display name.

## Role and Team mapping

| Checklist shorthand | Actual CRM Test display name | Code | Actual Team |
| --- | --- | --- | --- |
| Administrator | Existing approved CRM Test Administrator | U-ADM | Company |
| Director | UAT158 Director | U-DIR | Company |
| Manager A / Manager Alpha | UAT158 Manager Alpha | U-MA | UAT158 Dubai Secondary Sales; also manages Off-plan and Temporary Governance Teams |
| Sales Agent A / Agent A1 | UAT158 Agent Alpha One | U-A1 | UAT158 Dubai Secondary Sales |
| Sales Agent B / Agent A2 | UAT158 Agent Alpha Two | U-A2 | UAT158 Dubai Secondary Sales |
| Manager B / Manager Beta | UAT158 Manager Beta | U-MB | UAT158 Dubai Rentals |
| Sales Agent C / Agent B1 | UAT158 Agent Beta One | U-B1 | UAT158 Dubai Rentals |
| Listing Executive / Listing Agent | UAT158 Listing Executive | U-LX | UAT158 Dubai Off-plan |
| Accountant | UAT158 Accountant | U-ACC | Company/Finance scope |

| Team code/shorthand | Actual Team |
| --- | --- |
| T-A / Team A | UAT158 Dubai Secondary Sales |
| T-B / Team B | UAT158 Dubai Rentals |
| T-C / Off-plan Team | UAT158 Dubai Off-plan |
| T-X / Temporary Team | UAT158 Temporary Governance Team |

## Maintained Areas and routing

| Area code | Display label | Display order |
| --- | --- | ---: |
| `uat158_downtown` | UAT158 Downtown | 910 |
| `uat158_marina` | UAT158 Marina | 920 |
| `uat158_business_bay` | UAT158 Business Bay | 930 |
| `uat158_jvc` | UAT158 JVC | 940 |
| `uat158_retire_me` | UAT158 Temporary Area | 990 |

Active routing baselines are priority 10 Downtown Sale, 20 Marina Rental, 30 Business Bay Off-plan, 50 Website Sale fallback and the existing priority-9999 Company fallback named `any`. Priority 15 does not exist yet; creating, proving and retiring it is a human test.

## Customers and Contacts

`C-01` through `C-12` map directly to `UAT158-HUMAN Customer 01` through `UAT158-HUMAN Customer 12`. Do not search for the obsolete planning names Customer Alpha, Bravo, Charlie, and so on.

Additional Contact fixtures are `UAT158-HUMAN Additional Contact 01` through `04`. The unresolved duplicate fixture is `UAT158-HUMAN Customer 09 Duplicate`; it is inactive with duplicate-review status `pending` and must not be resolved before the duplicate-review test.

## Actual Leads

| Use | Actual Lead title | CRM reference | Customer |
| --- | --- | --- | --- |
| Basic Sale apartment | UAT158-HUMAN SALE-APT-01 | NYSA-LD-202608-000030 | Customer 01 |
| Basic Sale villa | UAT158-HUMAN SALE-VILLA-01 | NYSA-LD-202608-000031 | Customer 02 |
| Rental apartment | UAT158-HUMAN RENT-APT-01 | NYSA-LD-202608-000032 | Customer 03 |
| Rental villa | UAT158-HUMAN RENT-VILLA-01 | NYSA-LD-202608-000033 | Customer 04 |
| Off-plan | UAT158-HUMAN OFFPLAN-01 | NYSA-LD-202608-000034 | Customer 05 |
| Commercial | UAT158-HUMAN COMMERCIAL-01 | NYSA-LD-202608-000035 | Customer 06 |
| Assignment/rerouting | UAT158-HUMAN REROUTE-01 | NYSA-LD-202608-000036 | Customer 07 |
| Assignment rejection | UAT158-HUMAN REJECT-01 | NYSA-LD-202608-000037 | Customer 08 |
| Reversal/recovery | UAT158-HUMAN REVERSAL-01 | NYSA-LD-202608-000038 | Customer 09 |
| Duplicate lineage | UAT158-HUMAN DUPLICATE-BASE-01 | NYSA-LD-202608-000039 | Customer 10 |
| 520 sqft regression | UAT158-HUMAN MATCH-520-01 | NYSA-LD-202608-000040 | Customer 11 |
| No-match conditions | UAT158-HUMAN NO-MATCH-01 | NYSA-LD-202608-000041 | Customer 12 |
| Booking expiry | UAT158-HUMAN BOOKING-EXPIRY-01 | NYSA-LD-202608-000042 | Customer 01 |
| Offer rejection | UAT158-HUMAN OFFER-REJECT-01 | NYSA-LD-202608-000043 | Customer 02 |
| Administrative closure | UAT158-HUMAN CLOSURE-01 | NYSA-LD-202608-000044 | Customer 03 |
| Assignment delink/history | UAT158-HUMAN DELINK-01 | NYSA-LD-202608-000045 | Customer 04 |

These Leads were created before the new UAT routing rules and correctly retain their original immutable routing reasons. Create a fresh Lead during the priority 10-versus-15 test.

## Actual Inventory

| Use | Actual Inventory headline | CRM reference | Key facts |
| --- | --- | --- | --- |
| 500 sqft minimum | UAT158-HUMAN APT-500 | NYSA-INV-000047 | Apartment, 500 sqft, AED 850,000 |
| 520 sqft accepted boundary | UAT158-HUMAN APT-520 | NYSA-INV-000048 | Apartment, 520 sqft, AED 875,000 |
| Larger alternative | UAT158-HUMAN APT-900 | NYSA-INV-000049 | Apartment, 900 sqft, AED 1,450,000 |
| Rental apartment | UAT158-HUMAN APT-RENT | NYSA-INV-000050 | Apartment, 650 sqft, AED 105,000 |
| Sale villa | UAT158-HUMAN VILLA-SALE | NYSA-INV-000051 | Villa, 2,400 sqft, AED 2,950,000 |
| Rental villa | UAT158-HUMAN VILLA-RENT | NYSA-INV-000052 | Villa, 2,200 sqft, AED 260,000 |
| Townhouse | UAT158-HUMAN TOWNHOUSE | NYSA-INV-000053 | Townhouse, 1,900 sqft |
| Penthouse | UAT158-HUMAN PENTHOUSE | NYSA-INV-000054 | Penthouse, 2,600 sqft |
| Off-plan A | UAT158-HUMAN OFFPLAN-A | NYSA-INV-000055 | Apartment, 1,050 sqft |
| Off-plan B | UAT158-HUMAN OFFPLAN-B | NYSA-INV-000056 | Townhouse, 2,300 sqft |
| Commercial | UAT158-HUMAN COMMERCIAL | NYSA-INV-000057 | Commercial transaction, 1,100 sqft |
| Duplicate candidate A | UAT158-HUMAN DUPLICATE-A | NYSA-INV-000058 | Draft/unverified |
| Duplicate candidate B | UAT158-HUMAN DUPLICATE-B | NYSA-INV-000059 | Draft/unverified |
| Expiry test | UAT158-HUMAN EXPIRY | NYSA-INV-000060 | Draft/unverified; dates intentionally blank |
| Closure test | UAT158-HUMAN CLOSURE | NYSA-INV-000061 | Draft/unverified |
| Delink/history test | UAT158-HUMAN DELINK | NYSA-INV-000062 | Draft/unverified |

All Inventory starts draft/unverified with blank availability dates. Owner/authority, verification, availability, Assignment, reservation, closure and delink actions are the human tests.

## Usage rule

Select the actual CRM display name or reference from this file, perform only the named checklist action, and record the actual reference in the cumulative UAT log. Treat older `L-01`, `I-01`, Alpha/Bravo and Agent A/B labels only as planning shorthand where they remain in historical text.

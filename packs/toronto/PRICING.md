# Illustrative tenant pricing

Pixie uses an invented annual base of $150 for $20,000 of contents, $1 million of liability,
and a $1,000 deductible. It is a demo estimate, not an Intact rate or an offer of insurance.

The fixed pricing order is contents, liability, deductible, break-ins, fire, basement flooding,
the location-total cap, sewer backup, one prior claim, and the optional auto bundle. Contents
cost $4 per $1,000 above or below $20,000. Two-million-dollar liability adds $12. Sewer backup
adds $40. The $500 and $2,500 deductibles apply invented multipliers of 1.12 and 0.88. One claim
in five years applies an invented multiplier of 1.08. Two or more claims refer without a claims
price. An auto bundle applies an invented multiplier of 0.90.

Public-data location factors come from `pack.yaml`. Each peril multiplier is capped within its
listed range. Their product is clamped to 0.85 through 1.25. Every receipt operation uses integer
cents, so the base plus its lines equals the annual total exactly.

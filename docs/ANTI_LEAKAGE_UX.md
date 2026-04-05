# Anti-Leakage UX Strategy (Behavioral)

## 1) Objective

Reduce off-platform deal closure ("fuga") without breaking trust or conversion.

Behavioral target:

- users feel safer and better protected paying in-platform
- contact exchange happens only after deposit payment
- attempts to bypass platform lose value and incentives

## 2) Product Principle

Use "protection-first" design instead of pure blocking:

- payment in Tchuno unlocks protection, proof, support and reputation value
- payment outside Tchuno removes protection and support guarantees

## 3) Core UX Rules

### 3.1 Contact Lock (before payment)

Before deposit payment (`PaymentIntent=AWAITING_PAYMENT`):

- hide full phone, WhatsApp and external handles
- mask any sensitive contact field (`+258 *** ** **`)
- block direct "call" / "message externally" actions

After confirmed deposit (`PAID_PARTIAL` or `SUCCEEDED`):

- unmask contacts
- enable direct contact actions
- show "Protected by Tchuno" badge on conversation/job

### 3.2 Value Framing at Decision Moments

When customer selects a proposal, show a short value stack:

- "Payment confirmation secures your booking"
- "Support can intervene only on in-platform paid jobs"
- "Refund and dispute policy applies only to protected payments"

### 3.3 Behavioral Friction on Leakage Attempts

If user types likely contact-sharing content before payment:

- show inline warning, not immediate hard block on first attempt
- on repeat attempts, temporarily block message send with clear reason
- offer a direct CTA: `Pay deposit to unlock contact safely`

### 3.4 Positive Reinforcement

After deposit payment:

- show success state with timeline of protections enabled
- reinforce benefits: proof, cancellation policy, dispute eligibility

## 4) Intervention Triggers (Risk Signals)

Track and classify leakage risk signals:

- repeated masked contact reveal attempts
- repeated message patterns with phone/email formats
- high chat volume with no payment progression
- rapid proposal selection + cancel + re-open loops
- high off-platform complaint ratio on account history

Risk tiers:

- low: warning copy only
- medium: send friction modal + force in-app step completion
- high: temporary restrictions + trust & safety review queue

## 5) UX Copy Policy (Required)

Keep copy explicit and consistent:

- "Only payments inside Tchuno are protected."
- "Contact unlocks after deposit confirmation."
- "If you pay outside, refund/dispute support may not apply."

Do not use threatening language. Use clear consequence framing.

## 6) Screens/Components to Implement

Customer:

- proposal selection confirmation modal with deposit explanation
- payment pending state with countdown and retry path
- locked-contact card with benefit bullets and `Pay deposit` CTA

Provider:

- locked-contact notice until customer deposit is confirmed
- payout eligibility hint tied to protected in-platform jobs

Shared:

- payment protection badge on job timeline
- cancellation/refund summary in job finance section

## 7) Anti-Abuse Guardrails

- avoid permanent auto-block based on single signal
- always allow appeal/support path
- log every automated intervention with reason code
- require admin review before punitive account actions

## 8) KPIs (Pilot Baseline)

Primary:

- selection -> deposit conversion rate
- percentage of jobs with contact unlocked only after payment
- cancellation/refund rate after contact unlock

Leakage proxy:

- blocked contact-sharing attempts per 100 chats
- paid in-platform ratio vs selected proposals
- disputed off-platform allegation rate

Quality:

- false-positive warning rate
- median time from selection to deposit

## 9) Experiment Plan

Run A/B tests for:

- lock-screen copy variants
- deposit CTA placement
- risk-warning intensity

Success criteria:

- increase in-platform payment conversion
- no significant drop in proposal acceptance rate
- no increase in severe support complaints

## 10) Operational Ownership

- Product: message hierarchy and conversion targets
- Design: lock/unlock states and interaction patterns
- Backend: enforcement, events, and risk signals
- Trust & Safety: escalation rules and review SLA
- Support: user-facing resolution scripts

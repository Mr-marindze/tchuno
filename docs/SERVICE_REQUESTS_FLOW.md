# Service Requests + Proposals Flow

## Goal

Move Tchuno from direct job creation to a selection-based marketplace flow:

1. Customer opens a `ServiceRequest`
2. Multiple providers submit `Proposal`
3. Customer selects one proposal
4. Backend creates `Job` + deposit `PaymentIntent`
5. Customer pays deposit
6. Contact is unlocked and execution flow can start

## Main Endpoints

- `POST /service-requests`
- `GET /service-requests/me`
- `GET /service-requests/open`
- `POST /service-requests/:id/proposals`
- `GET /service-requests/:id/proposals`
- `POST /service-requests/:id/select/:proposalId`
- `POST /payments/intents/:id/pay`

## Business Rules Implemented

- One request can have many proposals.
- Each provider can keep one editable proposal per request.
- Only request owner can select proposal.
- Selection closes request and rejects other proposals.
- Selection creates one job and one deposit payment intent.
- Provider execution transitions for request-based jobs require paid deposit.
- Contact remains blocked before deposit payment.

## Contact Security

`GET /jobs/:id` now returns:

- `contactUnlocked`
- `providerContact` (null before payment)
- `paymentRequired`

Contact unlock is triggered when payment intent reaches paid state.

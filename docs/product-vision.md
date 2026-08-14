# Product Vision

Tchuno is a Mozambican services marketplace. It connects people who need work
done with service providers who can propose, execute, and build reputation
through real completed jobs.

## Problem

The services market in Mozambique is highly informal and fragmented.

Customers often struggle to:

- find available professionals;
- evaluate trust before hiring;
- compare options and prices;
- organize work from request to completion;
- understand who is nearby or practically reachable.

Service providers often struggle to:

- find new customers consistently;
- create a simple digital presence;
- receive relevant opportunities;
- build reputation beyond word of mouth;
- manage proposals, work, and earnings in one place.

Operations and administrators need tools to keep the platform trustworthy:

- review activity;
- support users;
- handle payments, refunds, payouts, disputes, and incidents;
- maintain the category catalog and platform settings.

## Product Principle

Tchuno should not force the whole informal market into a rigid table of fixed
services and universal prices.

The product should add structure where structure helps:

- normalized categories;
- request and proposal lifecycle;
- job state transitions;
- reviews tied to completed work;
- auditability and operational controls.

It should preserve flexibility where real work requires it:

- free-form request descriptions;
- provider-defined proposal prices;
- approximate location and service area preferences;
- human operational intervention for edge cases.

## Current Product Direction

The consolidated marketplace flow is request-first:

`ServiceRequest -> Proposal -> Selection -> Job`

The current implementation extends this operationally to:

`ServiceRequest -> Proposal -> Selection -> Job -> PaymentIntent -> payment/contact unlock -> execution -> Review`

The old direct job creation flow is blocked and should not be reintroduced as
the main product path.

## Mozambican Context

Future product and architecture decisions should account for:

- strong informal economy patterns;
- many professions and work arrangements;
- unequal connectivity;
- sensitivity to mobile data cost;
- different levels of digital literacy;
- broad mobile phone usage;
- uneven access to modern smartphones.

USSD and SMS are not approved features in the current product scope. They may be
considered later only through explicit product and architecture decisions.

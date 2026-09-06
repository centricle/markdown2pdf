# Coyote Procurement Review

A fixture exercising every construct the renderer has to survive. Names come
from the portfolio's standard cast, so nothing here reads as real data.

## Order History

ACME Corporation has shipped to Wile E. Coyote continuously since the first
rocket sled. The Road Runner remains unreachable.

| Item | Unit | Outcome |
| --- | --- | --- |
| Rocket Sled | each | Delivered |
| Giant Rubber Band | spool | Delivered |
| Instant Tunnel Paint | quart | Undelivered |

## Findings

1. Delivery succeeds in every case.
2. Deployment succeeds in no case.
3. The customer reorders regardless.

- Verified by Sam Sheepdog
- Disputed by Daffy Duck
- Escalated to nobody

> The apparatus performs to specification. The specification was the problem.

Recovery rates are unchanged from last quarter.[^rate]

[^rate]: Measured against invoices settled within thirty days.

## Instrumentation

```js
const outcome = await deploy({ device: 'rocket-sled', operator: 'coyote' });
if (!outcome.ok) {
  // Historically this branch is the only one taken.
  console.error(`failed after ${outcome.seconds}s`);
}
```

Inline `code` renders too, as does **bold**, *italic*, and a
[link](https://example.example/catalog).

## Attachment

![A red square](red.png)

---

Filed by ACME Corporation.

# NYSA CORE Governed Share Preflight — Local Functional Prototype

Run `node tools\governed-share-preflight-local\server.js` and open `http://127.0.0.1:3223`.

This local-only package validates share-time Inventory eligibility, customer-visible snapshot
integrity and the existing communication-policy decision. It produces short-lived prepared evidence
only. It has no contact values, provider connector, dispatch operation or authoritative mutation.

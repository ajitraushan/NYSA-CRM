# DEV273 D-2 review note on lsnode and digest concurrency

Read-only inspection observed two command-and-directory-verified CRM Test workers and three Production workers. Multiple workers can appear when LiteSpeed spawns another worker for a socket or when workers overlap during a recycle. The inspections establish the worker sets at those times. Establish the cause by correlating process start times, parent PIDs, socket bindings, and selector and LiteSpeed lifecycle logs.

DEV272 starts the digest timer in each server process. The scheduler uses a unique recipient, audience and report-date key with ON CONFLICT DO NOTHING. The claim transaction uses pg_advisory_xact_lock with prospect-digest-smtp-claim, plus FOR UPDATE SKIP LOCKED and a status transition. This coordinates claiming across workers. Each process can still run the digest loop and scheduling queries. The advisory lock covers the claim transaction.

For D-2, verify concurrent scheduling and claims with two processes. Consider a singleton digest runner only if evidence shows a need to serialize the full loop. Review crash and ambiguous SMTP outcomes before proposing any change. Keep the exact-one-worker release gate.

# NYSA CORE Broker Next Action Local Prototype

Run `node tools\broker-next-action-local\server.js` and open `http://127.0.0.1:3222`.

This is an exploratory translation prototype, not a proposed separate production queue. It ranks
governed customer responses into explainable action proposals so those actions can later be mapped
into the existing CRM Task, My Tasks, My Diary, Opportunity and Immediate Attention workflow.
Decision controls produce preview evidence only. It does not connect to a database or provider and
cannot send, assign, reserve Inventory, or change an Opportunity.

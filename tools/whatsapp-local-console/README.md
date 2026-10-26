# NYSA CORE WhatsApp Local Console

This is a localhost-only visual console for the synthetic communication connector. It is not part
of the CORE runtime and has no provider or external-network capability.

From the canonical worktree, run:

```powershell
node tools\whatsapp-local-console\server.js
```

Then open `http://127.0.0.1:3219` in a browser. Stop the console with `Ctrl+C`.

The console accepts no contact information, credentials, or communication content. All displayed
references are fixed opaque synthetic values.

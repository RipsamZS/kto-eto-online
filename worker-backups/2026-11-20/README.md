# Kazo Hub Beta — live Worker backup

- Captured: 2026-11-20
- Source Worker: `kazo-hub-beta`
- Active version at capture: `3a4ad032-ef22-4f89-aa74-20bffc7a7084`
- Active deployment at capture: `34435933-8974-4897-9b50-c4241d4aa20c`
- Backup Worker: `kazo-hub-beta-backup`
- Backup Worker has its own Durable Object namespace and starts with empty room state.
- `worker.js` is the exact bundled source downloaded from the active Worker at capture time.

Important: the repository branch was based on `stable/worker-183`, but that branch was not synchronized with the deployed Worker source. The exact deployed Worker source is preserved in `worker.js` here. Do not deploy this branch over the production Worker without reviewing the snapshot and bindings.

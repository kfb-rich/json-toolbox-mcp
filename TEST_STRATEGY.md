# MCP Contract Test Strategy

This file documents how the contract tester probes an MCP server. The Tweaker
agent reads this to understand WHY each failure was detected.

## Probes
1. **Boot probe** — `initialize` over stdio. Catches missing deps, syntax errors,
   unhandled startup throws, missing transport.connect().
2. **Discovery probe** — `tools/list`. Compared against PLAN.json. A planned
   tool that doesn't appear → `missing_tool` failure.
3. **Schema probe** — every tool's `inputSchema` is read; args are synthesized
   from it (zod types, defaults, examples). If schema validation fails the
   tester sees an `isError`/RPC error → `tool_error` / `rpc_error`.
4. **Happy-path probe** — `tools/call` for every discovered tool. Verifies the
   return shape `{ content: [{ type, text }] }`.

## Failure kinds emitted
| kind            | meaning                                            |
|-----------------|----------------------------------------------------|
| boot_failure    | Server crashed before initialize                   |
| missing_tool    | PLAN.json had it; tools/list does not              |
| invalid_shape   | Return object isn't { content: [...] }             |
| tool_error      | Tool returned isError=true on synthesized args     |
| rpc_error       | Tool threw / RPC error / timeout                   |

# JSON Toolbox — MCP Server Research (2026)

## 1. Who installs this?
- **Cursor / Claude Code users** debugging API responses, fixtures, or config files inline.
- **Claude Desktop power users** pasting large JSON blobs they don't want to burn context tokens parsing.
- **Automation / integration engineers** building n8n/Zapier-style flows where the agent must reshape webhook payloads.
- **QA & SDETs** diffing API snapshots between staging vs prod runs.
- Secondary: **data engineers** sanity-checking JSONL exports before ingestion.

## 2. Tools to expose (6)
1. `json_validate` — Parse + return error with line/column; optional JSON Schema (Draft 2020-12) validation via Ajv.
2. `json_query` — JSONPath (RFC 9535) and/or JMESPath query against a doc; returns matched nodes + paths.
3. `json_diff` — Structural diff (RFC 6902 patch + human-readable summary) between two docs.
4. `json_patch` — Apply RFC 6902 / RFC 7396 merge patch and return result.
5. `json_format` — Pretty-print with configurable indent, key sort, trailing-comma stripping (JSON5 input tolerated).
6. `json_minify` — Strip whitespace + optional key-order canonicalization (RFC 8785 JCS) for hashing.
7. `json_transform` — jq-style expression evaluation (via `node-jq-wasm`).
8. `json_stats` — Size, depth, key count, type histogram, largest-node report — useful before agent dumps a 4MB blob into context.

## 3. Closest existing MCP servers — gaps
- **`mcp-json` / `json-mcp-server`** (community repos on GitHub): mostly thin wrappers around `JSON.parse` + JSONPath; no diff, no schema validation, no jq, no canonicalization.
- **`filesystem` MCP server** (Anthropic reference): reads files but offers zero JSON semantics.
- **`mcp-jq`** experiments exist but require local `jq` binary → breaks Windows/Claude Desktop installs.
- **Missing across the board**: RFC 6902 patches, JSON Schema validation, JCS canonical hashing, size/shape reports, and a single zero-dep install. That bundle is the wedge.

## 4. Data sources / APIs / files
- **None external.** Pure compute.
- Optional file I/O: read/write JSON from a sandboxed path (configurable `JSON_TOOLBOX_ROOT`), or accept inline strings + base64 for binary-safe transport.
- Optional: fetch remote JSON Schema by `$ref` (toggleable, off by default for safety).

## 5. Auth
- **None.** Local stdio MCP server.
- Single env var `JSON_TOOLBOX_MAX_BYTES` (default 10MB) and `JSON_TOOLBOX_ALLOW_REMOTE_REFS=false` for schema fetching.

## 6. Pricing instinct
- **Free OSS (MIT)** — this is a credibility/distribution play, not a revenue product. Commodity utility; any paywall guarantees a fork in a weekend.
- Monetization, if any: a **Pro "Schema Studio"** companion (hosted schema registry, diff history, team-shared transforms) — but ship that as a *separate* MCP, not gated tools here.
- Realistic: aim for npm downloads + Smithery top-10 in dev-tools, then upsell adjacent paid servers.

## 7. Risks / what makes shipping hard
- **Commoditization**: trivially cloneable; the moat is bundle quality, perfect JSON-RPC schemas, and being *first to feel canonical*. Ship fast, polish docs, get into Smithery's curated list.
- **Token economics**: large JSON returns blow context. Must support `summary_only`, `head`, `paths_only`, and pagination on every tool — easy to under-design.
- **LLM tool selection ambiguity**: 6+ overlapping tools confuse models (`format` vs `minify` vs `transform`). Need crisp, action-verb names + examples in tool descriptions; consider one `json` tool with `op` enum if eval shows confusion.
- **JSONPath dialect war**: ship RFC 9535 (the 2024 standard) but document the Goessner-isms users will paste from Stack Overflow.
- **jq via WASM**: adds ~2MB install and cold-start latency; gate behind optional dep or lazy-load.
- **Security**: schema `$ref` fetch = SSRF vector; file paths = path traversal. Both need strict defaults.
- **Eval/marketing**: dev-tools MCPs are won by the README. Without a 30-second GIF showing Claude diffing two API responses, it dies in the long tail.

**Verdict:** Low-moat but high-utility. Worth shipping as a *trust-builder* in a portfolio of MCP servers; don't expect it to monetize standalone.
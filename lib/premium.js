/**
 * Premium MCP helpers — shared by every server in the API Factory MCP catalog.
 *
 * The "Premium Signature" — what makes our servers different:
 *   1. Consistent error envelope ({ code, message, hint, retryable, docs })
 *   2. Dual-output responses (human text + structured _meta)
 *   3. Built-in introspection tools (about, health, examples)
 *   4. Pagination contract for list-returning tools
 *   5. Progress notifications for long ops
 *   6. Dry-run mode helper for destructive tools
 *
 * Use these helpers in EVERY tool handler so the catalog feels coherent to the LLM.
 */
const { z } = require('zod');

const SIGNATURE = 'API Factory · Premium MCP';
const SPEC_URL = 'https://github.com/kfb-rich/api-factory-mcp-spec';

const ErrorCodes = Object.freeze({
  INVALID_INPUT:   'invalid_input',
  NOT_FOUND:       'not_found',
  RATE_LIMITED:    'rate_limited',
  UPSTREAM_ERROR:  'upstream_error',
  INTERNAL:        'internal',
  PERMISSION:      'permission',
  TIMEOUT:         'timeout',
  UNSUPPORTED:     'unsupported',
  CONFLICT:        'conflict',
  PAYMENT_REQUIRED:'payment_required'
});

/**
 * Successful response. Returns BOTH a human-readable text block AND a structured
 * `_meta` payload so downstream tools/LLMs can chain without re-parsing prose.
 *
 *   ok({ items: [...] })                    // auto-stringified
 *   ok('Plain text result', { count: 12 })  // explicit text + meta
 */
function ok(payload, meta) {
  let text;
  if (typeof payload === 'string') {
    text = payload;
  } else {
    try { text = JSON.stringify(payload, null, 2); }
    catch { text = String(payload); }
  }
  const out = { content: [{ type: 'text', text }] };
  if (meta && typeof meta === 'object') out._meta = meta;
  else if (typeof payload === 'object' && payload !== null) out._meta = payload;
  return out;
}

/**
 * Error response with consistent envelope. The LLM sees both a readable line
 * AND a structured _meta.error so it can self-correct.
 *
 *   err(ErrorCodes.INVALID_INPUT, 'limit must be 1-100', { hint: 'Try limit:50', retryable: true })
 */
function err(code, message, opts = {}) {
  const { hint, retryable = false, docs, details } = opts;
  const lines = [`[${code}] ${message}`];
  if (hint) lines.push(`Hint: ${hint}`);
  if (docs) lines.push(`Docs: ${docs}`);
  return {
    isError: true,
    content: [{ type: 'text', text: lines.join('\n') }],
    _meta: { error: { code, message, hint, retryable, docs, details } }
  };
}

/**
 * Paginated response for list-returning tools. Stable cursor based on offset.
 *
 *   paged(items, { cursor, limit: 50 })
 */
function paged(items, opts = {}) {
  const limit = clamp(parseInt(opts.limit, 10) || 50, 1, 500);
  const start = parseInt(opts.cursor, 10) || 0;
  const arr = Array.isArray(items) ? items : [];
  const slice = arr.slice(start, start + limit);
  const nextCursor = start + limit < arr.length ? String(start + limit) : null;
  return ok(
    { items: slice, nextCursor, returned: slice.length, total: arr.length },
    { cursor: nextCursor, limit, total: arr.length, returned: slice.length, hasMore: nextCursor !== null }
  );
}

/**
 * Progress notification — shows "Processing 47/200..." in clients that support it.
 * Silently no-ops if the host doesn't pass a progressToken.
 */
async function progress(server, token, current, total, message) {
  if (!token || !server) return;
  try {
    await server.notification?.({
      method: 'notifications/progress',
      params: {
        progressToken: token,
        progress: current,
        total: total || undefined,
        message: message || undefined
      }
    });
  } catch { /* notifications are best-effort */ }
}

/**
 * Dry-run guard. If args.dry_run is true, returns a preview ok() and skips execution.
 * Use at the top of any destructive/expensive tool.
 *
 *   if (preview = dryRun(args, () => ({ would: 'delete 12 files' }))) return preview;
 */
function dryRun(args, previewFn) {
  if (!args || !args.dry_run) return null;
  try {
    const preview = previewFn();
    return ok(
      { dryRun: true, preview, note: 'Set dry_run=false to actually execute.' },
      { dryRun: true }
    );
  } catch (e) {
    return err(ErrorCodes.INTERNAL, 'dry-run preview failed: ' + e.message);
  }
}

/**
 * Wraps an async tool handler so any uncaught throw becomes a clean error envelope
 * instead of exploding the JSON-RPC channel.
 */
function safe(handler) {
  return async (args, extra) => {
    try {
      return await handler(args, extra);
    } catch (e) {
      const msg = e && (e.message || e.toString()) || 'unknown error';
      return err(ErrorCodes.INTERNAL, msg, {
        hint: 'This is a server-side bug. File an issue with the input that triggered it.',
        retryable: false
      });
    }
  };
}

/**
 * Registers the 3 introspection tools every Premium MCP ships with.
 * Call once after creating the server, before registering domain tools.
 */
function registerIntrospection(server, opts) {
  const {
    name,
    version,
    description,
    useCases = [],
    examples = {}
  } = opts;
  const startedAt = Date.now();

  server.registerTool('about', {
    title: 'About this server',
    description:
      `Returns identity, capabilities, and top use cases for ${name}.\n` +
      `When to use: call once at the start of a session to learn what this server can do.\n` +
      `Returns: { name, version, description, useCases[], signature, spec }.`,
    inputSchema: {}
  }, safe(async () => ok({
    name,
    version,
    description,
    useCases,
    signature: SIGNATURE,
    spec: SPEC_URL,
    primitives: ['tools', 'prompts', 'resources']
  })));

  server.registerTool('health', {
    title: 'Health check',
    description:
      `Returns server uptime, version, and ready state.\n` +
      `When to use: debugging connection issues, verifying the server is responsive, or pinging before a long session.\n` +
      `Returns: { status, version, uptimeMs, pid, node }.`,
    inputSchema: {}
  }, safe(async () => ok({
    status: 'ok',
    version,
    uptimeMs: Date.now() - startedAt,
    pid: process.pid,
    node: process.version,
    signature: SIGNATURE
  })));

  server.registerTool('examples', {
    title: 'Tool examples',
    description:
      `Returns runnable example argument payloads for each tool.\n` +
      `When to use: learning what arguments a tool expects, or generating a first call.\n` +
      `Args: tool (optional) — name of a specific tool, or omit for all.\n` +
      `Returns: { examples: { toolName: [exampleArgs, ...] } }.`,
    inputSchema: { tool: z.string().optional().describe('Specific tool name, or omit to list all') }
  }, safe(async ({ tool }) => {
    if (tool) {
      const ex = examples[tool];
      if (!ex) return err(ErrorCodes.NOT_FOUND, `No examples registered for tool '${tool}'`, {
        hint: 'Call examples with no args to see all registered examples.'
      });
      return ok({ tool, examples: ex });
    }
    return ok({ examples, signature: SIGNATURE });
  }));
}

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

module.exports = {
  ok, err, paged, progress, dryRun, safe,
  registerIntrospection,
  ErrorCodes,
  SIGNATURE, SPEC_URL
};

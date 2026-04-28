#!/usr/bin/env node
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { ok, err, paged, progress, dryRun, safe, registerIntrospection, ErrorCodes } = require('./lib/premium');

const name = 'json-toolbox-mcp';
const version = '0.1.0';
const description = 'Pure-JS MCP server that gives AI assistants tools to validate, query (JSONPath), diff, format, and minify JSON.';

const server = new McpServer({ name, version });

const __examples = {};

registerIntrospection(server, {
  name,
  version,
  description,
  useCases: [
    'Verify a service is reachable via ping',
    'Echo input back for connectivity tests'
  ],
  examples: __examples
});

server.registerTool(
  'ping',
  {
    title: 'Ping',
    description: [
      'Health check returning server identity and timestamp.',
      'When to use: confirm the MCP server is reachable and responsive.',
      'Args: (none)',
      'Returns: { ok, server, ts } payload.'
    ].join('\n'),
    inputSchema: {}
  },
  safe(async () => ok({ ok: true, server: name, ts: new Date().toISOString() }))
);
__examples.ping = [{}];

server.registerTool(
  'echo',
  {
    title: 'Echo',
    description: [
      'Echoes the input message back to the caller.',
      'When to use: smoke-test argument passing or round-trip a string through the transport.',
      'Args: message (string) — text to echo back verbatim.',
      'Returns: the same message string in the response payload.'
    ].join('\n'),
    inputSchema: { message: z.string().describe('Text to echo') }
  },
  safe(async ({ message }) => {
    if (typeof message !== 'string') {
      return err(ErrorCodes.INVALID_INPUT, 'message must be a string', { hint: 'Pass message:"hello"' });
    }
    return ok({ message });
  })
);
__examples.echo = [{ message: 'hello' }];

async function main() {
  await server.connect(new StdioServerTransport());
  process.stderr.write(`[${name}] ready\n`);
}
main().catch(e => { process.stderr.write('FATAL ' + (e.stack || e) + '\n'); process.exit(1); });
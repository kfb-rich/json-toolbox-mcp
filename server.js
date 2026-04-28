const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const server = new McpServer({ name: 'json-toolbox-mcp', version: '0.1.0' });

server.registerTool(
  'ping',
  { title: 'Ping', description: 'Health check.', inputSchema: {} },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify({ ok: true, server: 'json-toolbox-mcp', ts: new Date().toISOString() }) }]
  })
);

server.registerTool(
  'echo',
  {
    title: 'Echo',
    description: 'Echoes input message.',
    inputSchema: { message: z.string().describe('Text to echo') }
  },
  async ({ message }) => ({ content: [{ type: 'text', text: message }] })
);

async function main() {
  await server.connect(new StdioServerTransport());
  process.stderr.write('[json-toolbox-mcp] ready\n');
}
main().catch(e => { process.stderr.write('FATAL ' + (e.stack || e) + '\n'); process.exit(1); });
/**
 * Stdio MCP server — entry point for Claude Desktop.
 *
 * Add to ~/Library/Application Support/Claude/claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "poker-ledger": {
 *       "command": "npx",
 *       "args": ["ts-node", "--project", "/absolute/path/to/pottracker/tsconfig.mcp.json",
 *                "/absolute/path/to/pottracker/mcp/server.ts"],
 *       "env": {
 *         "DATABASE_URL": "<your-supabase-connection-string>",
 *         "DIRECT_URL": "<your-supabase-direct-url>",
 *         "POKER_MCP_USER_ID": "<your-user-id>"
 *       }
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { MCP_TOOLS, runTool } from './tools'

const server = new Server(
  { name: 'poker-ledger', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await runTool(
      request.params.name,
      (request.params.arguments ?? {}) as Record<string, unknown>,
    )
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    }
  }
})

;(async () => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
})().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})

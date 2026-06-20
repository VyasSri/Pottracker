import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { MCP_TOOLS, runTool } from '@/mcp/tools'

function buildServer() {
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

  return server
}

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

function checkApiKey(req: Request): boolean {
  const key = process.env.POKER_MCP_API_KEY
  if (!key) return false
  return req.headers.get('x-api-key') === key
}

async function handle(req: Request): Promise<Response> {
  if (!checkApiKey(req)) return unauthorized()

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — safe for serverless
  })
  const server = buildServer()
  await server.connect(transport)
  return transport.handleRequest(req)
}

export const POST = handle
export const GET = handle
export const DELETE = handle

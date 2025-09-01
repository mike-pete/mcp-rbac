import { env } from '@/env'
import { NextRequest, NextResponse } from 'next/server'
import { StreamingMcpServer } from '../../../mcp/streaming-server'
import { AuthenticatedRequest, withMcpAuth } from '../../../middleware/mcp-auth'

const mcpServer = new StreamingMcpServer()

export async function POST(request: NextRequest) {
	return withMcpAuth(request, async (authRequest: AuthenticatedRequest) => {
		try {
			const body = await authRequest.json()

			if (body.jsonrpc !== '2.0') {
				return NextResponse.json(
					{
						jsonrpc: '2.0',
						error: { code: -32600, message: 'Invalid Request - must be JSON-RPC 2.0' },
						id: body.id || null,
					},
					{ status: 400, headers: corsHeaders }
				)
			}

			try {
				// Use the server's request handlers directly
				const server = mcpServer.mcpServer as unknown as {
					_requestHandlers?: Map<string, (req: unknown, extra: unknown) => Promise<unknown>>
				}
				const handler = server._requestHandlers?.get(body.method)
				if (!handler) {
					throw new Error(`Method not found: ${body.method}`)
				}

				const result = await handler(
					{ method: body.method, params: body.params },
					{ _meta: authRequest.mcpContext }
				)

				return NextResponse.json({ jsonrpc: '2.0', result, id: body.id }, { headers: corsHeaders })
			} catch (error) {
				return NextResponse.json(
					{
						jsonrpc: '2.0',
						error: {
							code: -32601,
							message: `Method not found: ${body.method}`,
							data: error instanceof Error ? error.message : 'Unknown error',
						},
						id: body.id,
					},
					{ headers: corsHeaders }
				)
			}
		} catch (err) {
			return NextResponse.json(
				{
					jsonrpc: '2.0',
					error: {
						code: -32700,
						message: 'Parse error',
						data: err instanceof Error ? err.message : 'Unknown error',
					},
					id: null,
				},
				{ status: 400, headers: corsHeaders }
			)
		}
	})
}

const corsHeaders = {
	'Content-Type': 'application/json',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function GET(request: NextRequest) {
	return withMcpAuth(request, async (authRequest: AuthenticatedRequest) => {
		const { searchParams } = new URL(authRequest.url)
		const { mcpContext } = authRequest

		if (searchParams.get('action') === 'health') {
			return NextResponse.json(
				{
					status: 'healthy',
					server: 'streaming-mcp-server',
					version: '1.0.0',
					protocol: '2024-11-05',
					transport: 'http',
					user: {
						id: mcpContext.userId,
						email: mcpContext.userEmail,
						organizationId: mcpContext.organizationId,
					},
					timestamp: new Date().toISOString(),
				},
				{ headers: corsHeaders }
			)
		}

		return NextResponse.json(
			{
				name: 'streaming-mcp-server',
				version: '1.0.0',
				description: 'HTTP streaming MCP server with WorkOS authentication',
				protocol: '2024-11-05',
				transport: 'http',
				endpoints: { messages: '/api/mcp (POST)', health: '/api/mcp?action=health (GET)' },
				authentication: {
					type: 'oauth2',
					bearer_token_required: true,
					authorization_server: env.WORKOS_AUTHKIT_DOMAIN,
				},
				user: {
					id: mcpContext.userId,
					email: mcpContext.userEmail,
					organizationId: mcpContext.organizationId,
				},
			},
			{ headers: corsHeaders }
		)
	})
}

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders })
}

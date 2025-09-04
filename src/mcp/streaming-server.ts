import { env } from '@/env'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
	CallToolRequestSchema,
	InitializeRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { WorkOS } from '@workos-inc/node'
import { z } from 'zod'

export interface McpServerContext {
	userId?: string
}

const SERVER_INFO = {
	name: 'streaming-mcp-server',
	version: '1.0.0',
	description: 'A simple HTTP streaming MCP server with WorkOS authentication',
}

export class StreamingMcpServer {
	private server: Server

	constructor() {
		this.server = new Server(SERVER_INFO, { capabilities: { tools: {} } })
		this.setupHandlers()
	}

	private async createUserProfile(context: McpServerContext) {
		const userId = context?.userId

		let userData = {
			userId,
		}

		if (userId) {
			const workos = new WorkOS(env.WORKOS_API_KEY)

			const user = await workos.userManagement.getUser(userId)
			userData = { ...userData, ...user }
		}

		return userData
	}

	private setupHandlers() {
		this.server.setRequestHandler(InitializeRequestSchema, async () => ({
			protocolVersion: '2024-11-05',
			capabilities: { tools: {} },
			serverInfo: SERVER_INFO,
		}))

		this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: [
				{
					name: 'echo',
					description: 'Echo back a message with user context',
					inputSchema: {
						type: 'object',
						properties: { message: { type: 'string', description: 'Message to echo back' } },
						required: ['message'],
					},
				},
				{
					name: 'get_user_info',
					description: 'Get authenticated user information',
					inputSchema: { type: 'object', properties: {} },
				},
			],
		}))

		this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
			const context = extra?._meta as McpServerContext
			const { name, arguments: args } = request.params

			const createTextContent = (text: string) => ({ content: [{ type: 'text' as const, text }] })

			switch (name) {
				case 'echo':
					const { message } = z.object({ message: z.string() }).parse(args)
					return createTextContent(`"${message}"`)

				case 'get_user_info':
					return createTextContent(JSON.stringify(await this.createUserProfile(context), null, 2))

				default:
					throw new Error(`Tool not found: ${name}`)
			}
		})
	}

	get mcpServer() {
		return this.server
	}
}

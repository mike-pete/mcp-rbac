import { env } from '@/env'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
	CallToolRequestSchema,
	InitializeRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { WorkOS } from '@workos-inc/node'
import { z } from 'zod'
import { GatewayManager } from './gateway-manager'

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
	private gatewayManager: GatewayManager
	private initializationPromise: Promise<void>

	constructor() {
		this.server = new Server(SERVER_INFO, { capabilities: { tools: {} } })
		this.gatewayManager = new GatewayManager()
		this.initializationPromise = this.initializeGateway()
		this.setupHandlers()
	}

	private async initializeGateway(): Promise<void> {
		try {
			await this.gatewayManager.initialize()
			console.log('Gateway initialized successfully')
		} catch (error) {
			console.error('Failed to initialize gateway:', error)
		}
	}

	private async ensureInitialized(): Promise<void> {
		await this.initializationPromise
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

		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			await this.ensureInitialized()
			
			const localTools = [
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
			]

			const upstreamTools = await this.gatewayManager.getAllTools()
			
			return {
				tools: [...localTools, ...upstreamTools],
			}
		})

		this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
			await this.ensureInitialized()
			
			const context = extra?._meta as McpServerContext
			const { name, arguments: args } = request.params

			const createTextContent = (text: string) => ({ content: [{ type: 'text' as const, text }] })

			// Check if this is an upstream tool
			if (this.gatewayManager.isUpstreamTool(name)) {
				const result = await this.gatewayManager.callUpstreamTool(name, args)
				if (result) {
					return result
				}
				throw new Error(`Failed to call upstream tool: ${name}`)
			}

			// Handle local tools
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

import { env } from '@/env'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
	CallToolRequestSchema,
	InitializeRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { WorkOS } from '@workos-inc/node'
import { z } from 'zod'
import { GatewayManager, UpstreamConfig } from './gateway-manager'
import { convexClient, api } from '@/lib/convex-client'

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

	private async getGatewayForUser(userId: string | undefined): Promise<GatewayManager> {
		if (!userId) {
			// Return empty gateway for unauthenticated users
			return new GatewayManager([])
		}

		// Always fetch fresh servers and create new gateway
		const configs = await this.fetchUserServers(userId)
		const manager = new GatewayManager(configs)
		
		// Initialize the gateway
		await manager.initialize()
		
		return manager
	}

	private async fetchUserServers(userId: string): Promise<UpstreamConfig[]> {
		try {
			// Fetch user's enabled servers from Convex
			const enabledServers = await convexClient.query(api.mcpServers.getUserEnabledMcpServers, { userId })
			
			console.log(`Loaded ${enabledServers.length} enabled MCP servers for user ${userId}`)
			return enabledServers
		} catch (error) {
			console.error('Failed to fetch user servers:', error)
			return []
		}
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

		this.server.setRequestHandler(ListToolsRequestSchema, async (_, extra) => {
			const context = extra?._meta as McpServerContext
			console.log(`ListTools request for user: ${context?.userId}`)
			
			const gateway = await this.getGatewayForUser(context?.userId)
			
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

			const upstreamTools = await gateway.getAllTools()
			console.log(`Returning ${localTools.length} local tools and ${upstreamTools.length} upstream tools`)
			
			const allTools = [...localTools, ...upstreamTools]
			console.log(`Tool names: ${allTools.map(t => t.name).join(', ')}`)
			
			return {
				tools: allTools,
			}
		})

		this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
			const context = extra?._meta as McpServerContext
			const gateway = await this.getGatewayForUser(context?.userId)
			const { name, arguments: args } = request.params

			const createTextContent = (text: string) => ({ content: [{ type: 'text' as const, text }] })

			// Check if this is an upstream tool
			if (gateway.isUpstreamTool(name)) {
				const result = await gateway.callUpstreamTool(name, args)
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

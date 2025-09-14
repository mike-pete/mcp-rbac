import { v } from 'convex/values'
import { mutation, query, action } from './_generated/server'

type McpServerTool = {
	name: string
	description?: string
	inputSchema?: Record<string, unknown>
}

// Helper function to recursively remove $schema fields from objects
function cleanSchema(obj: unknown): unknown {
	if (!obj || typeof obj !== 'object') {
		return obj
	}
	
	if (Array.isArray(obj)) {
		return obj.map(cleanSchema)
	}
	
	const cleaned: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(obj)) {
		if (key !== '$schema') {
			cleaned[key] = cleanSchema(value)
		}
	}
	return cleaned
}

export const fetchServerTools = action({
	args: {
		serverName: v.string(),
		serverUrl: v.string(),
	},
	handler: async (_, args): Promise<McpServerTool[]> => {
		try {
			console.log(`Fetching tools for server: ${args.serverName} at ${args.serverUrl}`)
			
			// Make a request to initialize and list tools
			const initRequest = {
				jsonrpc: '2.0' as const,
				method: 'initialize',
				params: {
					protocolVersion: '2024-11-05',
					capabilities: { tools: {} },
					clientInfo: { name: 'mcp-gateway', version: '1.0.0' },
				},
				id: 1,
			}

			const initResponse = await fetch(args.serverUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
				body: JSON.stringify(initRequest),
			})

			if (!initResponse.ok) {
				throw new Error(`HTTP error! status: ${initResponse.status}`)
			}

			// List tools
			const listToolsRequest = {
				jsonrpc: '2.0' as const,
				method: 'tools/list',
				params: {},
				id: 2,
			}

			const toolsResponse = await fetch(args.serverUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
				body: JSON.stringify(listToolsRequest),
			})

			if (!toolsResponse.ok) {
				throw new Error(`HTTP error! status: ${toolsResponse.status}`)
			}

			const contentType = toolsResponse.headers.get('content-type') || ''
			const text = await toolsResponse.text()
			
			let data
			if (contentType.includes('text/event-stream')) {
				// Parse SSE format
				const lines = text.split('\n')
				let jsonData = ''
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						jsonData += line.substring(6)
					}
				}
				data = JSON.parse(jsonData)
			} else {
				data = JSON.parse(text)
			}

			if (data.error) {
				throw new Error(`MCP error: ${data.error.message}`)
			}

			const tools = (data.result?.tools as Array<{
				name: string
				description?: string
				inputSchema?: Record<string, unknown>
			}>) || []
			console.log(`Found ${tools.length} tools for ${args.serverName}:`, tools.map(t => t.name))
			
			return tools.map(tool => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema ? cleanSchema(tool.inputSchema) as Record<string, unknown> : undefined,
			}))
		} catch (error) {
			console.error(`Failed to fetch tools for server ${args.serverName}:`, error)
			return []
		}
	},
})

export const addMcpServer = mutation({
	args: {
		userId: v.string(),
		organizationId: v.string(),
		serverName: v.string(),
		serverUrl: v.string(),
		description: v.optional(v.string()),
		tools: v.optional(v.array(v.object({
			name: v.string(),
			description: v.optional(v.string()),
			inputSchema: v.optional(v.any()),
		}))),
	},
	handler: async (ctx, args) => {
		// Check if server with same name already exists for this user
		const existing = await ctx.db
			.query('mcpServers')
			.withIndex('by_user_and_name', (q) => q.eq('userId', args.userId).eq('serverName', args.serverName))
			.first()

		if (existing) {
			throw new Error(`Server with name "${args.serverName}" already exists`)
		}

		const serverId = await ctx.db.insert('mcpServers', {
			userId: args.userId,
			organizationId: args.organizationId,
			serverName: args.serverName,
			serverUrl: args.serverUrl,
			description: args.description,
			tools: args.tools,
			lastToolsUpdate: args.tools ? Date.now() : undefined,
			createdAt: Date.now(),
		})

		return serverId
	},
})

export const listMcpServers = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const servers = await ctx.db
			.query('mcpServers')
			.withIndex('by_user', (q) => q.eq('userId', args.userId))
			.collect()

		return servers
	},
})

export const getMcpServers = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const servers = await ctx.db
			.query('mcpServers')
			.withIndex('by_user', (q) => q.eq('userId', args.userId))
			.collect()

		// Get user's enabled servers
		const user = await ctx.db
			.query('users')
			.withIndex('by_userId', (q) => q.eq('userId', args.userId))
			.first()
		
		const enabledServerIds = user?.enabledServers || []

		return servers.map((server) => ({
			id: server._id,
			name: server.serverName,
			url: server.serverUrl,
			enabled: enabledServerIds.includes(server._id),
		}))
	},
})

export const getUserEnabledMcpServers = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		// Get user record to find enabled server IDs
		const user = await ctx.db
			.query('users')
			.withIndex('by_userId', (q) => q.eq('userId', args.userId))
			.first()

		// If no user record exists, return empty array (no servers enabled yet)
		if (!user || !user.enabledServers || user.enabledServers.length === 0) {
			return []
		}

		// Fetch all enabled servers
		const enabledServers = await Promise.all(
			user.enabledServers.map(async (serverId) => {
				const server = await ctx.db.get(serverId)
				if (!server) return null
				return {
					id: server._id,
					name: server.serverName,
					url: server.serverUrl,
					enabled: true,
				}
			})
		)

		// Filter out any null values (deleted servers)
		return enabledServers.filter(server => server !== null)
	},
})

export const listOrganizationServers = query({
	args: {
		organizationId: v.string(),
		userId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const servers = await ctx.db
			.query('mcpServers')
			.filter((q) => q.eq(q.field('organizationId'), args.organizationId))
			.collect()

		// If userId is provided, get their enabled servers
		let enabledServerIds: string[] = []
		if (args.userId) {
			const userId = args.userId
			const user = await ctx.db
				.query('users')
				.withIndex('by_userId', (q) => q.eq('userId', userId))
				.first()
			
			if (user) {
				enabledServerIds = user.enabledServers || []
			}
		}

		// Add enabled status to each server
		return servers.map(server => ({
			...server,
			enabled: enabledServerIds.includes(server._id),
		}))
	},
})

export const updateMcpServer = mutation({
	args: {
		id: v.id('mcpServers'),
		serverName: v.optional(v.string()),
		serverUrl: v.optional(v.string()),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { id, ...updates } = args
		
		// Remove undefined values
		const cleanUpdates = Object.fromEntries(
			Object.entries(updates).filter(([, value]) => value !== undefined)
		)

		if (Object.keys(cleanUpdates).length === 0) {
			throw new Error('No updates provided')
		}

		await ctx.db.patch(id, cleanUpdates)
		return id
	},
})

export const updateServerTools = mutation({
	args: {
		id: v.id('mcpServers'),
		tools: v.array(v.object({
			name: v.string(),
			description: v.optional(v.string()),
			inputSchema: v.optional(v.any()),
		})),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, {
			tools: args.tools,
			lastToolsUpdate: Date.now(),
		})
		return args.id
	},
})

export const deleteMcpServer = mutation({
	args: {
		id: v.id('mcpServers'),
	},
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id)
		return args.id
	},
})
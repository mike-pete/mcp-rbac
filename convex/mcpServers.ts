import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const addMcpServer = mutation({
	args: {
		userId: v.string(),
		organizationId: v.string(),
		serverName: v.string(),
		serverUrl: v.string(),
		description: v.optional(v.string()),
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

export const deleteMcpServer = mutation({
	args: {
		id: v.id('mcpServers'),
	},
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id)
		return args.id
	},
})
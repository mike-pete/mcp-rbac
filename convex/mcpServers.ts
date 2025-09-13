import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const addMcpServer = mutation({
	args: {
		userId: v.string(),
		serverName: v.string(),
		serverUrl: v.string(),
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
			serverName: args.serverName,
			serverUrl: args.serverUrl,
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

		return servers.map((server) => ({
			id: server._id,
			name: server.serverName,
			url: server.serverUrl,
		}))
	},
})

export const updateMcpServer = mutation({
	args: {
		id: v.id('mcpServers'),
		serverName: v.optional(v.string()),
		serverUrl: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { id, ...updates } = args
		
		// Remove undefined values
		const cleanUpdates = Object.fromEntries(
			Object.entries(updates).filter(([_, value]) => value !== undefined)
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
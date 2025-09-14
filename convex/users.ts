import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

export const toggleServerEnabled = mutation({
	args: {
		userId: v.string(),
		serverId: v.id('mcpServers'),
		enabled: v.boolean(),
	},
	handler: async (ctx, args) => {
		// Get or create user record
		const user = await ctx.db
			.query('users')
			.withIndex('by_userId', (q) => q.eq('userId', args.userId))
			.first()

		if (!user) {
			// Create new user record with this server enabled/disabled
			const userId = await ctx.db.insert('users', {
				userId: args.userId,
				enabledServers: args.enabled ? [args.serverId] : [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			})
			return userId
		}

		// Update existing user record
		const currentEnabled = user.enabledServers || []
		let newEnabled: Id<'mcpServers'>[]

		if (args.enabled) {
			// Add server if not already in list
			if (!currentEnabled.includes(args.serverId)) {
				newEnabled = [...currentEnabled, args.serverId]
			} else {
				newEnabled = currentEnabled
			}
		} else {
			// Remove server from list
			newEnabled = currentEnabled.filter((id) => id !== args.serverId)
		}

		await ctx.db.patch(user._id, {
			enabledServers: newEnabled,
			updatedAt: Date.now(),
		})

		return user._id
	},
})

export const getUserEnabledServers = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query('users')
			.withIndex('by_userId', (q) => q.eq('userId', args.userId))
			.first()

		if (!user) {
			return []
		}

		return user.enabledServers || []
	},
})

export const getOrCreateUser = mutation({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		let user = await ctx.db
			.query('users')
			.withIndex('by_userId', (q) => q.eq('userId', args.userId))
			.first()

		if (!user) {
			const userId = await ctx.db.insert('users', {
				userId: args.userId,
				enabledServers: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			})
			
			user = await ctx.db.get(userId)
		}

		return user
	},
})
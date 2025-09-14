import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
	mcpServers: defineTable({
		userId: v.string(),
		organizationId: v.string(),
		serverName: v.string(),
		serverUrl: v.string(),
		description: v.optional(v.string()),
		tools: v.optional(v.array(v.object({
			name: v.string(),
			description: v.optional(v.string()),
			inputSchema: v.optional(v.any()),
			enabled: v.boolean(),
		}))),
		lastToolsUpdate: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index('by_user', ['userId'])
		.index('by_user_and_name', ['userId', 'serverName'])
		.index('by_organization', ['organizationId']),
	
	users: defineTable({
		userId: v.string(),
		enabledServers: v.array(v.id('mcpServers')),
		isChampion: v.optional(v.boolean()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_userId', ['userId']),
})
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
	mcpServers: defineTable({
		userId: v.string(),
		organizationId: v.string(),
		serverName: v.string(),
		serverUrl: v.string(),
		description: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index('by_user', ['userId'])
		.index('by_user_and_name', ['userId', 'serverName'])
		.index('by_organization', ['organizationId']),
})
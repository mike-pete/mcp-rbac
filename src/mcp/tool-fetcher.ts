import { UpstreamMcpClient } from './upstream-client'

export type McpServerTool = {
	name: string
	description?: string
	inputSchema?: Record<string, unknown>
}

export class ToolFetcher {
	static async fetchServerTools(serverName: string, serverUrl: string): Promise<McpServerTool[]> {
		const client = new UpstreamMcpClient(serverName, serverUrl)
		
		try {
			console.log(`Fetching tools for server: ${serverName} at ${serverUrl}`)
			await client.initialize()
			
			const tools = client.getTools()
			console.log(`Found ${tools.length} tools for ${serverName}:`, tools.map(t => t.name))
			
			// Remove the server name prefix that was added by UpstreamMcpClient
			return tools.map(tool => ({
				name: tool.name.replace(`${serverName}_`, ''),
				description: tool.description,
				inputSchema: tool.inputSchema,
			}))
		} catch (error) {
			console.error(`Failed to fetch tools for server ${serverName}:`, error)
			// Return empty array on failure rather than throwing - we don't want server addition to fail
			return []
		}
	}
}
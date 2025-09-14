import { McpTool, McpToolResult, UpstreamMcpClient } from './upstream-client'

export type UpstreamConfig = {
	name: string
	url: string
	tools?: Array<{
		name: string
		description?: string
		inputSchema?: Record<string, unknown>
		enabled: boolean
	}>
}

export class GatewayManager {
	private upstreamClients: Map<string, UpstreamMcpClient> = new Map()
	private toolToClientMap: Map<string, UpstreamMcpClient> = new Map()
	private initialized = false
	private upstreamConfigs: UpstreamConfig[]
	private configByServerName: Map<string, UpstreamConfig> = new Map()

	constructor(configs: UpstreamConfig[] = []) {
		this.upstreamConfigs = configs
		// Create a map for easy config lookup by server name
		for (const config of configs) {
			this.configByServerName.set(config.name, config)
		}
		this.setupUpstreamClients()
	}

	private setupUpstreamClients(): void {
		for (const config of this.upstreamConfigs) {
			const client = new UpstreamMcpClient(config.name, config.url)
			this.upstreamClients.set(config.name, client)
		}
	}

	async initialize(): Promise<void> {
		if (this.initialized) return

		console.log('Initializing gateway manager with upstream clients:', Array.from(this.upstreamClients.keys()))

		const initPromises = Array.from(this.upstreamClients.values()).map(async (client) => {
			try {
				console.log(`Initializing upstream client: ${client.getName()}`)
				await client.initialize()
				const tools = client.getTools()
				console.log(`Upstream client ${client.getName()} provides ${tools.length} tools:`, tools.map(t => t.name))
				// Filter tools based on enabled state from config
				const config = this.configByServerName.get(client.getName())
				for (const tool of tools) {
					// Check if this tool is enabled in the config
					const originalToolName = tool.name.replace(`${client.getName()}_`, '')
					const configTool = config?.tools?.find(t => t.name === originalToolName)
					
					// Only add to tool map if enabled (default to true if no config)
					if (!configTool || configTool.enabled) {
						this.toolToClientMap.set(tool.name, client)
						console.log(`Enabled tool: ${tool.name}`)
					} else {
						console.log(`Disabled tool: ${tool.name}`)
					}
				}
			} catch (error) {
				console.error(`Failed to initialize upstream client ${client.getName()}:`, error)
			}
		})

		await Promise.all(initPromises)
		this.initialized = true
		console.log('Gateway manager initialized with tool map:', Array.from(this.toolToClientMap.keys()))
	}

	async getAllTools(): Promise<McpTool[]> {
		if (!this.initialized) {
			await this.initialize()
		}

		const allTools: McpTool[] = []
		for (const client of this.upstreamClients.values()) {
			const clientTools = client.getTools()
			const config = this.configByServerName.get(client.getName())
			
			// Filter tools based on enabled state
			for (const tool of clientTools) {
				const originalToolName = tool.name.replace(`${client.getName()}_`, '')
				const configTool = config?.tools?.find(t => t.name === originalToolName)
				
				// Only include enabled tools (default to true if no config)
				if (!configTool || configTool.enabled) {
					allTools.push(tool)
				}
			}
		}
		return allTools
	}

	async callUpstreamTool(toolName: string, args: unknown): Promise<McpToolResult | null> {
		if (!this.initialized) {
			await this.initialize()
		}

		const client = this.toolToClientMap.get(toolName)
		if (!client) {
			return null
		}

		try {
			const result = await client.callTool(toolName, args)
			return {
				content: result.content,
			}
		} catch (error) {
			console.error(`Error calling upstream tool ${toolName}:`, error)
			throw error
		}
	}

	isUpstreamTool(toolName: string): boolean {
		return this.toolToClientMap.has(toolName)
	}
}
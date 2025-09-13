import { McpTool, McpToolResult, UpstreamMcpClient } from './upstream-client'

export type UpstreamConfig = {
	name: string
	url: string
}

export class GatewayManager {
	private upstreamClients: Map<string, UpstreamMcpClient> = new Map()
	private toolToClientMap: Map<string, UpstreamMcpClient> = new Map()
	private initialized = false
	private upstreamConfigs: UpstreamConfig[]

	constructor(configs: UpstreamConfig[] = []) {
		this.upstreamConfigs = configs
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
				for (const tool of tools) {
					this.toolToClientMap.set(tool.name, client)
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
			allTools.push(...client.getTools())
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
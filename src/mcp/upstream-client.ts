export type McpTool = {
	name: string
	description?: string
	inputSchema?: Record<string, unknown>
}

export type McpToolResult = {
	content: Array<{ type: string; text?: string; data?: unknown }>
}

type McpRequest = {
	jsonrpc: '2.0'
	method: string
	params?: unknown
	id: string | number
}

type McpResponse = {
	jsonrpc: '2.0'
	result?: unknown
	error?: {
		code: number
		message: string
		data?: unknown
	}
	id: string | number | null
}

type InitializeResult = {
	protocolVersion: string
	capabilities: {
		tools?: Record<string, unknown>
		resources?: Record<string, unknown>
		prompts?: Record<string, unknown>
	}
	serverInfo: {
		name: string
		version: string
		description?: string
	}
}

type ListToolsResult = {
	tools: McpTool[]
}

type CallToolResult = {
	content: Array<{
		type: string
		text?: string
		data?: unknown
	}>
	isError?: boolean
}

export class UpstreamMcpClient {
	private url: string
	private name: string
	private initialized = false
	private tools: McpTool[] = []
	private requestId = 0

	constructor(name: string, url: string) {
		this.name = name
		this.url = url
	}

	private getNextId(): number {
		return ++this.requestId
	}

	private async parseSSEResponse(text: string): Promise<McpResponse> {
		const lines = text.split('\n')
		let jsonData = ''
		
		for (const line of lines) {
			if (line.startsWith('data: ')) {
				jsonData += line.substring(6)
			}
		}
		
		if (!jsonData) {
			throw new Error('No data found in SSE response')
		}
		
		return JSON.parse(jsonData) as McpResponse
	}

	private async sendRequest(request: McpRequest): Promise<McpResponse> {
		console.log(`Sending request to ${this.name}:`, request.method)
		
		const response = await fetch(this.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json, text/event-stream',
			},
			body: JSON.stringify(request),
		})

		if (!response.ok) {
			const text = await response.text()
			console.error(`HTTP error from ${this.name}:`, response.status, text)
			throw new Error(`HTTP error! status: ${response.status}, body: ${text}`)
		}

		const contentType = response.headers.get('content-type') || ''
		const text = await response.text()
		
		let data: McpResponse
		
		if (contentType.includes('text/event-stream')) {
			// Parse SSE format
			data = await this.parseSSEResponse(text)
		} else {
			// Parse regular JSON
			data = JSON.parse(text) as McpResponse
		}

		if (data.error) {
			console.error(`MCP error from ${this.name}:`, data.error)
			throw new Error(`MCP error: ${data.error.message}`)
		}

		console.log(`Response from ${this.name}:`, data.result ? 'success' : 'no result')
		return data
	}

	async initialize(): Promise<void> {
		if (this.initialized) return

		const initRequest: McpRequest = {
			jsonrpc: '2.0',
			method: 'initialize',
			params: {
				protocolVersion: '2024-11-05',
				capabilities: {
					tools: {},
				},
				clientInfo: {
					name: 'mcp-gateway',
					version: '1.0.0',
				},
			},
			id: this.getNextId(),
		}

		const response = await this.sendRequest(initRequest)
		const result = response.result as InitializeResult

		if (!result.protocolVersion) {
			throw new Error('Invalid initialization response')
		}

		const listToolsRequest: McpRequest = {
			jsonrpc: '2.0',
			method: 'tools/list',
			params: {},
			id: this.getNextId(),
		}

		const toolsResponse = await this.sendRequest(listToolsRequest)
		const toolsResult = toolsResponse.result as ListToolsResult

		this.tools = toolsResult.tools.map((tool) => ({
			...tool,
			name: `${this.name}_${tool.name}`,
		}))

		this.initialized = true
	}

	getTools(): McpTool[] {
		return this.tools
	}

	async callTool(toolName: string, args: unknown): Promise<CallToolResult> {
		if (!this.initialized) {
			await this.initialize()
		}

		const originalToolName = toolName.replace(`${this.name}_`, '')
		
		const request: McpRequest = {
			jsonrpc: '2.0',
			method: 'tools/call',
			params: {
				name: originalToolName,
				arguments: args,
			},
			id: this.getNextId(),
		}

		const response = await this.sendRequest(request)
		return response.result as CallToolResult
	}

	getName(): string {
		return this.name
	}
}
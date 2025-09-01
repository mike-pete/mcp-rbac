import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export interface McpServerContext {
  userId?: string;
  organizationId?: string;
  userEmail?: string;
}

export class StreamingMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "streaming-mcp-server",
        version: "1.0.0",
        description: "A simple HTTP streaming MCP server with WorkOS authentication",
      },
      {
        capabilities: {
          resources: {
            subscribe: false,
            templates: false,
          },
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "user://profile",
            mimeType: "application/json",
            name: "User Profile",
            description: "Current authenticated user's profile information",
          },
          {
            uri: "user://organization",
            mimeType: "application/json", 
            name: "User Organization",
            description: "Current user's organization details",
          },
        ],
      };
    });

    // Read specific resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
      const context = extra?._meta as McpServerContext;
      const { uri } = request.params;

      switch (uri) {
        case "user://profile":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify({
                  userId: context?.userId || "unknown",
                  email: context?.userEmail || "unknown",
                  authenticated: !!context?.userId,
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };

        case "user://organization":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify({
                  organizationId: context?.organizationId || "none",
                  userId: context?.userId || "unknown",
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };

        default:
          throw new Error(`Resource not found: ${uri}`);
      }
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "echo",
            description: "Echo back a message with user context",
            inputSchema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "Message to echo back",
                },
              },
              required: ["message"],
            },
          },
          {
            name: "get_user_info",
            description: "Get authenticated user information",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "timestamp",
            description: "Get current server timestamp",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const context = extra?._meta;
      const { name, arguments: args } = request.params;
      console.log(context)

      switch (name) {
        case "echo":
          const echoArgs = z.object({ message: z.string() }).parse(args);
          return {
            content: [
              {
                type: "text",
                text: `Echo: ${echoArgs.message}\nUser: ${context?.userEmail || "unknown"}\nOrg: ${context?.organizationId || "none"}`,
              },
            ],
          };

        case "get_user_info":
          return {
            content: [
              {
                type: "text", 
                text: JSON.stringify({
                  userId: context?.userId || "unknown",
                  email: context?.userEmail || "unknown",
                  organizationId: context?.organizationId || "none",
                  authenticated: !!context?.userId,
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };

        case "timestamp":
          return {
            content: [
              {
                type: "text",
                text: `Current server time: ${new Date().toISOString()}`,
              },
            ],
          };

        default:
          throw new Error(`Tool not found: ${name}`);
      }
    });
  }

  getServer() {
    return this.server;
  }

  async handleRequest(method: string, params: unknown, context: McpServerContext): Promise<unknown> {
    const extra = { _meta: context };
    
    switch (method) {
      case "resources/list":
        const listHandler = (this.server as unknown as { _requestHandlers?: Map<string, (req: unknown, extra: unknown) => Promise<unknown>> })._requestHandlers?.get?.("resources/list");
        if (listHandler) {
          return await listHandler({ method, params }, extra);
        }
        break;
        
      case "resources/read":
        const readHandler = (this.server as unknown as { _requestHandlers?: Map<string, (req: unknown, extra: unknown) => Promise<unknown>> })._requestHandlers?.get?.("resources/read");
        if (readHandler) {
          return await readHandler({ method, params }, extra);
        }
        break;
        
      case "tools/list":
        const toolsListHandler = (this.server as unknown as { _requestHandlers?: Map<string, (req: unknown, extra: unknown) => Promise<unknown>> })._requestHandlers?.get?.("tools/list");
        if (toolsListHandler) {
          return await toolsListHandler({ method, params }, extra);
        }
        break;
        
      case "tools/call":
        const toolsCallHandler = (this.server as unknown as { _requestHandlers?: Map<string, (req: unknown, extra: unknown) => Promise<unknown>> })._requestHandlers?.get?.("tools/call");
        if (toolsCallHandler) {
          return await toolsCallHandler({ method, params }, extra);
        }
        break;
    }
    
    throw new Error(`Method not implemented: ${method}`);
  }
}
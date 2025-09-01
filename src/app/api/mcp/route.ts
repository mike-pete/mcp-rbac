import { NextRequest, NextResponse } from "next/server";
import { StreamingMcpServer } from "../../../mcp/streaming-server";
import { withMcpAuth, AuthenticatedRequest } from "../../../middleware/mcp-auth";

// Create global server instance
let mcpServer: StreamingMcpServer | null = null;

function getMcpServer(): StreamingMcpServer {
  if (!mcpServer) {
    mcpServer = new StreamingMcpServer();
  }
  return mcpServer;
}

// Handle POST requests (main MCP message handling)
export async function POST(request: NextRequest) {
  return withMcpAuth(request, async (authRequest: AuthenticatedRequest) => {
    try {
      const body = await authRequest.json();
      
      // Validate JSON-RPC format
      if (!body.jsonrpc || body.jsonrpc !== "2.0") {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: body.id || null,
            error: {
              code: -32600,
              message: "Invalid Request - must be JSON-RPC 2.0",
            },
          },
          { status: 400 }
        );
      }

      // Handle the MCP request through the SDK
      let response;
      try {
        
        // Process different types of MCP requests
        switch (body.method) {
          case "initialize":
            response = {
              jsonrpc: "2.0",
              id: body.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {
                  resources: {
                    subscribe: false,
                    templates: false,
                  },
                  tools: {},
                },
                serverInfo: {
                  name: "streaming-mcp-server",
                  version: "1.0.0",
                },
              },
            };
            break;
            
          case "initialized":
            // Just acknowledge the initialized notification
            return new NextResponse(null, { status: 204 });
            
          default:
            // Handle other MCP requests through the server's request handlers
            try {
              const mcpInstance = getMcpServer();
              const result = await mcpInstance.handleRequest(body.method, body.params, authRequest.mcpContext);
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result,
              };
            } catch (error) {
              response = {
                jsonrpc: "2.0",
                id: body.id,
                error: {
                  code: -32601,
                  message: `Method not found: ${body.method}`,
                  data: error instanceof Error ? error.message : "Unknown error",
                },
              };
            }
        }
      } catch (error) {
        console.error("MCP handler error:", error);
        response = {
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: -32603,
            message: "Internal error",
            data: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
      
      return NextResponse.json(response, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    } catch (err) {
      console.error("MCP request error:", err);
      
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
          data: err instanceof Error ? err.message : "Unknown error",
        },
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
  });
}

// Handle GET requests (server info and health checks)
export async function GET(request: NextRequest) {
  return withMcpAuth(request, async (authRequest: AuthenticatedRequest) => {
    const { searchParams } = new URL(authRequest.url);
    const action = searchParams.get("action");

    // Health check endpoint
    if (action === "health") {
      return NextResponse.json({
        status: "healthy",
        server: "streaming-mcp-server",
        version: "1.0.0",
        protocol: "2024-11-05",
        transport: "http",
        user: {
          id: authRequest.mcpContext.userId,
          email: authRequest.mcpContext.userEmail,
          organizationId: authRequest.mcpContext.organizationId,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Default: return server info and capabilities
    
    return NextResponse.json({
      name: "streaming-mcp-server",
      version: "1.0.0",
      description: "HTTP streaming MCP server with WorkOS authentication",
      protocol: "2024-11-05",
      transport: "http",
      capabilities: {
        resources: {
          subscribe: false,
          templates: false,
        },
        tools: {},
      },
      endpoints: {
        messages: "/api/mcp (POST)",
        health: "/api/mcp?action=health (GET)",
      },
      authentication: {
        type: "oauth2",
        bearer_token_required: true,
        authorization_server: process.env.WORKOS_AUTHKIT_DOMAIN,
      },
      user: {
        id: authRequest.mcpContext.userId,
        email: authRequest.mcpContext.userEmail,
        organizationId: authRequest.mcpContext.organizationId,
      },
    }, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  });
}

// Handle preflight OPTIONS requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
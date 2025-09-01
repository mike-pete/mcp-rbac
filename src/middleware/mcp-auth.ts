import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { McpServerContext } from "../mcp/streaming-server";
import { env } from "../env";

export interface AuthenticatedRequest extends NextRequest {
  mcpContext: McpServerContext;
}

const JWKS = createRemoteJWKSet(new URL(`${env.WORKOS_AUTHKIT_DOMAIN}/oauth2/jwks`));

function createWWWAuthenticateHeader(baseUrl: string): string {
  return [
    'Bearer error="unauthorized"',
    'error_description="Authorization needed"',
    `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
  ].join(', ');
}

async function validateMcpAuth(request: NextRequest): Promise<{
  isValid: boolean;
  context?: McpServerContext;
  error?: string;
}> {
  try {
    // First try to get Bearer token from Authorization header (MCP standard)
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.match(/^Bearer (.+)$/)?.[1];
    
    if (bearerToken) {
      // Verify JWT token with WorkOS JWKS
      const { payload } = await jwtVerify(bearerToken, JWKS, {
        issuer: env.WORKOS_AUTHKIT_DOMAIN,
      });

      const context: McpServerContext = {
        userId: payload.sub,
        userEmail: payload.email as string,
        organizationId: payload.organization_id as string,
      };

      return {
        isValid: true,
        context,
      };
    }

    // Fallback to WorkOS session auth (for browser clients)
    try {
      const { user } = await withAuth();
      
      if (!user) {
        return {
          isValid: false,
          error: "No authenticated user session found",
        };
      }

      const context: McpServerContext = {
        userId: user.id,
        userEmail: user.email,
        organizationId: (user as { organizationId?: string }).organizationId || undefined,
      };

      return {
        isValid: true,
        context,
      };
    } catch {
      // Session auth failed, require Bearer token
      return {
        isValid: false,
        error: "Bearer token required for MCP client authentication",
      };
    }
  } catch (error) {
    console.error("MCP authentication error:", error);
    return {
      isValid: false,
      error: "Authentication validation failed",
    };
  }
}

function createAuthErrorResponse(error: string, baseUrl: string, status: number = 401): NextResponse {
  return NextResponse.json(
    {
      error: "Authentication failed",
      message: error,
      timestamp: new Date().toISOString(),
    },
    { 
      status,
      headers: {
        "WWW-Authenticate": createWWWAuthenticateHeader(baseUrl),
        "Content-Type": "application/json",
      },
    }
  );
}

export async function withMcpAuth<T>(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<T>
): Promise<T | NextResponse> {
  const authResult = await validateMcpAuth(request);
  
  if (!authResult.isValid) {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    return createAuthErrorResponse(authResult.error || "Unauthorized", baseUrl);
  }

  // Extend request with MCP context
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.mcpContext = authResult.context!;

  return handler(authenticatedRequest);
}
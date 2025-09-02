import { withAuth } from '@workos-inc/authkit-nextjs'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { env } from '../env'
import { McpServerContext } from '../mcp/streaming-server'

export interface AuthenticatedRequest extends NextRequest {
	mcpContext: McpServerContext
}

const JWKS = createRemoteJWKSet(new URL(`${env.WORKOS_AUTHKIT_DOMAIN}/oauth2/jwks`))

type AuthResult = { isValid: boolean; context?: McpServerContext; error?: string }

interface UserContext {
	id?: string
	sub?: string
	email?: string
	organization_id?: string
	organizationId?: string
}

const createMcpContext = (user: UserContext): McpServerContext => ({
	userId: user.sub,
})

async function tryBearerAuth(token: string): Promise<AuthResult> {
	try {
		const { payload } = await jwtVerify(token, JWKS, { issuer: env.WORKOS_AUTHKIT_DOMAIN })
		return { isValid: true, context: createMcpContext(payload as UserContext) }
	} catch {
		return { isValid: false, error: 'Invalid bearer token' }
	}
}

async function trySessionAuth(): Promise<AuthResult> {
	try {
		const { user } = await withAuth()
		return user
			? { isValid: true, context: createMcpContext(user) }
			: { isValid: false, error: 'No authenticated user session found' }
	} catch {
		return { isValid: false, error: 'Bearer token required for MCP client authentication' }
	}
}

async function validateMcpAuth(request: NextRequest): Promise<AuthResult> {
	const bearerToken = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]

	if (bearerToken) {
		return tryBearerAuth(bearerToken)
	}

	return trySessionAuth()
}

const createAuthErrorResponse = (error: string, baseUrl: string, status = 401) =>
	NextResponse.json(
		{ error: 'Authentication failed', message: error, timestamp: new Date().toISOString() },
		{
			status,
			headers: {
				'WWW-Authenticate': [
					'Bearer error="unauthorized"',
					'error_description="Authorization needed"',
					`resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
				].join(', '),
				'Content-Type': 'application/json',
			},
		}
	)

export async function withMcpAuth<T>(
	request: NextRequest,
	handler: (request: AuthenticatedRequest) => Promise<T>
): Promise<T | NextResponse> {
	const authResult = await validateMcpAuth(request)

	if (!authResult.isValid) {
		const { protocol, host } = new URL(request.url)
		return createAuthErrorResponse(authResult.error || 'Unauthorized', `${protocol}//${host}`)
	}

	const authenticatedRequest = request as AuthenticatedRequest
	authenticatedRequest.mcpContext = authResult.context!
	return handler(authenticatedRequest)
}

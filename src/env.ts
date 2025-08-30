import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
	/*
	 * Serverside Environment variables, not available on the client.
	 * Will throw if you access these variables on the client.
	 */
	server: {
		WORKOS_CLIENT_ID: z.string().startsWith('client_'),
		WORKOS_API_KEY: z.string().startsWith('sk_test_'),
		WORKOS_COOKIE_PASSWORD: z.string(),
	},
	/*
	 * Environment variables available on the client (and server).
	 *
	 * 💡 You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
	 */
	client: {
		NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.url(),
	},
	runtimeEnv: {
		WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID,
		WORKOS_API_KEY: process.env.WORKOS_API_KEY,
		WORKOS_COOKIE_PASSWORD: process.env.WORKOS_COOKIE_PASSWORD,
		NEXT_PUBLIC_WORKOS_REDIRECT_URI: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
	},
})

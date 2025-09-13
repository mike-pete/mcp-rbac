import { ConvexHttpClient } from 'convex/browser'
import { env } from '@/env'
import { api } from '../../convex/_generated/api'

export const convexClient = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL)

export { api }
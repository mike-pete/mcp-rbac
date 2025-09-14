import { withAuth } from '@workos-inc/authkit-nextjs'
import { WorkOS } from '@workos-inc/node'
import { NextResponse } from 'next/server'
import { env } from '@/env'

const workos = new WorkOS(env.WORKOS_API_KEY)

export async function GET() {
	try {
		const { user } = await withAuth()
		
		if (!user) {
			return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
		}

		// Fetch the user's organization memberships
		const memberships = await workos.userManagement.listOrganizationMemberships({
			userId: user.id,
			statuses: ['active'] // Only get active memberships
		})

		// Fetch organization details for each membership
		const organizations = await Promise.all(
			memberships.data.map(async (membership) => {
				const organization = await workos.organizations.getOrganization(membership.organizationId)
				return {
					id: membership.organizationId,
					name: organization.name,
					membershipId: membership.id,
					role: membership.role?.slug,
					status: membership.status
				}
			})
		)

		return NextResponse.json({
			userId: user.id,
			organizations
		})
	} catch (error) {
		console.error('Failed to fetch user organizations:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch organizations' }, 
			{ status: 500 }
		)
	}
}
import { useState, useEffect } from 'react'

type UserOrganization = {
	id: string
	name: string
	membershipId: string
	role?: string
	status: string
}

type UserOrganizationsResponse = {
	userId: string
	organizations: UserOrganization[]
}

export function useUserOrganizations() {
	const [organizations, setOrganizations] = useState<UserOrganization[]>([])
	const [userId, setUserId] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		async function fetchOrganizations() {
			try {
				setLoading(true)
				const response = await fetch('/api/user/organizations')
				
				if (!response.ok) {
					if (response.status === 401) {
						// User not authenticated, this is expected
						setLoading(false)
						return
					}
					throw new Error('Failed to fetch organizations')
				}

				const data: UserOrganizationsResponse = await response.json()
				setUserId(data.userId)
				setOrganizations(data.organizations)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to fetch organizations')
			} finally {
				setLoading(false)
			}
		}

		fetchOrganizations()
	}, [])

	// Get the primary organization (first active one)
	const primaryOrganization = organizations.find(org => org.status === 'active')

	return {
		userId,
		organizations,
		primaryOrganization,
		loading,
		error
	}
}
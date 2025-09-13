'use client'

import { useUserOrganizations } from '@/hooks/useUserOrganizations'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import Col from '../../components/Col'
import Row from '../../components/Row'

export default function MarketPage() {
	// Get user and organization info from WorkOS
	const { userId, primaryOrganization, loading: orgLoading } = useUserOrganizations()

	// Fetch organization servers
	const organizationServers = useQuery(
		api.mcpServers.listOrganizationServers,
		primaryOrganization ? { organizationId: primaryOrganization.id } : 'skip'
	)

	return (
		<Col className='max-w-6xl mx-auto p-6 gap-6 bg-neutral-900 min-h-screen'>
			<div>
				<h1 className='text-3xl font-bold mb-2 text-white'>Organization MCP Servers</h1>
				<p className='text-neutral-400'>
					Discover and use MCP servers shared by members of your organization
				</p>
			</div>

			{/* Server Grid */}
			<div className='bg-neutral-800 rounded-lg shadow p-6'>
				<Row className='justify-between items-center mb-4'>
					<h2 className='text-xl font-semibold text-white'>
						Available Servers
						{organizationServers && (
							<span className='ml-2 text-xs bg-neutral-600 text-white px-2 py-1 rounded-full'>
								{organizationServers.length}
							</span>
						)}
					</h2>
				</Row>

				{orgLoading ? (
					<p className='text-neutral-400'>Loading user info...</p>
				) : !userId ? (
					<p className='text-neutral-400'>Please log in to see available servers</p>
				) : !primaryOrganization ? (
					<div className='text-center py-8'>
						<p className='text-neutral-400 mb-2'>
							You don&apos;t seem to be part of an organization yet
						</p>
						<p className='text-neutral-500 text-sm'>
							Organization membership is required to see shared MCP servers
						</p>
					</div>
				) : organizationServers === undefined ? (
					<p className='text-neutral-400'>Loading servers...</p>
				) : organizationServers.length === 0 ? (
					<div className='text-center py-8'>
						<p className='text-neutral-400 mb-2'>No servers shared in your organization yet</p>
						<p className='text-neutral-500 text-sm'>
							Encourage your team members to add their MCP servers from the{' '}
							<a href='/dashboard' className='text-red-300 hover:text-red-200 underline'>
								Dashboard
							</a>
							!
						</p>
					</div>
				) : (
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
						{organizationServers.map((server) => (
							<div
								key={server._id}
								className='p-4 border border-neutral-600 bg-neutral-700 rounded-lg hover:bg-neutral-650 transition-colors'
							>
								<Col className='gap-3'>
									<div className='font-medium text-white'>{server.serverName}</div>

									{server.description && (
										<p className='text-sm text-neutral-300 line-clamp-2'>{server.description}</p>
									)}

									<Row className='justify-between items-center text-xs text-neutral-500'>
										<span>Added: {new Date(server.createdAt).toLocaleDateString()}</span>
									</Row>
								</Col>
							</div>
						))}
					</div>
				)}
			</div>
		</Col>
	)
}

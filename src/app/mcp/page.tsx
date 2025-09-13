'use client'

import { useUserOrganizations } from '@/hooks/useUserOrganizations'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import Col from '../components/Col'
import Row from '../components/Row'

export default function DashboardPage() {
	const [serverName, setServerName] = useState('')
	const [serverUrl, setServerUrl] = useState('')
	const [description, setDescription] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Get user and organization info from WorkOS
	const { userId, primaryOrganization, loading: orgLoading } = useUserOrganizations()

	// Fetch organization servers
	const organizationServers = useQuery(
		api.mcpServers.listOrganizationServers,
		primaryOrganization ? { organizationId: primaryOrganization.id } : 'skip'
	)

	// Mutations
	const addServer = useMutation(api.mcpServers.addMcpServer)
	const deleteServer = useMutation(api.mcpServers.deleteMcpServer)

	const handleAddServer = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!userId) {
			setError('You must be logged in to add servers')
			return
		}

		if (!primaryOrganization?.id) {
			setError('You must be part of an organization to add servers')
			return
		}

		setIsLoading(true)
		setError(null)

		try {
			await addServer({
				userId,
				organizationId: primaryOrganization.id,
				serverName: serverName.trim(),
				serverUrl: serverUrl.trim(),
				description: description.trim() || undefined,
			})
			setServerName('')
			setServerUrl('')
			setDescription('')
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to add server')
		} finally {
			setIsLoading(false)
		}
	}

	const handleDeleteServer = async (id: string) => {
		try {
			await deleteServer({ id: id as Parameters<typeof deleteServer>[0]['id'] })
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete server')
		}
	}

	return (
		<Col className='p-6 gap-6 w-full flex-grow min-h-screen'>
			{/* Add Server Form */}
			<div className='bg-neutral-800 rounded-lg shadow p-6'>
				<h2 className='text-xl font-semibold mb-4 text-white'>Add New Server</h2>
				{!orgLoading && !primaryOrganization && (
					<div className='mb-4 p-3 bg-neutral-700 border border-neutral-600 rounded-md'>
						<p className='text-sm text-neutral-300'>
							You need to be part of a WorkOS organization to add servers. Contact your
							administrator to join an organization.
						</p>
					</div>
				)}
				<form onSubmit={handleAddServer}>
					<Col className='gap-4'>
						<div>
							<label
								htmlFor='serverName'
								className='block text-sm font-medium mb-1 text-neutral-300'
							>
								Server Name
							</label>
							<input
								id='serverName'
								type='text'
								value={serverName}
								onChange={(e) => setServerName(e.target.value)}
								placeholder='e.g., my-context-server'
								className='w-full px-3 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-300 placeholder-neutral-400'
								required
							/>
						</div>
						<div>
							<label
								htmlFor='serverUrl'
								className='block text-sm font-medium mb-1 text-neutral-300'
							>
								Server URL
							</label>
							<input
								id='serverUrl'
								type='url'
								value={serverUrl}
								onChange={(e) => setServerUrl(e.target.value)}
								placeholder='https://server.example.com/mcp'
								className='w-full px-3 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-300 placeholder-neutral-400'
								required
							/>
						</div>
						<div>
							<label
								htmlFor='description'
								className='block text-sm font-medium mb-1 text-neutral-300'
							>
								Description (optional)
							</label>
							<textarea
								id='description'
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder='Brief description of what this server provides...'
								className='w-full px-3 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-300 placeholder-neutral-400 resize-none'
								rows={2}
							/>
						</div>
						{error && <div className='text-red-300 text-sm'>{error}</div>}
						<button
							type='submit'
							disabled={isLoading || !userId || !primaryOrganization}
							className='px-4 py-2 bg-white text-black rounded-md hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium'
						>
							{isLoading ? 'Adding...' : 'Add Server'}
						</button>
					</Col>
				</form>
			</div>

			{/* Organization Servers Section */}
			<div className='bg-neutral-800 rounded-lg shadow p-6'>
				<Row className='justify-between items-center mb-4'>
					<h2 className='text-xl font-semibold text-white'>MCP Servers</h2>
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
							Encourage your team members to add their MCP servers!
						</p>
					</div>
				) : (
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
						{organizationServers.map((server) => {
							const isOwnedByUser = server.userId === userId
							return (
								<div
									key={server._id}
									className={`p-4 border bg-neutral-700 rounded-lg hover:bg-neutral-650 transition-colors ${
										isOwnedByUser
											? 'border-red-300 border-2 shadow-[0_0_0_2px_rgb(252_165_165)]'
											: 'border-neutral-600'
									}`}
								>
									<Row className='justify-between items-start mb-2'>
										<Col className='gap-3 flex-1'>
											<div className='font-medium text-white'>{server.serverName}</div>

											{server.description && (
												<p className='text-sm text-neutral-300 line-clamp-2'>
													{server.description}
												</p>
											)}

											<Row className='justify-between items-center text-xs text-neutral-500'>
												<span>Added: {new Date(server.createdAt).toLocaleDateString()}</span>
											</Row>
										</Col>
										{isOwnedByUser && (
											<button
												onClick={() => handleDeleteServer(server._id)}
												className='px-3 py-1 text-red-300 hover:bg-red-900/30 rounded-md ml-4'
											>
												Delete
											</button>
										)}
									</Row>
								</div>
							)
						})}
					</div>
				)}
			</div>
		</Col>
	)
}

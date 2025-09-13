'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useUserOrganizations } from '@/hooks/useUserOrganizations'
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

	// Fetch user's servers
	const servers = useQuery(
		api.mcpServers.listMcpServers,
		userId ? { userId } : 'skip'
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
		<Col className="max-w-4xl mx-auto p-6 gap-6 bg-neutral-900 min-h-screen">
			<div>
				<h1 className="text-3xl font-bold mb-2 text-white">MCP Server Management</h1>
				<p className="text-neutral-400">
					Add and manage your Model Context Protocol servers
				</p>
			</div>

			{/* Add Server Form */}
			<div className="bg-neutral-800 rounded-lg shadow p-6">
				<h2 className="text-xl font-semibold mb-4 text-white">Add New Server</h2>
				{!orgLoading && !primaryOrganization && (
					<div className="mb-4 p-3 bg-neutral-700 border border-neutral-600 rounded-md">
						<p className="text-sm text-neutral-300">
							You need to be part of a WorkOS organization to add servers. Contact your administrator to join an organization.
						</p>
					</div>
				)}
				<form onSubmit={handleAddServer}>
					<Col className="gap-4">
						<div>
							<label htmlFor="serverName" className="block text-sm font-medium mb-1 text-neutral-300">
								Server Name
							</label>
							<input
								id="serverName"
								type="text"
								value={serverName}
								onChange={(e) => setServerName(e.target.value)}
								placeholder="e.g., my-context-server"
								className="w-full px-3 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-300 placeholder-neutral-400"
								required
							/>
						</div>
						<div>
							<label htmlFor="serverUrl" className="block text-sm font-medium mb-1 text-neutral-300">
								Server URL
							</label>
							<input
								id="serverUrl"
								type="url"
								value={serverUrl}
								onChange={(e) => setServerUrl(e.target.value)}
								placeholder="https://server.example.com/mcp"
								className="w-full px-3 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-300 placeholder-neutral-400"
								required
							/>
						</div>
						<div>
							<label htmlFor="description" className="block text-sm font-medium mb-1 text-neutral-300">
								Description (optional)
							</label>
							<textarea
								id="description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Brief description of what this server provides..."
								className="w-full px-3 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-300 placeholder-neutral-400 resize-none"
								rows={2}
							/>
						</div>
						{error && (
							<div className="text-red-300 text-sm">{error}</div>
						)}
						<button
							type="submit"
							disabled={isLoading || !userId || !primaryOrganization}
							className="px-4 py-2 bg-white text-black rounded-md hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium"
						>
							{isLoading ? 'Adding...' : 'Add Server'}
						</button>
					</Col>
				</form>
			</div>

			{/* Server List */}
			<div className="bg-neutral-800 rounded-lg shadow p-6">
				<h2 className="text-xl font-semibold mb-4 text-white">Your Servers</h2>
				{orgLoading ? (
					<p className="text-neutral-400">Loading user info...</p>
				) : !userId ? (
					<p className="text-neutral-400">Please log in to see your servers</p>
				) : servers === undefined ? (
					<p className="text-neutral-400">Loading servers...</p>
				) : servers.length === 0 ? (
					<p className="text-neutral-400">No servers configured yet</p>
				) : (
					<Col className="gap-3">
						{servers.map((server) => (
							<div
								key={server._id}
								className="p-4 border border-neutral-600 bg-neutral-700 rounded-lg"
							>
								<Row className="justify-between items-start mb-2">
									<Col className="gap-1 flex-1">
										<div className="font-medium text-white">{server.serverName}</div>
										{server.description && (
											<div className="text-sm text-neutral-400">{server.description}</div>
										)}
										<div className="text-sm text-neutral-300">{server.serverUrl}</div>
										<div className="text-xs text-neutral-500">
											Added: {new Date(server.createdAt).toLocaleDateString()}
										</div>
									</Col>
									<button
										onClick={() => handleDeleteServer(server._id)}
										className="px-3 py-1 text-red-300 hover:bg-red-900/30 rounded-md ml-4"
									>
										Delete
									</button>
								</Row>
							</div>
						))}
					</Col>
				)}
			</div>

		</Col>
	)
}
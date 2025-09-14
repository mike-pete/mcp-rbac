'use client'

import { useUserOrganizations } from '@/hooks/useUserOrganizations'
import { useMutation, useQuery, useAction } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import Col from '../components/Col'
import Row from '../components/Row'
import { Switch } from '@base-ui-components/react/switch'
import { Dialog } from '@base-ui-components/react/dialog'
import { IconTrash, IconRefresh, IconTool, IconSettings } from '@tabler/icons-react'

export default function DashboardPage() {
	const [serverName, setServerName] = useState('')
	const [serverUrl, setServerUrl] = useState('')
	const [description, setDescription] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [refreshingTools, setRefreshingTools] = useState<string | null>(null)
	const [selectedServer, setSelectedServer] = useState<{
		_id: string
		serverName: string
		serverUrl: string
		description?: string
		tools?: Array<{ name: string; description?: string }>
		enabled: boolean
		userId: string
		createdAt: number
		lastToolsUpdate?: number
	} | null>(null)
	const [showAddServerDialog, setShowAddServerDialog] = useState(false)

	// Get user and organization info from WorkOS
	const { userId, primaryOrganization, loading: orgLoading } = useUserOrganizations()

	// Fetch organization servers
	const organizationServers = useQuery(
		api.mcpServers.listOrganizationServers,
		primaryOrganization ? { organizationId: primaryOrganization.id, userId: userId || undefined } : 'skip'
	)

	// Mutations and actions
	const addServer = useMutation(api.mcpServers.addMcpServer)
	const deleteServer = useMutation(api.mcpServers.deleteMcpServer)
	const toggleServer = useMutation(api.users.toggleServerEnabled)
	const fetchServerTools = useAction(api.mcpServers.fetchServerTools)
	const updateServerTools = useMutation(api.mcpServers.updateServerTools)

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
			const trimmedServerName = serverName.trim()
			const trimmedServerUrl = serverUrl.trim()
			
			// First fetch the tools
			const tools = await fetchServerTools({
				serverName: trimmedServerName,
				serverUrl: trimmedServerUrl,
			})

			// Then add the server with the tools
			await addServer({
				userId,
				organizationId: primaryOrganization.id,
				serverName: trimmedServerName,
				serverUrl: trimmedServerUrl,
				description: description.trim() || undefined,
				tools,
			})
			
			setServerName('')
			setServerUrl('')
			setDescription('')
			setShowAddServerDialog(false)
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

	const handleToggleServer = async (serverId: string, enabled: boolean) => {
		if (!userId) return
		
		try {
			await toggleServer({ 
				userId, 
				serverId: serverId as Parameters<typeof toggleServer>[0]['serverId'],
				enabled 
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to toggle server')
		}
	}

	const handleRefreshTools = async (serverId: string, serverName: string, serverUrl: string) => {
		setRefreshingTools(serverId)
		setError(null)
		
		try {
			const tools = await fetchServerTools({
				serverName,
				serverUrl,
			})
			
			await updateServerTools({
				id: serverId as Parameters<typeof updateServerTools>[0]['id'],
				tools,
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to refresh tools')
		} finally {
			setRefreshingTools(null)
		}
	}

	return (
		<Col className='p-6 gap-6 w-full flex-grow min-h-screen'>
			{/* Page Header */}
			<div className='flex justify-between items-center'>
				<h1 className='text-2xl font-bold text-white'>
					{primaryOrganization ? `${primaryOrganization.name} - MCP Servers` : 'MCP Servers'}
				</h1>
				<button
					onClick={() => setShowAddServerDialog(true)}
					disabled={!userId || !primaryOrganization}
					className='px-4 py-2 bg-white text-black rounded-md hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium'
				>
					Add New Server
				</button>
			</div>

			{/* Organization Servers Section */}
			<div className='bg-neutral-800 rounded-lg shadow p-6'>

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
									<Col className='gap-3'>
										<Row className='justify-between items-center'>
											<div className='font-medium text-white'>{server.serverName}</div>
											<Row className='items-center gap-2'>
												{isOwnedByUser && (
													<button
														onClick={() => setSelectedServer(server)}
														className='p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-600 rounded-md'
														title='Server settings'
													>
														<IconSettings size={16} />
													</button>
												)}
												<Switch.Root
													checked={server.enabled}
													onCheckedChange={(checked) => handleToggleServer(server._id, checked)}
													className="relative flex h-5 w-9 cursor-pointer rounded-full bg-neutral-900 p-px shadow-[inset_0_1.5px_2px] shadow-white/20 outline-1 -outline-offset-1 outline-white/30 transition-[background-color,box-shadow] duration-200 ease-out before:absolute before:rounded-full before:outline-offset-2 before:outline-red-300 focus-visible:before:inset-0 focus-visible:before:outline-2 active:bg-neutral-800 data-[checked]:bg-red-400 data-[checked]:shadow-white/30 data-[checked]:outline-white/40 data-[checked]:active:bg-red-300"
												>
													<Switch.Thumb className="aspect-square h-full rounded-full bg-white shadow-[0_0_1px_1px,0_1px_1px,1px_2px_4px_-1px] shadow-white/20 transition-transform duration-200 data-[checked]:translate-x-4 data-[checked]:shadow-white/30" />
												</Switch.Root>
											</Row>
										</Row>

										{server.description && (
											<p className='text-sm text-neutral-300 line-clamp-2'>
												{server.description}
											</p>
										)}

										{/* Tools pills */}
										{server.tools && server.tools.length > 0 ? (
											<div className='flex flex-wrap gap-1.5'>
												{server.tools.map((tool, index) => (
													<span 
														key={index} 
														className='px-2 py-0.5 bg-neutral-700 text-neutral-300 rounded text-xs font-mono border border-neutral-400'
													>
														{tool.name}
													</span>
												))}
											</div>
										) : (
											<Row className='items-center gap-2 text-xs text-neutral-400'>
												<IconTool size={14} />
												<span>No tools loaded</span>
											</Row>
										)}
									</Col>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* Add Server Dialog */}
			<Dialog.Root open={showAddServerDialog} onOpenChange={setShowAddServerDialog}>
				<Dialog.Portal>
					<Dialog.Backdrop className="fixed inset-0 bg-black opacity-70 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
					<Dialog.Popup className="fixed top-1/2 left-1/2 -mt-8 w-[500px] max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-neutral-800 p-6 text-white outline-1 outline-neutral-600 transition-all duration-150 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
						<Dialog.Title className="-mt-1.5 mb-4 text-xl font-semibold">
							Add New Server
						</Dialog.Title>

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
								
								<Row className="justify-end gap-3 pt-2">
									<Dialog.Close className="px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-600 font-medium">
										Cancel
									</Dialog.Close>
									<button
										type='submit'
										disabled={isLoading || !userId || !primaryOrganization}
										className='px-4 py-2 bg-white text-black rounded-md hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium'
									>
										{isLoading ? 'Adding...' : 'Add Server'}
									</button>
								</Row>
							</Col>
						</form>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>

			{/* Settings Dialog */}
			<Dialog.Root open={!!selectedServer} onOpenChange={(open) => !open && setSelectedServer(null)}>
				<Dialog.Portal>
					<Dialog.Backdrop className="fixed inset-0 bg-black opacity-70 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
					<Dialog.Popup className="fixed top-1/2 left-1/2 -mt-8 w-[600px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-6rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-neutral-800 p-6 text-white outline-1 outline-neutral-600 transition-all duration-150 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 overflow-y-auto">
						{selectedServer && (
							<>
								<Dialog.Title className="-mt-1.5 mb-4 text-xl font-semibold">
									Server Settings
								</Dialog.Title>
								
								<Col className="gap-6">
									{/* Server Details */}
									<div>
										<h3 className="text-sm font-medium text-neutral-400 mb-2">Server Name</h3>
										<p className="text-white">{selectedServer.serverName}</p>
									</div>

									{selectedServer.description && (
										<div>
											<h3 className="text-sm font-medium text-neutral-400 mb-2">Description</h3>
											<p className="text-neutral-300">{selectedServer.description}</p>
										</div>
									)}

									{/* Tools Section */}
									<div>
										<Row className="justify-between items-center mb-2">
											<h3 className="text-sm font-medium text-neutral-400">
												Tools ({selectedServer.tools ? selectedServer.tools.length : 0})
											</h3>
											{selectedServer.userId === userId && (
												<button
													onClick={() => {
														handleRefreshTools(selectedServer._id, selectedServer.serverName, selectedServer.serverUrl)
													}}
													disabled={refreshingTools === selectedServer._id}
													className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-600 rounded-md disabled:opacity-50"
													title="Refresh tools"
												>
													<IconRefresh 
														size={16} 
														className={refreshingTools === selectedServer._id ? 'animate-spin' : ''} 
													/>
												</button>
											)}
										</Row>
										{selectedServer.tools && selectedServer.tools.length > 0 ? (
											<div className="bg-neutral-900 rounded-md p-4 max-h-64 overflow-y-auto">
												<div className="space-y-3">
													{selectedServer.tools.map((tool, index) => (
														<div key={index} className="border-b border-neutral-700 pb-3 last:border-0">
															<div className="font-mono text-sm text-white">{tool.name}</div>
															{tool.description && (
																<div className="text-xs text-neutral-400 mt-1 leading-relaxed">
																	{tool.description}
																</div>
															)}
														</div>
													))}
												</div>
											</div>
										) : (
											<p className="text-neutral-500 text-sm">No tools loaded</p>
										)}
									</div>

									{/* Metadata */}
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<h3 className="text-neutral-400 mb-1">Created</h3>
											<p className="text-neutral-300">
												{new Date(selectedServer.createdAt).toLocaleDateString()} at{' '}
												{new Date(selectedServer.createdAt).toLocaleTimeString()}
											</p>
										</div>
										{selectedServer.lastToolsUpdate && (
											<div>
												<h3 className="text-neutral-400 mb-1">Last Tools Update</h3>
												<p className="text-neutral-300">
													{new Date(selectedServer.lastToolsUpdate).toLocaleDateString()} at{' '}
													{new Date(selectedServer.lastToolsUpdate).toLocaleTimeString()}
												</p>
											</div>
										)}
									</div>

									{/* Actions */}
									<div className="border-t border-neutral-700 pt-4">
										<Row className="justify-between items-center">
											{/* Only show delete if user owns the server */}
											{selectedServer.userId === userId && (
												<button
													onClick={() => {
														handleDeleteServer(selectedServer._id)
														setSelectedServer(null)
													}}
													className="px-3 py-1.5 bg-red-900/30 text-red-400 rounded-md hover:bg-red-900/50 text-sm font-medium flex items-center gap-2"
												>
													<IconTrash size={16} />
													Delete Server
												</button>
											)}

											<Dialog.Close className="px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-600 font-medium text-sm">
												Close
											</Dialog.Close>
										</Row>
									</div>
								</Col>
							</>
						)}
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>
		</Col>
	)
}

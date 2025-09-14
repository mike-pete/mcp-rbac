'use client'

import { useUserOrganizations } from '@/hooks/useUserOrganizations'
import { useMutation, useQuery, useAction } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import Col from '../components/Col'
import Row from '../components/Row'
import { Switch } from '@base-ui-components/react/switch'
import { Dialog } from '@base-ui-components/react/dialog'
import { Tooltip } from '@base-ui-components/react/tooltip'
import { IconTrash, IconRefresh, IconTool, IconSettings, IconCopy } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import Editor from '@monaco-editor/react'
import { env } from '@/env'

dayjs.extend(relativeTime)

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
		tools?: Array<{ name: string; description?: string; enabled: boolean }>
		enabled: boolean
		userId: string
		createdAt: number
		lastToolsUpdate?: number
	} | null>(null)
	const [showAddServerDialog, setShowAddServerDialog] = useState(false)
	const [showConnectDialog, setShowConnectDialog] = useState(false)
	const [copySuccess, setCopySuccess] = useState(false)

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
	const toggleToolEnabled = useMutation(api.mcpServers.toggleToolEnabled)

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

	const handleToggleToolEnabled = async (serverId: string, toolName: string, enabled: boolean) => {
		try {
			await toggleToolEnabled({
				serverId: serverId as Parameters<typeof toggleToolEnabled>[0]['serverId'],
				toolName,
				enabled
			})
			
			// Update the selected server state to reflect the change
			if (selectedServer && selectedServer._id === serverId) {
				setSelectedServer({
					...selectedServer,
					tools: selectedServer.tools?.map(tool => 
						tool.name === toolName ? { ...tool, enabled } : tool
					)
				})
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to toggle tool')
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

	const handleCopyConfig = async () => {
		if (!primaryOrganization) return
		
		const config = {
			mcpServers: {
				[`${primaryOrganization.name} MCP`]: {
					url: `${env.NEXT_PUBLIC_APP_URL}/api/mcp`
				}
			}
		}
		
		try {
			await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
			setCopySuccess(true)
			setTimeout(() => setCopySuccess(false), 2000)
		} catch (err) {
			console.error('Failed to copy config:', err)
		}
	}

	return (
		<Col className='p-6 gap-6 w-full flex-grow min-h-screen'>
			{/* Page Header */}
			<div className='flex justify-between items-center'>
				<h1 className='text-2xl font-bold text-white'>
					{primaryOrganization ? `${primaryOrganization.name} - MCP Servers` : 'MCP Servers'}
				</h1>
				<Row className='gap-3'>
					<button
						onClick={() => setShowConnectDialog(true)}
						disabled={!userId || !primaryOrganization}
						className='px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-600 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium border border-neutral-600'
					>
						Connect
					</button>
					<button
						onClick={() => setShowAddServerDialog(true)}
						disabled={!userId || !primaryOrganization}
						className='px-4 py-2 bg-white text-black rounded-md hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium'
					>
						Add MCP
					</button>
				</Row>
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
					<Tooltip.Provider>
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
												<Tooltip.Root>
													<Tooltip.Trigger className="inline-flex items-center">
														<Switch.Root
															checked={server.enabled}
															onCheckedChange={(checked) => handleToggleServer(server._id, checked)}
															className="relative flex h-5 w-9 cursor-pointer rounded-full bg-neutral-900 p-px shadow-[inset_0_1.5px_2px] shadow-white/20 outline-1 -outline-offset-1 outline-white/30 transition-[background-color,box-shadow] duration-200 ease-out before:absolute before:rounded-full before:outline-offset-2 before:outline-red-300 focus-visible:before:inset-0 focus-visible:before:outline-2 active:bg-neutral-800 data-[checked]:bg-red-400 data-[checked]:shadow-white/30 data-[checked]:outline-white/40 data-[checked]:active:bg-red-300"
														>
															<Switch.Thumb className="aspect-square h-full rounded-full bg-white shadow-[0_0_1px_1px,0_1px_1px,1px_2px_4px_-1px] shadow-white/20 transition-transform duration-200 data-[checked]:translate-x-4 data-[checked]:shadow-white/30" />
														</Switch.Root>
													</Tooltip.Trigger>
													<Tooltip.Portal>
														<Tooltip.Positioner sideOffset={10}>
															<Tooltip.Popup className="flex origin-[var(--transform-origin)] flex-col rounded-md bg-neutral-900 px-2 py-1 text-sm text-white shadow-lg shadow-black/50 outline-1 outline-neutral-600 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[instant]:duration-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 z-50">
																<Tooltip.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
																	<svg width="20" height="10" viewBox="0 0 20 10" fill="none">
																		<path
																			d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
																			className="fill-neutral-900"
																		/>
																		<path
																			d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
																			className="fill-neutral-600"
																		/>
																		<path
																			d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
																			className="fill-neutral-600"
																		/>
																	</svg>
																</Tooltip.Arrow>
																{server.enabled ? 'Disable this MCP for your account' : 'Enable this MCP for your account'}
															</Tooltip.Popup>
														</Tooltip.Positioner>
													</Tooltip.Portal>
												</Tooltip.Root>
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
												{server.tools.map((tool, index) => {
													const isEnabled = tool.enabled
													return (
														<span 
															key={index} 
															className={`px-2 py-0.5 rounded text-xs font-mono border ${
																isEnabled 
																	? 'bg-neutral-700 text-neutral-300 border-neutral-400' 
																	: 'bg-neutral-800 text-neutral-500 border-neutral-600 opacity-60'
															}`}
														>
															{tool.name}
														</span>
													)
												})}
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
					</Tooltip.Provider>
				)}
			</div>

			{/* Add Server Dialog */}
			<Dialog.Root open={showAddServerDialog} onOpenChange={setShowAddServerDialog}>
				<Dialog.Portal>
					<Dialog.Backdrop className="fixed inset-0 bg-black opacity-70 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
					<Dialog.Popup className="fixed top-1/2 left-1/2 -mt-8 w-[500px] max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-neutral-800 p-6 text-white outline-1 outline-neutral-600 transition-all duration-150 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
						<Dialog.Title className="-mt-1.5 mb-4 text-xl font-semibold">
							Add MCP
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
												<Row className="items-center gap-2">
													{selectedServer.lastToolsUpdate && (
														<span className="text-xs text-neutral-500">
															Updated {dayjs(selectedServer.lastToolsUpdate).fromNow()}
														</span>
													)}
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
												</Row>
											)}
										</Row>
										{selectedServer.tools && selectedServer.tools.length > 0 ? (
											<div className="border border-neutral-600 rounded-lg p-4 max-h-64 overflow-y-auto">
												<div className="flex flex-col gap-3">
													{selectedServer.tools.map((tool, index) => (
														<div key={index} className="bg-neutral-700 rounded-lg border border-neutral-600 p-3 hover:border-neutral-500 transition-colors">
															<Row className="justify-between items-start gap-3">
																<Col className="flex-1 min-w-0">
																	<div className="font-mono text-sm text-white truncate">{tool.name}</div>
																	{tool.description && (
																		<div className="text-xs text-neutral-400 mt-1 leading-relaxed">
																			{tool.description}
																		</div>
																	)}
																</Col>
																{selectedServer.userId === userId && (
																	<Tooltip.Root>
																		<Tooltip.Trigger className="inline-flex items-center">
																			<Switch.Root
																				checked={tool.enabled}
																				onCheckedChange={(checked) => {
																					handleToggleToolEnabled(selectedServer._id, tool.name, checked)
																				}}
																				className="relative flex h-4 w-7 cursor-pointer rounded-full bg-neutral-900 p-px shadow-[inset_0_1.5px_2px] shadow-white/20 outline-1 -outline-offset-1 outline-white/30 transition-[background-color,box-shadow] duration-200 ease-out before:absolute before:rounded-full before:outline-offset-2 before:outline-red-300 focus-visible:before:inset-0 focus-visible:before:outline-2 active:bg-neutral-800 data-[checked]:bg-red-400 data-[checked]:shadow-white/30 data-[checked]:outline-white/40 data-[checked]:active:bg-red-300"
																			>
																				<Switch.Thumb className="aspect-square h-full rounded-full bg-white shadow-[0_0_1px_1px,0_1px_1px,1px_2px_4px_-1px] shadow-white/20 transition-transform duration-200 data-[checked]:translate-x-3 data-[checked]:shadow-white/30" />
																			</Switch.Root>
																		</Tooltip.Trigger>
																		<Tooltip.Portal>
																			<Tooltip.Positioner sideOffset={10}>
																				<Tooltip.Popup className="flex origin-[var(--transform-origin)] flex-col rounded-md bg-neutral-900 px-2 py-1 text-sm text-white shadow-lg shadow-black/50 outline-1 outline-neutral-600 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[instant]:duration-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 z-50">
																					<Tooltip.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
																						<svg width="20" height="10" viewBox="0 0 20 10" fill="none">
																							<path
																								d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
																								className="fill-neutral-900"
																							/>
																							<path
																								d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
																								className="fill-neutral-600"
																							/>
																							<path
																								d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
																								className="fill-neutral-600"
																							/>
																						</svg>
																					</Tooltip.Arrow>
																					{tool.enabled ? 'Disable this tool for everyone' : 'Enable this tool for everyone'}
																				</Tooltip.Popup>
																			</Tooltip.Positioner>
																		</Tooltip.Portal>
																	</Tooltip.Root>
																)}
															</Row>
														</div>
													))}
												</div>
											</div>
										) : (
											<p className="text-neutral-500 text-sm">No tools loaded</p>
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

			{/* Connect Dialog */}
			<Dialog.Root open={showConnectDialog} onOpenChange={setShowConnectDialog}>
				<Dialog.Portal>
					<Dialog.Backdrop className="fixed inset-0 bg-black opacity-70 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
					<Dialog.Popup className="fixed top-1/2 left-1/2 -mt-8 w-[600px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-6rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-neutral-800 p-6 text-white outline-1 outline-neutral-600 transition-all duration-150 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 overflow-y-auto">
						<Dialog.Title className="-mt-1.5 mb-4 text-xl font-semibold">
							Connect to {primaryOrganization?.name} MCP
						</Dialog.Title>
						
						<Col className="gap-6">
							<div>
								<p className="text-neutral-300 mb-4">
									To connect to your organization&apos;s MCP servers from Cursor, add this configuration to your MCP settings:
								</p>
								
								<div className="space-y-2">
									<h3 className="text-sm font-medium text-neutral-400">Cursor</h3>
									<p className="text-sm text-neutral-500">
										Go to Cursor Settings → Features → Model Context Protocol → Edit config
									</p>
								</div>
								
							</div>

							{primaryOrganization && (
								<div>
									<Row className="justify-between items-center mb-2">
										<h3 className="text-sm font-medium text-neutral-400">Configuration JSON</h3>
										<button
											onClick={handleCopyConfig}
											className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
												copySuccess 
													? 'bg-green-900/30 text-green-400 border border-green-600' 
													: 'bg-neutral-700 text-white hover:bg-neutral-600 border border-neutral-600'
											}`}
										>
											<IconCopy size={16} />
											{copySuccess ? 'Copied!' : 'Copy Config'}
										</button>
									</Row>
									
									<div className="border border-neutral-600 rounded-lg overflow-hidden">
										<Editor
											height="175px"
											defaultLanguage="json"
											value={JSON.stringify({
												mcpServers: {
													[`${primaryOrganization.name} MCP`]: {
														url: `${env.NEXT_PUBLIC_APP_URL}/api/mcp`
													}
												}
											}, null, 2)}
											theme="vs-dark"
											options={{
												readOnly: true,
												minimap: { enabled: false },
												scrollBeyondLastLine: false,
												fontSize: 14,
												lineNumbers: 'off',
												glyphMargin: false,
												folding: false,
												lineDecorationsWidth: 0,
												lineNumbersMinChars: 0,
												renderLineHighlight: 'none',
												padding: { top: 16, bottom: 16 },
												overviewRulerLanes: 0,
												hideCursorInOverviewRuler: true,
												overviewRulerBorder: false,
												scrollbar: {
													vertical: 'hidden',
													horizontal: 'hidden'
												},
												wordWrap: 'off',
												automaticLayout: true
											}}
										/>
									</div>
								</div>
							)}

							<div className="border-t border-neutral-700 pt-4">
								<Row className="justify-end">
									<Dialog.Close className="px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-600 font-medium text-sm">
										Close
									</Dialog.Close>
								</Row>
							</div>
						</Col>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>
		</Col>
	)
}

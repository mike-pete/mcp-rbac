import { env } from '@/env'
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
})

export const metadata: Metadata = {
	title: 'MCP Gateway',
	description: 'Model Context Protocol Gateway with RBAC',
}

if (!env) {
	throw new Error('Something is broken with your env variables')
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang='en'>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<AuthKitProvider>
					<Providers>
						<div className='root'>{children}</div>
					</Providers>
				</AuthKitProvider>
			</body>
		</html>
	)
}

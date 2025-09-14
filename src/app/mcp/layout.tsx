import { signOut, withAuth } from '@workos-inc/authkit-nextjs'
import UserAvatar from '../components/Avatar'
import Col from '../components/Col'
import Row from '../components/Row'
import ChampionCrown from '../components/ChampionCrown'

export default async function ProtectedPage({ children }: { children: React.ReactNode }) {
	return (
		<div className='min-h-screen w-screen'>
			<Header />
			{children}
		</div>
	)
}

async function Header() {
	const { user } = await withAuth({ ensureSignedIn: true })
	const name = [(user?.firstName ?? ''), (user?.lastName ?? '')].filter(Boolean).join(' ')

	return (
		<header className='bg-neutral-950 border-neutral-800 border-b-2 sticky top-0 z-50 px-6 py-4'>
			<Row className='justify-end items-center'>
				{/* User info */}
				<Row className='gap-3 items-center'>
					<Col className='gap-0.5 items-end'>
						{name && (
							<Row className='gap-1.5 items-center'>
								<p className='text-base font-bold text-white'>{name}</p>
								{user?.id && <ChampionCrown userId={user.id} />}
							</Row>
						)}
						<form
							className='contents'
							action={async () => {
								'use server'
								await signOut()
							}}
						>
							<button type='submit' className='text-red-300 text-sm hover:text-red-200 transition-colors'>
								Sign out
							</button>
						</form>
					</Col>
					<UserAvatar />
				</Row>
			</Row>
		</header>
	)
}
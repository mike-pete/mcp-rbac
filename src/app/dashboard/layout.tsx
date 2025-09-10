import { signOut, withAuth } from '@workos-inc/authkit-nextjs'
import UserAvatar from '../components/Avatar'
import Col from '../components/Col'
import Row from '../components/Row'

export default async function ProtectedPage({ children }: { children: React.ReactNode }) {
	return (
		<div className='flex flex-row min-h-screen w-screen'>
			<Sidebar />
			{children}
		</div>
	)
}

async function Sidebar() {
	const { user } = await withAuth({ ensureSignedIn: true })
	const name = (user?.firstName ?? '') + (user?.lastName ?? '')

	return (
		<Col className='w-64 bg-neutral-950 h-screen border-neutral-800 border-r-2 sticky top-0 p-2.5'>
			<Row className='gap-2.5'>
				<UserAvatar />
				<Col className='gap-0.5 items-start'>
					{name && <p className='text-base font-bold'>{name}</p>}
					<form
						className='contents'
						action={async () => {
							'use server'
							await signOut()
						}}
					>
						<button type='submit' className='text-red-300 text-sm'>
							Sign out
						</button>
					</form>
				</Col>
			</Row>
		</Col>
	)
}

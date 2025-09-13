import { getSignUpUrl, withAuth } from '@workos-inc/authkit-nextjs'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function HomePage() {
	// Retrieves the user from the session or returns `null` if no user is signed in
	const { user } = await withAuth()

	// Get the URL to redirect the user to AuthKit to sign up
	const signUpUrl = await getSignUpUrl()

	if (!user) {
		return (
			<div className='flex items-center justify-center h-screen'>
				<div className='flex flex-row items-center justify-center font-black text-xl rounded-full'>
					<a
						href='/login'
						className='pr-2 bg-red-300 flex justify-end items-center w-[100px] h-[200px] rounded-l-full hover:bg-red-400 transition-colors duration-150'
					>
						ENTER
					</a>
					<div className='absolute w-[40px] rotate-90'>
						<hr className='border-0.5' />
					</div>
					<Link
						href={signUpUrl}
						className='pl-2 bg-red-300 flex justify-start items-center w-[100px] h-[200px] rounded-r-full hover:bg-red-400 transition-colors duration-150'
					>
						JOIN
					</Link>
				</div>
			</div>
		)
	}

	return redirect('/mcp')
}

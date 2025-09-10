import { Avatar } from '@base-ui-components/react/avatar'
import { withAuth } from '@workos-inc/authkit-nextjs'

export default async function UserAvatar() {
	const { user } = await withAuth({ ensureSignedIn: true })
	const initials = (user?.firstName?.charAt(0) ?? '') + (user?.lastName?.charAt(0) ?? '')
	const profilePictureUrl = user?.profilePictureUrl

	return (
		<Avatar.Root className='inline-flex size-12 items-center justify-center overflow-hidden rounded-md select-none text-red-950 bg-red-300'>
			{profilePictureUrl ? (
				<Avatar.Image
					src={profilePictureUrl}
					width='48'
					height='48'
					className='size-full object-cover'
				/>
			) : (
				initials
			)}
		</Avatar.Root>
	)
}

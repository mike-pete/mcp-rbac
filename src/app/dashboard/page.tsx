import { withAuth } from '@workos-inc/authkit-nextjs';

export default async function ProtectedPage() {
  // If the user isn't signed in, they will be automatically redirected to AuthKit
  const { user } = await withAuth({ ensureSignedIn: true });

  return (
    <>
      <p>Welcome back{user.firstName && `, ${user.firstName}`}</p>
    </>
  );
}

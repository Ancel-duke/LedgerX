import { cookies } from 'next/headers';

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;

  if (!token) {
    return null;
  }

  try {
    // Decode JWT token to get user info
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return {
      user: {
        id: payload.sub,
        email: payload.email,
        firstName: '',
        lastName: '',
        role: payload.role,
        organizationId: payload.organizationId,
      },
      token,
    };
  } catch {
    return null;
  }
}

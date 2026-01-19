import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-server-session';

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    redirect('/dashboard');
  }

  redirect('/auth/login');
}

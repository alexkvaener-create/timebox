import { redirect } from 'next/navigation';

/** Root redirect: send unauthenticated users to dashboard (auth stub for MVP). */
export default function RootPage() {
  redirect('/dashboard');
}

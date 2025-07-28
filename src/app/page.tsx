import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to dashboard for AP Tool V1
  redirect('/dashboard');
}

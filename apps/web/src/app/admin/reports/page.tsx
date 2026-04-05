import { redirect } from 'next/navigation';

export default function LegacyAdminReportsRedirectPage() {
  redirect('/admin/payments');
}

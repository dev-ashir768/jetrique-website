import { redirect } from 'next/navigation';

// Old single-slot booking flow — deprecated in favour of the new /book flow with Stripe payment.
export default function OldSlotPage() {
  redirect('/book');
}

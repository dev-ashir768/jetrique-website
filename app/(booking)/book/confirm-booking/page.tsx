import { redirect } from 'next/navigation';

// This old confirm-booking flow has been deprecated.
// It bypassed Stripe payment — redirect all traffic to the new booking flow.
export default function ConfirmBookingPage() {
  redirect('/book');
}

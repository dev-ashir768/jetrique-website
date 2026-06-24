"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { publicApi } from '@/lib/api';
import { useCustomerAuth } from '@/lib/customerStore';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

function ConfirmPageInner() {
  const params   = useSearchParams();
  const router   = useRouter();
  const slotId   = params.get('slotId') ?? '';
  const { token, isLoggedIn, customer } = useCustomerAuth();

  const [intent, setIntent] = useState<{
    slotId: string;
    form: {
      leadEmail: string;
      leadPhone: string;
      passengers: Array<{
        firstName: string; lastName: string; cnicOrPassport: string;
        dateOfBirth: string; nationality: string; isLeadPassenger: boolean;
      }>;
    };
  } | null>(null);

  const [confirmed, setConfirmed] = useState<{ pnr: string } | null>(null);

  useEffect(() => {
    if (!isLoggedIn) { router.replace('/book'); return; }
    const raw = sessionStorage.getItem('jq_booking_intent');
    if (raw) {
      const parsed = JSON.parse(raw);
      setTimeout(() => setIntent(parsed), 0);
    }
  }, [isLoggedIn, router]);

  const { data: slot } = useQuery({
    queryKey: ['slot-detail', slotId],
    queryFn:  () => publicApi.getSlotDetail(slotId),
    enabled:  !!slotId,
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!intent || !token) throw new Error('Missing booking data');
      const res = await fetch(`${BASE}/public/bookings`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          slotId:     intent.slotId,
          passengers: intent.form.passengers,
          phone:      intent.form.leadPhone,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Booking failed');
      return json.data as { pnr: string };
    },
    onSuccess: (data) => {
      sessionStorage.removeItem('jq_booking_intent');
      setConfirmed(data);
    },
  });

  if (confirmed) {
    return (
      <section className="w-full py-16 px-4">
        <div className="container max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-[#8cc63f]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-[#8cc63f] text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-medium text-neutral-800 mb-2">Booking Confirmed!</h1>
          <p className="text-neutral-500 text-sm mb-6">Your booking has been received and is pending confirmation.</p>
          <div className="bg-[#8cc63f]/5 border border-[#8cc63f]/20 rounded-[10px] p-6 mb-6">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Your PNR</p>
            <p className="text-3xl font-mono font-bold text-neutral-800 tracking-widest">{confirmed.pnr}</p>
            <p className="text-xs text-neutral-400 mt-2">Save this reference number for tracking</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/track?pnr=${confirmed.pnr}`)}
              className="border border-neutral-200 text-neutral-600 px-5 py-2.5 rounded-[8px] text-sm hover:bg-neutral-50"
            >
              Track Booking
            </button>
            <button
              onClick={() => router.push('/my-account')}
              className="bg-[#8cc63f] text-white px-5 py-2.5 rounded-[8px] text-sm hover:bg-[#7ab535]"
            >
              My Bookings
            </button>
          </div>
        </div>
      </section>
    );
  }

  const dep     = slot ? new Date(slot.scheduledDeparture) : null;
  const depStr  = dep?.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? '';
  const paxCount = intent?.form.passengers.length ?? 0;

  return (
    <section className="w-full py-12 px-4">
      <div className="container max-w-md mx-auto">
        <h1 className="text-xl font-medium text-neutral-800 mb-6">Confirm Booking</h1>

        {slot && intent && (
          <div className="bg-white rounded-[10px] border border-neutral-100 p-6 mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Flight</span>
              <span className="text-neutral-700 font-medium">{slot.origin} → {slot.destination}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Departure</span>
              <span className="text-neutral-700">{depStr}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Passengers</span>
              <span className="text-neutral-700">{paxCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Booked as</span>
              <span className="text-neutral-700">{customer?.name} ({customer?.email})</span>
            </div>
            {slot.product && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Product</span>
                <span className="text-[#8cc63f]">{slot.product.name}</span>
              </div>
            )}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-100 rounded-[8px] p-4 mb-6">
          <p className="text-xs text-amber-700">
            <strong>Note:</strong> This is a booking request. Our team will contact you to confirm pricing and arrange payment.
          </p>
        </div>

        {confirmMut.isError && (
          <div className="bg-red-50 text-red-600 text-xs rounded-[6px] p-3 mb-4">
            {(confirmMut.error as Error).message}
          </div>
        )}

        <button
          onClick={() => confirmMut.mutate()}
          disabled={!intent || confirmMut.isPending}
          className="w-full bg-[#8cc63f] text-white py-3 rounded-[10px] font-medium hover:bg-[#7ab535] transition-colors disabled:opacity-50"
        >
          {confirmMut.isPending ? 'Confirming...' : 'Confirm Booking'}
        </button>
      </div>
    </section>
  );
}

export default function ConfirmBookingPage() {
  return <Suspense><ConfirmPageInner /></Suspense>;
}

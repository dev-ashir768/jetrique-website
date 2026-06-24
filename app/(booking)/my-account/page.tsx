"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { customerApi, type CustomerBooking } from '@/lib/api';
import { useCustomerAuth } from '@/lib/customerStore';

export default function MyAccountPage() {
  const router = useRouter();
  const { isLoggedIn, token, customer, logout } = useCustomerAuth();

  useEffect(() => {
    if (!isLoggedIn) router.replace('/book');
  }, [isLoggedIn, router]);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['customer-bookings', token],
    queryFn:  () => customerApi.getBookings(token!),
    enabled:  !!token,
  });

  const statusColor: Record<string, string> = {
    CONFIRMED:       'text-green-600 bg-green-50',
    PENDING_PAYMENT: 'text-amber-600 bg-amber-50',
    CANCELLED:       'text-red-500 bg-red-50',
    COMPLETED:       'text-blue-600 bg-blue-50',
    NO_SHOW:         'text-neutral-400 bg-neutral-50',
  };

  if (!isLoggedIn) return null;

  return (
    <section className="w-full py-12 px-4">
      <div className="container max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium text-neutral-800">My Account</h1>
            <div className="w-16 h-[2px] bg-[#8cc63f] mt-2" />
          </div>
          <button
            onClick={() => { logout(); router.push('/'); }}
            className="text-xs text-neutral-400 hover:text-neutral-600 border border-neutral-200 px-3 py-1.5 rounded-[6px]"
          >
            Sign Out
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-[10px] border border-neutral-100 p-5 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-[#8cc63f]/10 rounded-full flex items-center justify-center">
            <span className="text-[#8cc63f] font-medium text-lg">
              {customer?.name?.charAt(0).toUpperCase() ?? '?'}
            </span>
          </div>
          <div>
            <p className="font-medium text-neutral-800">{customer?.name}</p>
            <p className="text-xs text-neutral-400">{customer?.email}</p>
          </div>
        </div>

        {/* Bookings */}
        <div>
          <h2 className="text-base font-medium text-neutral-700 mb-4">My Bookings</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2].map((i) => <div key={i} className="h-20 bg-white rounded-[10px] animate-pulse border border-neutral-100" />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-[10px] border border-neutral-100 p-10 text-center">
              <p className="text-neutral-400 text-sm">No bookings yet.</p>
              <button onClick={() => router.push('/book')} className="mt-3 text-[#8cc63f] text-sm hover:underline">
                Book a flight
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => <BookingRow key={b.pnr} booking={b} statusColor={statusColor} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BookingRow({ booking: b, statusColor }: { booking: CustomerBooking; statusColor: Record<string, string> }) {
  const dep = new Date(b.departure);
  const depStr = dep.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white rounded-[10px] border border-neutral-100 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-bold text-neutral-800 tracking-wider">{b.pnr}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[b.status] ?? 'text-neutral-400 bg-neutral-50'}`}>
            {b.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-neutral-500">{b.product} · {depStr} · {b.totalPassengers} pax</p>
      </div>
      {b.totalAmountUsd > 0 && (
        <p className="text-sm font-medium text-neutral-700">${b.totalAmountUsd.toFixed(2)}</p>
      )}
    </div>
  );
}

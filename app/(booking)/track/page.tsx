"use client";

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { publicApi, type TrackResult } from '@/lib/api';

function TrackPageInner() {
  const params = useSearchParams();
  const [pnr,   setPnr]   = useState(params.get('pnr') ?? '');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<TrackResult | null>(null);

  const trackMut = useMutation({
    mutationFn: () => publicApi.trackBooking(pnr.trim().toUpperCase(), email.trim() || undefined),
    onSuccess:  (data) => setResult(data),
  });

  const statusColor: Record<string, string> = {
    CONFIRMED:       'text-green-600 bg-green-50',
    PENDING_PAYMENT: 'text-amber-600 bg-amber-50',
    CANCELLED:       'text-red-500 bg-red-50',
    COMPLETED:       'text-blue-600 bg-blue-50',
    NO_SHOW:         'text-neutral-500 bg-neutral-50',
  };

  return (
    <section className="w-full py-12 px-4">
      <div className="container max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-medium text-neutral-800">Track Your Booking</h1>
          <div className="w-24 h-[2px] bg-[#8cc63f] mt-3" />
        </div>

        <div className="bg-white rounded-[10px] border border-neutral-100 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase tracking-wide">PNR / Booking Reference</label>
              <input
                type="text"
                value={pnr}
                onChange={(e) => { setPnr(e.target.value.toUpperCase()); setResult(null); }}
                placeholder="e.g. AB123C"
                maxLength={6}
                className="w-full border border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase tracking-wide">Email (optional — for walk-in bookings)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/40"
              />
            </div>
            <button
              onClick={() => trackMut.mutate()}
              disabled={pnr.length < 6 || trackMut.isPending}
              className="w-full bg-[#8cc63f] text-white py-2.5 rounded-[8px] text-sm font-medium hover:bg-[#7ab535] transition-colors disabled:opacity-50"
            >
              {trackMut.isPending ? 'Searching...' : 'Track Booking'}
            </button>
          </div>
        </div>

        {trackMut.isError && (
          <div className="bg-red-50 text-red-600 text-sm rounded-[8px] p-4 text-center">
            Booking not found. Please check your PNR and try again.
          </div>
        )}

        {result && (
          <div className="bg-white rounded-[10px] border border-neutral-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide">PNR</p>
                <p className="font-mono text-xl font-bold text-neutral-800 tracking-widest">{result.pnr}</p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor[result.status] ?? 'text-neutral-500 bg-neutral-50'}`}>
                {result.status.replace('_', ' ')}
              </span>
            </div>

            <div className="border-t border-neutral-50 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-400 mb-1">Product</p>
                <p className="text-sm text-neutral-700">{result.product}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Passengers</p>
                <p className="text-sm text-neutral-700">{result.totalPassengers}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Departure</p>
                <p className="text-sm text-neutral-700">
                  {new Date(result.departure).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Arrival</p>
                <p className="text-sm text-neutral-700">
                  {new Date(result.arrival).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {result.leadPassenger && (
                <div className="col-span-2">
                  <p className="text-xs text-neutral-400 mb-1">Lead Passenger</p>
                  <p className="text-sm text-neutral-700">{result.leadPassenger.firstName} {result.leadPassenger.lastName}</p>
                </div>
              )}
              {result.totalAmountUsd > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-neutral-400 mb-1">Total</p>
                  <p className="text-sm font-medium text-neutral-800">${result.totalAmountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              )}
            </div>

            <div className={`text-xs px-3 py-2 rounded-[6px] ${
              result.flightStatus === 'SCHEDULED' ? 'bg-[#8cc63f]/10 text-[#8cc63f]' :
              result.flightStatus === 'COMPLETED' ? 'bg-blue-50 text-blue-600' :
              'bg-neutral-50 text-neutral-400'
            }`}>
              Flight status: {result.flightStatus}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TrackPage() {
  return <Suspense><TrackPageInner /></Suspense>;
}

"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { publicApi, type SeatInfo } from '@/lib/api';

interface PassengerForm {
  firstName:      string;
  lastName:       string;
  cnicOrPassport: string;
  dateOfBirth:    string;
  nationality:    string;
  isLeadPassenger: boolean;
}

interface BookingForm {
  leadEmail:  string;
  leadPhone:  string;
  passengers: PassengerForm[];
}

const BRAND = '#8cc63f';

const emptyPassenger = (lead = false): PassengerForm => ({
  firstName: '', lastName: '', cnicOrPassport: '', dateOfBirth: '', nationality: '', isLeadPassenger: lead,
});

// ── Seat Map ──────────────────────────────────────────────────────────────────

function SeatMap({
  seats,
  lopaImageUrl,
  selectedIds,
  maxSelectable,
  onToggle,
}: {
  seats:        SeatInfo[];
  lopaImageUrl: string | null;
  selectedIds:  Set<string>;
  maxSelectable: number;
  onToggle:     (id: string) => void;
}) {
  const available = seats.filter((s) => !s.isTaken).length;

  const legend = (
    <div className="flex items-center gap-4 text-xs text-neutral-400 mt-3">
      <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-[#8cc63f] bg-[#8cc63f]/10 inline-block" /> Selected</span>
      <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-neutral-300 bg-white inline-block" /> Available</span>
      <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-neutral-200 inline-block" /> Taken</span>
      <span className="ml-auto font-medium text-neutral-500">{available} available · {selectedIds.size}/{maxSelectable} selected</span>
    </div>
  );

  if (lopaImageUrl) {
    return (
      <div>
        <div className="relative w-full overflow-hidden rounded-[8px] border border-neutral-100 bg-neutral-50">
          <Image
            src={lopaImageUrl}
            alt="Aircraft seat layout"
            width={900}
            height={500}
            className="w-full h-auto"
            style={{ display: 'block' }}
          />
          {seats.map((seat) => {
            if (seat.seatX == null || seat.seatY == null) return null;
            const isSel = selectedIds.has(seat.id);
            const canSelect = !seat.isTaken && (isSel || selectedIds.size < maxSelectable);
            return (
              <button
                key={seat.id}
                onClick={() => !seat.isTaken && canSelect && onToggle(seat.id)}
                title={seat.seatNumber}
                style={{ left: `${seat.seatX}%`, top: `${seat.seatY}%` }}
                className={[
                  'absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded text-[8px] font-bold transition-all border',
                  seat.isTaken
                    ? 'bg-neutral-300 border-neutral-300 text-neutral-500 cursor-not-allowed'
                    : isSel
                    ? 'bg-[#8cc63f] border-[#8cc63f] text-white shadow-md scale-110'
                    : canSelect
                    ? 'bg-white border-neutral-300 text-neutral-600 hover:border-[#8cc63f] hover:scale-110 cursor-pointer'
                    : 'bg-white border-neutral-200 text-neutral-400 cursor-not-allowed opacity-50',
                ].join(' ')}
              >
                {seat.seatNumber}
              </button>
            );
          })}
        </div>
        {legend}
      </div>
    );
  }

  // Grid fallback — group by row
  const rows = Array.from(new Set(seats.map((s) => s.row))).sort((a, b) => a - b);
  return (
    <div>
      <div className="space-y-2">
        {rows.map((row) => {
          const rowSeats = seats.filter((s) => s.row === row).sort((a, b) => a.column.localeCompare(b.column));
          return (
            <div key={row} className="flex items-center gap-2">
              <span className="w-5 text-xs text-neutral-300 text-right shrink-0">{row}</span>
              <div className="flex gap-1.5 flex-wrap">
                {rowSeats.map((seat) => {
                  const isSel = selectedIds.has(seat.id);
                  const canSelect = !seat.isTaken && (isSel || selectedIds.size < maxSelectable);
                  return (
                    <button
                      key={seat.id}
                      onClick={() => !seat.isTaken && canSelect && onToggle(seat.id)}
                      title={seat.seatNumber}
                      className={[
                        'w-9 h-9 rounded-[6px] text-xs font-semibold border transition-all',
                        seat.isTaken
                          ? 'bg-neutral-200 border-neutral-200 text-neutral-400 cursor-not-allowed'
                          : isSel
                          ? 'bg-[#8cc63f] border-[#8cc63f] text-white shadow-sm scale-105'
                          : canSelect
                          ? 'bg-white border-neutral-300 text-neutral-600 hover:border-[#8cc63f] hover:scale-105 cursor-pointer'
                          : 'bg-white border-neutral-100 text-neutral-300 cursor-not-allowed opacity-50',
                      ].join(' ')}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {legend}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SlotDetailPage() {
  const { slotId } = useParams<{ slotId: string }>();
  const router = useRouter();

  const { data: slot, isLoading } = useQuery({
    queryKey: ['slot-detail', slotId],
    queryFn:  () => publicApi.getSlotDetail(slotId),
  });

  const [form, setForm] = useState<BookingForm>({
    leadEmail: '', leadPhone: '', passengers: [emptyPassenger(true)],
  });

  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());

  function toggleSeat(id: string) {
    setSelectedSeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPassenger() {
    if (!slot || form.passengers.length >= slot.availableSeats) return;
    setForm((f) => ({ ...f, passengers: [...f.passengers, emptyPassenger()] }));
  }

  function removePassenger(i: number) {
    if (i === 0) return;
    setForm((f) => ({ ...f, passengers: f.passengers.filter((_, idx) => idx !== i) }));
    // Drop a selected seat if passenger count drops
    setSelectedSeatIds((prev) => {
      const arr = Array.from(prev);
      arr.pop();
      return new Set(arr);
    });
  }

  function updatePassenger(i: number, field: keyof PassengerForm, val: string) {
    setForm((f) => ({
      ...f,
      passengers: f.passengers.map((p, idx) => idx === i ? { ...p, [field]: val } : p),
    }));
  }

  function handleProceed() {
    if (!slot) return;
    const intent = {
      slotId,
      form,
      seatIds: selectedSeatIds.size === form.passengers.length ? Array.from(selectedSeatIds) : undefined,
    };
    sessionStorage.setItem('jq_booking_intent', JSON.stringify(intent));
    router.push(`/book/payment?slotId=${slotId}&pax=${form.passengers.length}`);
  }

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-12 px-4">
        <div className="space-y-4">
          {[1,2,3].map((i) => <div key={i} className="h-24 bg-white rounded-[10px] animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!slot) {
    return (
      <div className="container max-w-3xl mx-auto py-12 px-4 text-center">
        <p className="text-neutral-400">Flight not found.</p>
      </div>
    );
  }

  const dep    = new Date(slot.scheduledDeparture);
  const arr    = new Date(slot.scheduledArrival);
  const depStr = dep.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const arrStr = arr.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const durMin = Math.round((arr.getTime() - dep.getTime()) / 60000);
  const durStr = durMin >= 60 ? `${Math.floor(durMin/60)}h ${durMin%60}m` : `${durMin}m`;

  const paxCount       = form.passengers.length;
  const needSeatSelect = !!slot.seatMap && slot.seatMap.seats.length > 0;
  const seatSelOk      = !needSeatSelect || selectedSeatIds.size === paxCount;
  const canProceed     = !!form.leadEmail && !!form.passengers[0].firstName && seatSelOk;

  return (
    <section className="w-full py-12 px-4">
      <div className="container max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="text-xs text-neutral-400 hover:text-neutral-600 mb-6 flex items-center gap-1">
          ← Back to results
        </button>

        {/* Flight summary */}
        <div className="bg-white rounded-[10px] border border-neutral-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Flight</p>
              <p className="font-mono text-sm text-neutral-600">{slot.slotCode}</p>
            </div>
            <span className="bg-[#8cc63f]/10 text-[#8cc63f] text-xs px-3 py-1 rounded-full font-medium">
              {slot.availableSeats} seats available
            </span>
          </div>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-2xl font-semibold text-neutral-800">{slot.origin}</p>
              <p className="text-xs text-neutral-400">{depStr}</p>
            </div>
            <div className="flex flex-col items-center flex-1">
              <p className="text-xs text-neutral-300">{durStr}</p>
              <div className="w-full h-[1px] bg-neutral-200 my-1 relative">
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8cc63f] text-xs">✈</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-semibold text-neutral-800">{slot.destination}</p>
              <p className="text-xs text-neutral-400">{arrStr}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-50 flex flex-wrap gap-4 text-xs text-neutral-400">
            <span>Aircraft: <span className="text-neutral-600">{typeof slot.aircraft === 'string' ? slot.aircraft : slot.aircraft.name}</span></span>
            {slot.product && <span>Product: <span className="text-[#8cc63f]">{slot.product.name}</span></span>}
            {slot.distanceKm && <span>Distance: <span className="text-neutral-600">{slot.distanceKm} km</span></span>}
            {slot.operatorName && (
              <span className="flex items-center gap-1">Operator:
                {slot.operatorLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.operatorLogo} alt="" className="size-4 rounded object-cover inline-block" />
                )}
                <span className="text-neutral-600">{slot.operatorName}</span>
              </span>
            )}
          </div>
        </div>

        {/* Passengers */}
        <div className="bg-white rounded-[10px] border border-neutral-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-neutral-800">Passenger Details</h2>
            {form.passengers.length < (slot?.availableSeats ?? 1) && (
              <button onClick={addPassenger} className="text-xs border px-3 py-1 rounded-[6px] hover:bg-[#8cc63f]/5" style={{ color: BRAND, borderColor: BRAND }}>
                + Add Passenger
              </button>
            )}
          </div>
          <div className="space-y-6">
            {form.passengers.map((p, i) => (
              <div key={i} className="border border-neutral-100 rounded-[8px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    {i === 0 ? 'Lead Passenger' : `Passenger ${i + 1}`}
                  </p>
                  {i > 0 && (
                    <button onClick={() => removePassenger(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['firstName', 'First Name'],
                    ['lastName', 'Last Name'],
                    ['cnicOrPassport', 'CNIC / Passport No.'],
                    ['dateOfBirth', 'Date of Birth'],
                    ['nationality', 'Nationality'],
                  ].map(([field, label]) => (
                    <div key={field} className={field === 'cnicOrPassport' || field === 'nationality' ? 'col-span-2 md:col-span-1' : ''}>
                      <label className="block text-xs text-neutral-400 mb-1">{label}</label>
                      <input
                        type={field === 'dateOfBirth' ? 'date' : 'text'}
                        value={(p as unknown as Record<string,string>)[field]}
                        onChange={(e) => updatePassenger(i, field as keyof PassengerForm, e.target.value)}
                        className="w-full border border-neutral-200 rounded-[6px] px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                      />
                    </div>
                  ))}
                </div>
                {i === 0 && (
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-neutral-50">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Email</label>
                      <input
                        type="email"
                        value={form.leadEmail}
                        onChange={(e) => setForm((f) => ({ ...f, leadEmail: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={form.leadPhone}
                        onChange={(e) => setForm((f) => ({ ...f, leadPhone: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Seat Selection */}
        {needSeatSelect && slot.seatMap && (
          <div className="bg-white rounded-[10px] border border-neutral-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-neutral-800">Select Your Seats</h2>
              <span className="text-xs text-neutral-400">
                Choose {paxCount} seat{paxCount > 1 ? 's' : ''} for your {paxCount > 1 ? `${paxCount} passengers` : 'passenger'}
              </span>
            </div>
            {!seatSelOk && selectedSeatIds.size > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-[6px] px-3 py-2 mb-4">
                Please select exactly {paxCount} seat{paxCount > 1 ? 's' : ''} to match your passenger count.
              </p>
            )}
            <SeatMap
              seats={slot.seatMap.seats}
              lopaImageUrl={slot.seatMap.lopaImageUrl}
              selectedIds={selectedSeatIds}
              maxSelectable={paxCount}
              onToggle={toggleSeat}
            />
          </div>
        )}

        {/* Add-ons */}
        {slot.product?.addOns && slot.product.addOns.length > 0 && (
          <div className="bg-white rounded-[10px] border border-neutral-100 p-6 mb-6">
            <h2 className="text-base font-medium text-neutral-800 mb-4">Included Services</h2>
            <div className="space-y-2">
              {slot.product.addOns.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{a.label}</span>
                  <span className={a.isIncluded ? 'text-[#8cc63f] text-xs' : 'text-neutral-400 text-xs'}>
                    {a.isIncluded ? 'Included' : `+$${a.priceUsd}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proceed */}
        <div className="flex justify-end">
          <button
            onClick={handleProceed}
            disabled={!canProceed}
            className="bg-[#8cc63f] text-white px-8 py-3 rounded-[10px] font-medium hover:bg-[#7ab535] transition-colors disabled:opacity-50"
          >
            Continue to Login →
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plane, Helicopter, CheckCircle, ArrowRight, ArrowLeft,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw,
  Clock, Mail, Check, Phone, ChevronDown, Search, X as XIcon,
  CreditCard
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements, PaymentElement,
  useStripe, useElements,
} from "@stripe/react-stripe-js";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { format, isValid } from "date-fns";
import {
  publicApi, customerApi,
  type PublicProduct, type ProductSlot, type PublicFlight, type OperationalCity,
} from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerStore";
import { maskPhone, maskCnic } from "@/lib/utils/input-mask";

// M-7: Avoid silent empty-string failure — only initialise Stripe if the key is present
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRAND    = "#8cc63f";
const CHARCOAL = "#3a3a3a";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtDuration(depIso: string, arrIso?: string | null) {
  if (!arrIso) return null;
  const mins = Math.round((new Date(arrIso).getTime() - new Date(depIso).getTime()) / 60000);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}
function addMonths(y: number, m: number, delta: number): [number, number] {
  const d = new Date(y, m + delta, 1);
  return [d.getFullYear(), d.getMonth()];
}

// ── Step indicator ────────────────────────────────────────────────────────────

type Step = "search" | "passengers" | "confirm" | "payment";

const STEPS: { key: Step; label: string }[] = [
  { key: "search",     label: "Select Flight" },
  { key: "passengers", label: "Passengers"    },
  { key: "confirm",    label: "Review"        },
  { key: "payment",    label: "Payment"       },
];

function StepBar({ current }: { current: Step }) {
  const ci = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done   = i < ci;
        const active = i === ci;
        return (
          <React.Fragment key={s.key}>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              done   ? "text-white"       : "",
              active ? "text-white"       : "",
              !done && !active ? "text-neutral-400 bg-neutral-100" : "",
            )} style={done || active ? { background: done ? BRAND : CHARCOAL } : {}}>
              {done
                ? <Check className="size-3" />
                : <span className="size-4 flex items-center justify-center font-bold">{i + 1}</span>
              }
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-[1px] flex-1 mx-1", i < ci ? "bg-[#8cc63f]" : "bg-neutral-200")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Hold Countdown ────────────────────────────────────────────────────────────

function HoldCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired?: () => void }) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    if (secs <= 0) { onExpired?.(); return; }
    const t = setInterval(() => setSecs((s) => { if (s <= 1) { onExpired?.(); clearInterval(t); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = Math.floor(secs / 60), s = secs % 60;
  const isLow = secs < 300;
  if (secs <= 0) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-red-50 border border-red-200">
      <AlertCircle className="size-4 text-red-500" />
      <span className="text-xs font-medium text-red-600">Hold expired — please start over</span>
    </div>
  );
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-[8px] border", isLow ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}>
      <Clock className={cn("size-4", isLow ? "text-red-500" : "text-amber-600")} />
      <span className={cn("text-xs font-semibold tabular-nums", isLow ? "text-red-600" : "text-amber-700")}>
        {String(m).padStart(2,"0")}:{String(s).padStart(2,"0")} seat hold
      </span>
    </div>
  );
}

// ── Stripe Card Form ──────────────────────────────────────────────────────────

function StripePaymentForm({
  amountUsd, holdExpiresAt, onSuccess, onHoldExpired, customerEmail,
}: {
  amountUsd:     number;
  holdExpiresAt: string;
  onSuccess:     () => void;
  onHoldExpired: () => void;
  customerEmail?: string;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading,  setLoading]  = useState(false);
  const [payError, setPayError] = useState("");

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setPayError("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // M-1: Include booking context so we can restore state after 3DS redirect
    return_url: `${window.location.origin}/book?payment=return`,
        ...(customerEmail ? { payment_method_data: { billing_details: { email: customerEmail } } } : {}),
      },
      redirect: "if_required",
    });

    setLoading(false);
    if (error) { setPayError(error.message ?? "Payment failed — please try again"); return; }
    if (paymentIntent?.status === "succeeded") onSuccess();
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      {/* Amount */}
      <div className="bg-[#f0f9e8] rounded-[10px] p-4 flex items-center justify-between">
        <span className="text-sm text-neutral-600">Total Amount</span>
        <span className="text-xl font-bold text-neutral-800">
          ${amountUsd.toFixed(2)} <span className="text-xs font-normal text-neutral-500">USD</span>
        </span>
      </div>

      {/* Hold timer */}
      <HoldCountdown expiresAt={holdExpiresAt} onExpired={onHoldExpired} />

      {payError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[8px] p-3 text-xs text-red-600">
          <AlertCircle className="size-3.5 shrink-0" /> {payError}
        </div>
      )}

      {/* Stripe PaymentElement — includes test card auto-fill in test mode */}
      <div className="bg-white border border-neutral-200 rounded-[10px] p-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="size-4 text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-700">Pay by Card</p>
        </div>
        <PaymentElement
          options={{
            layout:             "accordion",
            paymentMethodOrder: ["card"],
            wallets:            { applePay: "never", googlePay: "never" },
            ...(customerEmail ? { fields: { billingDetails: { email: "never" } }, defaultValues: { billingDetails: { email: customerEmail } } } : {}),
          }}
        />
      </div>

      <button type="submit" disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
        style={{ background: BRAND }}>
        {loading
          ? <><Loader2 className="size-4 animate-spin" /> Processing…</>
          : <><CreditCard className="size-4" /> Pay ${amountUsd.toFixed(2)}</>}
      </button>

      <p className="text-center text-[10px] text-neutral-400">
        Secured by Stripe · All amounts in USD
      </p>
    </form>
  );
}

// ── Combobox ──────────────────────────────────────────────────────────────────

function Combobox({
  options, value, onChange, placeholder, disabled,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(
    () => query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options,
    [options, query],
  );

  function select(opt: string) {
    onChange(opt);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-sm rounded-[8px] border-2 px-3 py-2.5 transition-all bg-white",
          disabled ? "border-neutral-100 text-neutral-300 cursor-not-allowed bg-neutral-50"
            : open ? "border-[#8cc63f] text-neutral-800"
            : value ? "border-neutral-200 text-neutral-800 hover:border-[#8cc63f]/50"
            : "border-neutral-200 text-neutral-400 hover:border-[#8cc63f]/50",
        )}>
        <span className={cn("font-medium truncate", !value && "font-normal")}>{value || placeholder || "Select…"}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform text-neutral-400", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[180px] bg-white border border-neutral-200 rounded-[10px] shadow-lg overflow-hidden">
          {options.length > 5 && (
            <div className="px-3 py-2 border-b border-neutral-100">
              <div className="flex items-center gap-2 bg-neutral-50 rounded-[6px] px-2.5 py-1.5">
                <Search className="size-3.5 text-neutral-400 shrink-0" />
                <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="flex-1 bg-transparent text-xs outline-none text-neutral-700 placeholder:text-neutral-400" />
                {query && <button type="button" onClick={() => setQuery("")}><XIcon className="size-3 text-neutral-400 hover:text-neutral-600" /></button>}
              </div>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-neutral-400 text-center">No results</p>
            ) : filtered.map((opt) => (
              <button key={opt} type="button" onClick={() => select(opt)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2",
                  value === opt ? "bg-[#f0f9e8] text-[#8cc63f] font-medium" : "text-neutral-700 hover:bg-neutral-50",
                )}>
                {opt}
                {value === opt && <Check className="size-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helicopter Calendar ───────────────────────────────────────────────────────

function HelCalendar({
  slotsByDate, selectedDate, onSelect,
}: {
  slotsByDate: Record<string, ProductSlot[]>;
  selectedDate: string;
  onSelect: (d: string) => void;
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [vy, setVy] = useState(today.getFullYear());
  const [vm, setVm] = useState(today.getMonth());
  const [ny, nm]    = useMemo(() => addMonths(vy, vm, 1), [vy, vm]);
  const isNow       = vy === today.getFullYear() && vm === today.getMonth();

  function renderMonth(year: number, month: number) {
    const days  = new Date(year, month + 1, 0).getDate();
    const start = new Date(year, month, 1).getDay();
    return (
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center justify-center py-2 border-b border-neutral-100">
          <span className="text-sm font-medium text-neutral-700">{MONTH_NAMES[month]} {year}</span>
        </div>
        <div className="grid grid-cols-7">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-1.5 text-center text-[10px] font-semibold text-neutral-300 tracking-wide">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: start }).map((_, i) => <div key={`e${i}`} className="h-14 border-b border-neutral-50" />)}
          {Array.from({ length: days }).map((_, i) => {
            const day     = i + 1;
            const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const dt      = new Date(year, month, day);
            const isPast  = dt < today;
            const daySlots= slotsByDate[dateStr] ?? [];
            const has     = !isPast && daySlots.length > 0;
            const isSel   = selectedDate === dateStr;
            const seats    = daySlots.reduce((s, sl) => s + sl.availableSeats, 0);
            const minPrice = daySlots.reduce((min, sl) =>
              sl.pricePerSeat != null && (min === null || sl.pricePerSeat < min) ? sl.pricePerSeat : min, null as number | null);
            return (
              <button key={day} type="button"
                disabled={isPast || !has}
                onClick={() => has && onSelect(dateStr)}
                className={cn(
                  "h-[72px] flex flex-col items-center justify-center gap-0.5 border-b border-neutral-50 transition-all",
                  isPast   ? "opacity-25 cursor-not-allowed" : "",
                  !has && !isPast ? "cursor-default" : "",
                  isSel    ? "cursor-pointer" : has ? "hover:opacity-80 cursor-pointer" : "",
                )}
                style={isSel ? { background: BRAND } : has ? { background: "#f0f9e8" } : {}}
              >
                <span className={cn("text-sm font-semibold leading-none", isSel ? "text-white" : isPast ? "text-neutral-300" : "text-neutral-800")}>
                  {day}
                </span>
                {has && minPrice != null && (
                  <span className={cn("text-[9px] font-bold leading-none", isSel ? "text-white" : "text-[#8cc63f]")}>
                    ${Math.round(minPrice)}
                  </span>
                )}
                {has && (
                  <span className={cn("text-[8px] leading-none", isSel ? "text-white/70" : "text-neutral-400")}>
                    {seats}s · {daySlots.length}f
                  </span>
                )}
                {!has && !isPast && (
                  <span className="text-[9px] text-neutral-200">—</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-100 rounded-[10px] overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-100">
        <button type="button" onClick={() => { const [y,m] = addMonths(vy,vm,-1); setVy(y); setVm(m); }}
          disabled={isNow} className="p-1.5 rounded-[6px] hover:bg-neutral-200 disabled:opacity-30 transition-colors">
          <ChevronLeft className="size-4 text-neutral-600" />
        </button>
        <span className="text-xs text-neutral-400 font-medium">{MONTH_NAMES[vm]} {vy} – {MONTH_NAMES[nm]} {ny}</span>
        <button type="button" onClick={() => { const [y,m] = addMonths(vy,vm,1); setVy(y); setVm(m); }}
          className="p-1.5 rounded-[6px] hover:bg-neutral-200 transition-colors">
          <ChevronRight className="size-4 text-neutral-600" />
        </button>
      </div>
      <div className="flex divide-x divide-neutral-100 overflow-x-auto">
        {renderMonth(vy, vm)}
        {renderMonth(ny, nm)}
      </div>
    </div>
  );
}

// ── Fixed-wing Calendar (availability dots) ───────────────────────────────────

function FwCalendar({
  availDates, priceByDate, selectedDate, onSelect, minDate,
}: {
  availDates: Set<string>;
  priceByDate: Record<string, number | null>;
  selectedDate: string;
  onSelect: (d: string) => void;
  minDate?: string;
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const minDt  = useMemo(() => { if (!minDate) return today; const d = new Date(minDate); d.setHours(0,0,0,0); return d > today ? d : today; }, [minDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const [vy, setVy] = useState(today.getFullYear());
  const [vm, setVm] = useState(today.getMonth());
  const [ny, nm]    = useMemo(() => addMonths(vy, vm, 1), [vy, vm]);
  const isNow       = vy === today.getFullYear() && vm === today.getMonth();

  function renderMonth(year: number, month: number) {
    const days  = new Date(year, month + 1, 0).getDate();
    const start = new Date(year, month, 1).getDay();
    return (
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center justify-center py-2 border-b border-neutral-100">
          <span className="text-sm font-medium text-neutral-700">{MONTH_NAMES[month]} {year}</span>
        </div>
        <div className="grid grid-cols-7">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-1.5 text-center text-[10px] font-semibold text-neutral-300 tracking-wide">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: start }).map((_, i) => <div key={`e${i}`} className="h-12 border-b border-neutral-50" />)}
          {Array.from({ length: days }).map((_, i) => {
            const day     = i + 1;
            const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const dt      = new Date(year, month, day);
            const isPast  = dt < minDt;
            const has     = !isPast && availDates.has(dateStr);
            const isSel   = selectedDate === dateStr;
            const price   = has ? priceByDate[dateStr] : null;
            return (
              <button key={day} type="button"
                disabled={isPast || !has}
                onClick={() => has && onSelect(dateStr)}
                className={cn(
                  "h-14 flex flex-col items-center justify-center gap-0.5 border-b border-neutral-50 transition-all",
                  isPast ? "opacity-25 cursor-not-allowed" : !has ? "cursor-default" : "hover:opacity-80 cursor-pointer",
                )}
                style={isSel ? { background: BRAND } : has ? { background: "#f0f9e8" } : {}}
              >
                <span className={cn("text-sm font-semibold", isSel ? "text-white" : isPast ? "text-neutral-300" : "text-neutral-800")}>
                  {day}
                </span>
                {has && price != null && (
                  <span className={cn("text-[9px] font-semibold leading-none", isSel ? "text-white/90" : "text-[#8cc63f]")}>
                    ${Math.round(price)}
                  </span>
                )}
                {has && price == null && !isSel && <span className="size-1 rounded-full bg-[#8cc63f]" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-100 rounded-[10px] overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-100">
        <button type="button" onClick={() => { const [y,m] = addMonths(vy,vm,-1); setVy(y); setVm(m); }}
          disabled={isNow} className="p-1.5 rounded-[6px] hover:bg-neutral-200 disabled:opacity-30 transition-colors">
          <ChevronLeft className="size-4 text-neutral-600" />
        </button>
        <span className="text-xs text-neutral-400 font-medium">{MONTH_NAMES[vm]} {vy} – {MONTH_NAMES[nm]} {ny}</span>
        <button type="button" onClick={() => { const [y,m] = addMonths(vy,vm,1); setVy(y); setVm(m); }}
          className="p-1.5 rounded-[6px] hover:bg-neutral-200 transition-colors">
          <ChevronRight className="size-4 text-neutral-600" />
        </button>
      </div>
      <div className="flex divide-x divide-neutral-100 overflow-x-auto">
        {renderMonth(vy, vm)}
        {renderMonth(ny, nm)}
      </div>
    </div>
  );
}

// ── Flight card ───────────────────────────────────────────────────────────────

function FlightCard({ flight, isSelected, requiredSeats, onClick }: {
  flight: PublicFlight; isSelected: boolean; requiredSeats: number; onClick: () => void;
}) {
  const dur   = fmtDuration(flight.scheduledDeparture, flight.scheduledArrival);
  const hasSeats = flight.availableSeats >= requiredSeats;
  return (
    <button type="button" onClick={onClick} disabled={!hasSeats}
      className={cn(
        "w-full text-left rounded-[10px] border-2 px-4 py-4 transition-all",
        !hasSeats && "opacity-40 cursor-not-allowed",
        isSelected ? "border-[#8cc63f] bg-[#f0f9e8]" : "border-neutral-200 bg-white hover:border-[#8cc63f]/40",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="text-center shrink-0">
            <p className="text-lg font-bold text-neutral-800">{fmtTime(flight.scheduledDeparture)}</p>
            <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">{flight.origin}</p>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            {dur && <p className="text-[10px] text-neutral-400">{dur}</p>}
            <div className="flex items-center w-full gap-1">
              <div className="flex-1 h-px bg-neutral-200" />
              <Plane className="size-3 text-neutral-400" />
              <div className="flex-1 h-px bg-neutral-200" />
            </div>
            <p className="text-[9px] font-mono text-neutral-300">{flight.slotCode}</p>
          </div>
          <div className="text-center shrink-0">
            <p className="text-lg font-bold text-neutral-800">
              {flight.scheduledArrival ? fmtTime(flight.scheduledArrival) : "—"}
            </p>
            <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">{flight.destination}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {flight.pricePerSeat != null && (
            <div className="text-right">
              <p className="text-base font-bold text-neutral-800">${Math.round(flight.pricePerSeat)}</p>
              <p className="text-[9px] text-neutral-400">per seat</p>
            </div>
          )}
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            flight.availableSeats > 3 ? "bg-[#f0f9e8] text-[#8cc63f]" :
            flight.availableSeats > 0 ? "bg-amber-50 text-amber-600" :
            "bg-red-50 text-red-500"
          )}>
            {flight.availableSeats === 0 ? "Full" : `${flight.availableSeats} seats`}
          </span>
          {isSelected && (
            <div className="size-5 rounded-full flex items-center justify-center" style={{ background: BRAND }}>
              <Check className="size-3 text-white" />
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center flex-wrap gap-2 text-[11px] text-neutral-400">
        <Plane className="size-3 shrink-0" />
        <span>{flight.aircraft.registrationNo} — {flight.aircraft.name}</span>
        {flight.aircraft.speedKmh && <span>· {flight.aircraft.speedKmh} km/h</span>}
        {flight.distanceKm && <span>· {flight.distanceKm} km</span>}
        {flight.operatorName && (
          <span className="ml-auto flex items-center gap-1 bg-neutral-100 text-neutral-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {flight.operatorLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flight.operatorLogo} alt="" className="size-3 rounded-full object-cover" />
            )}
            {flight.operatorName}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Helicopter slot card ──────────────────────────────────────────────────────

function SlotCard({ slot, isSelected, requiredSeats, onClick }: {
  slot: ProductSlot; isSelected: boolean; requiredSeats: number; onClick: () => void;
}) {
  const dur = fmtDuration(slot.scheduledDeparture, slot.scheduledArrival);
  const hasSeats = slot.availableSeats >= requiredSeats;
  return (
    <button type="button" onClick={onClick} disabled={!hasSeats}
      className={cn(
        "text-left rounded-[10px] border-2 px-4 py-3 transition-all",
        !hasSeats && "opacity-40 cursor-not-allowed",
        isSelected ? "border-[#8cc63f] bg-[#f0f9e8]" : "border-neutral-200 bg-white hover:border-[#8cc63f]/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-neutral-600">{slot.slotCode}</span>
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full font-medium",
          slot.availableSeats > 3 ? "bg-[#f0f9e8] text-[#8cc63f]" :
          slot.availableSeats > 0 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500"
        )}>
          {slot.availableSeats === 0 ? "Full" : `${slot.availableSeats}/${slot.aircraft.saleableSeats} seats`}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-sm font-semibold text-neutral-800">{fmtTime(slot.scheduledDeparture)}</p>
        {slot.pricePerSeat != null && (
          <p className="text-sm font-bold" style={{ color: BRAND }}>${Math.round(slot.pricePerSeat)}<span className="text-[10px] font-normal text-neutral-400">/seat</span></p>
        )}
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400">
        {slot.scheduledArrival && <span>{fmtTime(slot.scheduledArrival)}</span>}
        {dur && <><span>·</span><span>{dur} flight</span></>}
        {slot.operatorName && (
          <span className="ml-auto flex items-center gap-1 bg-neutral-100 text-neutral-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {slot.operatorLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slot.operatorLogo} alt="" className="size-3 rounded-full object-cover" />
            )}
            {slot.operatorName}
          </span>
        )}
      </div>
      {isSelected && !hasSeats && (
        <p className="text-[10px] text-amber-600 mt-1">⚠ Not enough seats — reduce count</p>
      )}
    </button>
  );
}

// ── DOB Picker ────────────────────────────────────────────────────────────────

function DOBPicker({ value, onChange, hasError }: { value: string; onChange: (v: string) => void; hasError?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? new Date(value) : undefined;

  const displayValue = selected && isValid(selected) ? format(selected, "dd MMM yyyy") : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn(
            "w-full flex items-center justify-between border rounded-[8px] px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30 transition-colors bg-white",
            hasError ? "border-red-300 focus:ring-red-200" : "border-neutral-200",
            !displayValue && "text-neutral-400"
          )}>
          <span>{displayValue || "Select date"}</span>
          <svg className="size-4 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) { onChange(format(d, "yyyy-MM-dd")); setOpen(false); }
          }}
          defaultMonth={selected ?? new Date(1990, 0, 1)}
          disabled={(d) => d > new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Passenger form schema ─────────────────────────────────────────────────────

const passengerSchema = z.object({
  firstName:       z.string().min(1, "First name is required"),
  lastName:        z.string().min(1, "Last name is required"),
  cnicOrPassport:  z.string().min(5).refine(
    (val) => /^\d{5}-\d{7}-\d$/.test(val) || /^[A-Z0-9]{6,9}$/.test(val.toUpperCase()),
    "Enter a valid CNIC (XXXXX-XXXXXXX-X) or passport number"
  ),
  dateOfBirth:     z.string().min(1, "Date of birth is required").refine((v) => {
    const d = new Date(v); return !isNaN(d.getTime()) && d < new Date();
  }, "Enter a valid past date"),
  nationality:     z.string().min(1, "Nationality is required"),
  isLeadPassenger: z.boolean(),
});
const formSchema = z.object({
  leadEmail: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  leadPhone: z.string().regex(/^\+?[0-9\s\-().]{7,20}$/, "Please enter a valid phone number"),
  passengers: z.array(passengerSchema).min(1),
}).superRefine((val, ctx) => {
  const leads = val.passengers.filter((p) => p.isLeadPassenger).length;
  if (leads !== 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "One lead passenger required", path: ["passengers"] });
});
type BookingForm = z.infer<typeof formSchema>;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BookPage() {
  const router = useRouter();
  const { isLoggedIn, token, customer, login } = useCustomerAuth();
  const queryClient = useQueryClient();

  // ── State ─────────────────────────────────────────────────────────────────

  const [step,         setStep]         = useState<Step>("search");
  const [bookingKind,  setBookingKind]  = useState<"helicopter" | "fixed_wing">("helicopter");
  const [tripType,     setTripType]     = useState<"one_way" | "round_trip">("one_way");
  const seatCount = 1;
  const [error,        setError]        = useState<string | null>(null);

  // Helicopter state
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [helDate,          setHelDate]          = useState("");
  const [selectedSlot,     setSelectedSlot]     = useState<ProductSlot | null>(null);

  // Fixed-wing state
  const [fwOrigin,     setFwOrigin]     = useState("");
  const [fwDest,       setFwDest]       = useState("");
  const [fwDate,       setFwDate]       = useState("");
  const [fwReturnDate,   setFwReturnDate]   = useState("");
  const [fwReturnFlight, setFwReturnFlight] = useState<PublicFlight | null>(null);
  const [fwFlight,     setFwFlight]     = useState<PublicFlight | null>(null);

  // H-1: Track whether return-leg booking failed
  const [returnBookingFailed, setReturnBookingFailed] = useState(false);

  // H-4: Hold expiry message (preserve passenger data)
  const [holdExpiredMessage, setHoldExpiredMessage] = useState<string | null>(null);

  // OTP modal (shown before payment if not logged in)
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep,    setOtpStep]  = useState<"email" | "otp">("email");
  const [otpEmail,   setOtpEmail] = useState("");
  // H-2: Resend OTP cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpName,    setOtpName]  = useState("");
  const [otpCode,    setOtpCode]  = useState("");
  const [otpError,   setOtpError] = useState("");

  // After booking created → payment step
  const [pendingBooking, setPendingBooking] = useState<{ bookingId: string; pnr: string; holdExpiresAt: string; totalAmountUsd: number } | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [confirmedPnr, setConfirmedPnr] = useState("");
  const [paymentOutcome, setPaymentOutcome] = useState<"confirmed" | "processing" | "failed" | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: helProducts = [], isLoading: loadHel } = useQuery({
    queryKey: ["public-hel-products"],
    queryFn:  () => publicApi.getProducts({ productType: "HELICOPTER" }),
  });

  // Fixed-wing: operational cities for origin/destination dropdowns
  const { data: opCities = [] } = useQuery<OperationalCity[]>({
    queryKey: ["public-operational-cities"],
    queryFn:  () => publicApi.getOperationalCities(),
    staleTime: 10 * 60_000,
  });

  const { data: productSlots = [], isLoading: loadSlots } = useQuery({
    queryKey: ["product-slots", selectedProduct?.id],
    queryFn:  () => publicApi.getProductSlots(selectedProduct!.id),
    enabled:  !!selectedProduct,
  });

  const helSlotsByDate = useMemo(() => {
    const map: Record<string, ProductSlot[]> = {};
    for (const sl of productSlots) {
      const key = sl.scheduledDeparture.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(sl);
    }
    return map;
  }, [productSlots]);

  const helDaySlots = helDate ? (helSlotsByDate[helDate] ?? []) : [];

  const { data: fwFlights = [], isFetching: fetchingFlights } = useQuery({
    queryKey: ["fw-flights", fwOrigin, fwDest, fwDate],
    queryFn:  () => publicApi.searchFlights({ origin: fwOrigin, destination: fwDest, date: fwDate || undefined }),
    enabled:  !!fwOrigin && !!fwDest && !!fwDate && bookingKind === "fixed_wing",
  });

  // For FW calendar: we prefetch a wider range when origin+dest are selected
  const { data: fwAllFlights = [] } = useQuery({
    queryKey: ["fw-flights-all", fwOrigin, fwDest],
    queryFn:  () => publicApi.searchFlights({ origin: fwOrigin, destination: fwDest }),
    enabled:  !!fwOrigin && !!fwDest && bookingKind === "fixed_wing",
    staleTime: 5 * 60_000,
  });
  const fwAvailDates = useMemo(() => new Set(fwAllFlights.map((f) => f.scheduledDeparture.slice(0, 10))), [fwAllFlights]);

  // Return-leg flights for selected return date (specific day)
  const { data: fwReturnDayFlights = [], isFetching: fetchingReturn } = useQuery({
    queryKey: ["fw-return-day", fwDest, fwOrigin, fwReturnDate],
    queryFn:  () => publicApi.searchFlights({ origin: fwDest, destination: fwOrigin, date: fwReturnDate }),
    enabled:  !!fwDest && !!fwOrigin && !!fwReturnDate && tripType === "round_trip",
  });

  // Return-leg flights (reverse route) — for round-trip calendar
  const { data: fwReturnAllFlights = [] } = useQuery({
    queryKey: ["fw-flights-return", fwDest, fwOrigin],
    queryFn:  () => publicApi.searchFlights({ origin: fwDest, destination: fwOrigin }),
    enabled:  !!fwOrigin && !!fwDest && bookingKind === "fixed_wing" && tripType === "round_trip",
    staleTime: 5 * 60_000,
  });
  const fwReturnAvailDates = useMemo(() => new Set(fwReturnAllFlights.map((f) => f.scheduledDeparture.slice(0, 10))), [fwReturnAllFlights]);
  const fwReturnPriceByDate = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const f of fwReturnAllFlights) {
      const d = f.scheduledDeparture.slice(0, 10);
      if (f.pricePerSeat != null) {
        map[d] = map[d] == null ? f.pricePerSeat : Math.min(map[d]!, f.pricePerSeat);
      } else if (!(d in map)) { map[d] = null; }
    }
    return map;
  }, [fwReturnAllFlights]);

  // Min price per date (for calendar display)
  const fwPriceByDate = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const f of fwAllFlights) {
      const d = f.scheduledDeparture.slice(0, 10);
      if (f.pricePerSeat != null) {
        map[d] = map[d] == null ? f.pricePerSeat : Math.min(map[d]!, f.pricePerSeat);
      } else if (!(d in map)) {
        map[d] = null;
      }
    }
    return map;
  }, [fwAllFlights]);

  // ── React Hook Form ───────────────────────────────────────────────────────

  const { register, control, handleSubmit, formState: { errors } } = useForm<BookingForm>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      leadEmail:  "",
      leadPhone:  "",
      passengers: [{ firstName: "", lastName: "", cnicOrPassport: "", dateOfBirth: "", nationality: "", isLeadPassenger: true }],
    },
  });

  const { fields, remove } = useFieldArray({ control, name: "passengers" });

  const activeSlotId = bookingKind === "helicopter" ? selectedSlot?.id : fwFlight?.id;
  const activeQuoteId = bookingKind === "helicopter" ? selectedSlot?.quoteId : fwFlight?.quoteId;
  const canProceedToPassengers = !!activeSlotId;

  // Seat selection
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

  const { data: slotDetail } = useQuery({
    queryKey: ["slot-detail", activeSlotId],
    queryFn:  () => publicApi.getSlotDetail(activeSlotId!),
    enabled:  !!activeSlotId,
    staleTime: 60_000,
  });
  const seatMap = slotDetail?.seatMap ?? null;

  // ── OTP Mutations ─────────────────────────────────────────────────────────

  const requestOtpMut = useMutation({
    mutationFn: () => customerApi.requestOtp(otpEmail, otpName.trim() || undefined),
    onSuccess:  () => { setOtpStep("otp"); setOtpError(""); },
    onError:    (e: Error) => setOtpError(e.message),
  });

  const verifyOtpMut = useMutation({
    mutationFn: () => customerApi.verifyOtp(otpEmail, otpCode),
    onSuccess:  ({ accessToken, customer: c }) => {
      login(accessToken, c);
      setShowOtpModal(false);
      // Pass fresh token directly — React state hasn't flushed yet
      confirmMut.mutate(accessToken);
    },
    onError: (e: Error) => {
      // H-3: Distinguish expired OTP from wrong OTP
      if (e.message.toLowerCase().includes("expired")) {
        setOtpError("Your code has expired. Please request a new one.");
        setOtpStep("email");
      } else {
        setOtpError(e.message || "Invalid code. Please try again.");
      }
    },
  });

  // H-2: Resend OTP handler with 60-second cooldown
  function handleResendOtp() {
    requestOtpMut.mutate();
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Confirm mutation ──────────────────────────────────────────────────────
  const formDataPassengers = useWatch({ control, name: "passengers" });
  const formDataLeadPhone = useWatch({ control, name: "leadPhone" });
  const formDataLeadEmail = useWatch({ control, name: "leadEmail" });

  const confirmMut = useMutation({
    mutationFn: async (freshToken?: string) => {
      const t = freshToken ?? token!;
      const paxList = formDataPassengers.map((p) => ({ ...p }));

      // 1. Create outbound booking
      const booking = await publicApi.createBooking(t, {
        slotId:     activeSlotId!,
        passengers: paxList,
        phone:      formDataLeadPhone,
        ...(selectedSeatId ? { seatIds: [selectedSeatId] } : {}),
        ...(activeQuoteId ? { quoteId: activeQuoteId } : {}),
      });

      // 2. Create return booking if round-trip and flight selected
      if (tripType === "round_trip" && fwReturnFlight) {
        try {
          await publicApi.createBooking(t, {
            slotId:     fwReturnFlight.id,
            passengers: paxList,
            phone:      formDataLeadPhone,
            ...(fwReturnFlight.quoteId ? { quoteId: fwReturnFlight.quoteId } : {}),
          });
        } catch {
          // H-1: Return booking failed — outbound still proceeds, flag for user notification
          setReturnBookingFailed(true);
        }
      }

      // 3. Stripe PaymentIntent for outbound (return billed separately)
      const pi = await publicApi.createPaymentIntent(t, booking.bookingId);
      return { booking, pi };
    },
    onSuccess: ({ booking, pi }) => {
      setPendingBooking({
        bookingId:     booking.bookingId,
        pnr:           booking.pnr,
        holdExpiresAt: booking.holdExpiresAt,
        totalAmountUsd: booking.totalAmountUsd,
      });
      setStripeClientSecret(pi.clientSecret);
      setStep("payment");
    },
    onError: (e: Error) => setError(e.message),
  });

  async function handlePaymentSuccess() {
    if (!pendingBooking || !token) return;
    // Actually verify the payment status before showing confirmation —
    // Stripe's client-side "succeeded" only means the card was authorized,
    // not that our backend has reconciled the webhook yet.
    try {
      const status = await publicApi.getPaymentStatus(token, pendingBooking.bookingId);
      setConfirmedPnr(pendingBooking.pnr);
      if (status?.status === "CONFIRMED") {
        setPaymentOutcome("confirmed");
      } else if (status?.status === "CANCELLED") {
        setPaymentOutcome("failed");
      } else {
        // PENDING_PAYMENT — webhook hasn't landed yet, still processing
        setPaymentOutcome("processing");
      }
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch {
      // Couldn't verify — do NOT claim success. Let the user check via Track Status.
      setConfirmedPnr(pendingBooking.pnr);
      setPaymentOutcome("processing");
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const origins  = useMemo(() => opCities.map((c) => c.name).sort(), [opCities]);
  const fwDests  = useMemo(() => opCities.map((c) => c.name).filter((n) => n !== fwOrigin).sort(), [opCities, fwOrigin]);

  // ── Render: Confirmed ─────────────────────────────────────────────────────

  if (confirmedPnr && paymentOutcome) {
    const cfg = {
      confirmed: {
        bg: "#f0f9e8", iconColor: BRAND, Icon: CheckCircle,
        title: "Booking Confirmed!",
        body: "Your request has been received. Our team will contact you to finalise the details.",
      },
      processing: {
        bg: "#fffbeb", iconColor: "#d97706", Icon: Clock,
        title: "Payment Processing…",
        body: "Your payment was authorized and is being confirmed. This usually takes a few seconds — check Track Status shortly, or your email for confirmation.",
      },
      failed: {
        bg: "#fef2f2", iconColor: "#dc2626", Icon: AlertCircle,
        title: "Payment Not Completed",
        body: "Your booking could not be confirmed because the payment didn't go through. No charge was made — please try booking again.",
      },
    }[paymentOutcome];

    return (
      <section className="w-full py-16 px-4">
        <div className="container max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: cfg.bg }}>
            <cfg.Icon className="size-8" style={{ color: cfg.iconColor }} />
          </div>
          <h1 className="text-2xl font-medium text-neutral-800 mb-2">{cfg.title}</h1>
          <p className="text-neutral-500 text-sm mb-8">{cfg.body}</p>
          <div className="rounded-[10px] border p-6 mb-6" style={{ borderColor: `${cfg.iconColor}30`, background: cfg.bg }}>
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Booking Reference</p>
            <p className="text-4xl font-mono font-bold text-neutral-800 tracking-widest">{confirmedPnr}</p>
          </div>
          {/* H-1: Return booking failed warning */}
          {paymentOutcome === "confirmed" && returnBookingFailed && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-[8px] p-4 text-xs text-amber-700 text-left">
              <strong>Note:</strong> Your outbound flight is confirmed (PNR: {confirmedPnr}). However, your return flight could not be booked automatically. Please contact support to arrange your return leg.
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push(`/track?pnr=${confirmedPnr}`)}
              className="border border-neutral-200 text-neutral-600 px-5 py-2.5 rounded-[8px] text-sm hover:bg-neutral-50 transition-colors">
              Track Status
            </button>
            {paymentOutcome === "failed" ? (
              <button onClick={() => { setConfirmedPnr(""); setPaymentOutcome(null); setPendingBooking(null); }}
                className="text-white px-5 py-2.5 rounded-[8px] text-sm transition-colors" style={{ background: BRAND }}>
                Try Again
              </button>
            ) : (
              <button onClick={() => router.push("/my-account")}
                className="text-white px-5 py-2.5 rounded-[8px] text-sm transition-colors" style={{ background: BRAND }}>
                My Bookings
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-10 px-4">
      <div className="container max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-medium text-neutral-800">Book Your Flight</h1>
          <div className="w-20 h-[2px] mt-2" style={{ background: BRAND }} />
        </div>

        <StepBar current={step} />

        {/* H-4: Hold expired banner */}
        {holdExpiredMessage && step === "search" && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-[8px] p-3 mb-4">
            <AlertCircle className="size-3.5 shrink-0" /> {holdExpiredMessage}
            <button onClick={() => setHoldExpiredMessage(null)} className="ml-auto text-amber-400 hover:text-amber-600"><XIcon className="size-3.5" /></button>
          </div>
        )}

        {/* ── STEP: Search ────────────────────────────────────────────────── */}
        {step === "search" && (
          <div className="space-y-6">

            {/* Type tabs */}
            <div className="flex items-center gap-1 p-1 rounded-[10px] w-fit border border-neutral-200"
              style={{ background: "#f5f5f5" }}>
              {[
                { key: "helicopter" as const, label: "Helicopter", Icon: Helicopter },
                { key: "fixed_wing" as const, label: "Fixed Wing",  Icon: Plane      },
              ].map(({ key, label, Icon }) => (
                <button key={key} type="button"
                  onClick={() => {
                    setBookingKind(key);
                    setSelectedProduct(null); setHelDate(""); setSelectedSlot(null);
                    setFwOrigin(""); setFwDest(""); setFwDate(""); setFwFlight(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 h-9 px-4 rounded-[8px] text-sm font-medium transition-all",
                    bookingKind === key ? "bg-white text-neutral-900 shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-700",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>

            {/* ── HELICOPTER ─────────────────────────────────────────────── */}
            {bookingKind === "helicopter" && (
              <div className="space-y-6">

                {/* Step badge */}
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: BRAND }}>1</div>
                  <p className="text-sm font-semibold text-neutral-700">Select Flight Product</p>
                </div>


                {/* Product grid */}
                {loadHel ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="h-20 rounded-[10px] bg-neutral-100 animate-pulse" />
                    ))}
                  </div>
                ) : helProducts.length === 0 ? (
                  <div className="flex flex-col items-center py-10 border border-dashed border-neutral-200 rounded-[10px]">
                    <Helicopter className="size-8 text-neutral-200 mb-2" />
                    <p className="text-sm text-neutral-400">No helicopter products available.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {helProducts.map((p) => {
                      const isSel = selectedProduct?.id === p.id;
                      return (
                        <button key={p.id} type="button"
                          onClick={() => { setSelectedProduct(p); setHelDate(""); setSelectedSlot(null); }}
                          className={cn(
                            "text-left rounded-[10px] border-2 px-4 py-3 transition-all",
                            isSel ? "border-[#8cc63f] bg-[#f0f9e8]" : "border-neutral-200 bg-white hover:border-[#8cc63f]/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-800 truncate">{p.name}</p>
                              <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{p.productCode}</p>
                            </div>
                            {isSel && (
                              <div className="size-5 rounded-full flex items-center justify-center shrink-0" style={{ background: BRAND }}>
                                <Check className="size-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-2 text-xs text-neutral-500">
                            <span className="font-medium">{p.route.origin}</span>
                            <ChevronRight className="size-3" />
                            <span className="font-medium">{p.route.destination}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Calendar after product selected */}
                {selectedProduct && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: BRAND }}>2</div>
                      <p className="text-sm font-semibold text-neutral-700">Select Date
                        <span className="text-neutral-400 font-normal ml-2">— {selectedProduct.route.origin} → {selectedProduct.route.destination}</span>
                      </p>
                    </div>
                    {loadSlots ? (
                      <div className="flex items-center gap-2 py-8 justify-center text-neutral-400 text-sm">
                        <Loader2 className="size-4 animate-spin" style={{ color: BRAND }} /> Loading available dates…
                      </div>
                    ) : productSlots.length === 0 ? (
                      <div className="flex flex-col items-center py-10 border border-dashed border-neutral-200 rounded-[10px]">
                        <Clock className="size-8 text-neutral-200 mb-2" />
                        <p className="text-sm text-neutral-400">No upcoming flights for this product.</p>
                      </div>
                    ) : (
                      <HelCalendar slotsByDate={helSlotsByDate} selectedDate={helDate} onSelect={(d) => { setHelDate(d); setSelectedSlot(null); setSelectedSeatId(null); }} />
                    )}
                  </div>
                )}

                {/* Slots for selected date */}
                {selectedProduct && helDate && helDaySlots.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: BRAND }}>3</div>
                      <p className="text-sm font-semibold text-neutral-700">Select Flight
                        <span className="text-neutral-400 font-mono font-normal ml-2">{helDate}</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {helDaySlots.map(sl => (
                        <SlotCard key={sl.id} slot={sl} isSelected={selectedSlot?.id === sl.id}
                          requiredSeats={seatCount} onClick={() => { setSelectedSlot(selectedSlot?.id === sl.id ? null : sl); setSelectedSeatId(null); }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── FIXED WING ──────────────────────────────────────────────── */}
            {bookingKind === "fixed_wing" && (
              <div className="space-y-6">

                {/* One Way / Round Trip + Seats row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Trip type toggle */}
                  <div className="flex items-center gap-1 p-1 rounded-[8px] border border-neutral-200 bg-neutral-50">
                    {([["one_way","One Way"],["round_trip","Round Trip"]] as const).map(([val, label]) => (
                      <button key={val} type="button"
                        onClick={() => { setTripType(val); setFwReturnDate(""); }}
                        className={cn(
                          "px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all",
                          tripType === val ? "bg-white text-neutral-800 shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-700",
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>

                </div>

                {/* Origin/Destination combobox */}
                <div className="bg-white border-2 border-neutral-100 rounded-[10px] p-4">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">From</label>
                      <Combobox
                        options={origins}
                        value={fwOrigin}
                        onChange={(v) => { setFwOrigin(v); setFwDest(""); setFwDate(""); setFwFlight(null); }}
                        placeholder="Select origin"
                      />
                    </div>
                    <button type="button"
                      onClick={() => { const t = fwOrigin; setFwOrigin(fwDest); setFwDest(t); setFwDate(""); setFwFlight(null); }}
                      disabled={!fwOrigin || !fwDest}
                      className="mt-6 size-9 rounded-full border-2 border-neutral-200 bg-white flex items-center justify-center hover:border-[#8cc63f]/50 transition-colors disabled:opacity-30">
                      <RefreshCw className="size-3.5 text-neutral-500" />
                    </button>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">To</label>
                      <Combobox
                        options={fwDests}
                        value={fwDest}
                        onChange={(v) => { setFwDest(v); setFwDate(""); setFwFlight(null); }}
                        placeholder="Select destination"
                        disabled={!fwOrigin}
                      />
                    </div>
                  </div>
                </div>

                {/* Calendar */}
                {fwOrigin && fwDest && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-neutral-700">Select Date</p>
                    <FwCalendar availDates={fwAvailDates} priceByDate={fwPriceByDate} selectedDate={fwDate} onSelect={(d) => { setFwDate(d); setFwFlight(null); setSelectedSeatId(null); }} />
                  </div>
                )}

                {/* Outbound flights */}
                {fwDate && fwOrigin && fwDest && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-neutral-700">
                        {tripType === "round_trip" ? "Outbound Flights" : "Available Flights"}
                        <span className="text-neutral-400 font-mono font-normal ml-2">{fwDate}</span>
                      </p>
                      {fetchingFlights && <Loader2 className="size-4 animate-spin" style={{ color: BRAND }} />}
                    </div>
                    {!fetchingFlights && fwFlights.length === 0 && (
                      <div className="flex flex-col items-center py-10 border border-dashed border-neutral-200 rounded-[10px]">
                        <Plane className="size-8 text-neutral-200 mb-2" />
                        <p className="text-sm text-neutral-400">No flights on this date.</p>
                        <p className="text-xs text-neutral-300 mt-1">Try another date on the calendar.</p>
                      </div>
                    )}
                    {fwFlights.map(f => (
                      <FlightCard key={f.id} flight={f} isSelected={fwFlight?.id === f.id}
                        requiredSeats={seatCount} onClick={() => { setFwFlight(fwFlight?.id === f.id ? null : f); setSelectedSeatId(null); }} />
                    ))}
                  </div>
                )}

                {/* Round trip — return calendar */}
                {tripType === "round_trip" && fwFlight && (
                  <div className="rounded-[10px] border-2 border-dashed border-[#8cc63f]/30 bg-[#f0f9e8]/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="size-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: BRAND }}>↩</div>
                      <p className="text-sm font-semibold text-neutral-700">Select Return Date
                        <span className="text-neutral-400 font-normal text-xs ml-2">({fwDest} → {fwOrigin})</span>
                      </p>
                    </div>

                    {fwReturnAllFlights.length === 0 ? (
                      <p className="text-xs text-neutral-400 text-center py-4">No return flights available for this route.</p>
                    ) : (
                      <div className="bg-white rounded-[8px] border border-neutral-100 overflow-hidden">
                        <FwCalendar
                          availDates={fwReturnAvailDates}
                          priceByDate={fwReturnPriceByDate}
                          selectedDate={fwReturnDate}
                          onSelect={(d) => setFwReturnDate(d)}
                          minDate={fwDate}
                        />
                      </div>
                    )}

                    {/* Return flight selector — show after date picked */}
                    {fwReturnDate && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold text-neutral-600">
                          Return Flights — <span className="font-mono text-neutral-400">{fwReturnDate}</span>
                        </p>
                        {fetchingReturn && (
                          <div className="flex items-center gap-2 text-xs text-neutral-400 py-3">
                            <Loader2 className="size-3.5 animate-spin" /> Loading return flights…
                          </div>
                        )}
                        {!fetchingReturn && fwReturnDayFlights.length === 0 && (
                          <p className="text-xs text-neutral-400 text-center py-3">No return flights on this date.</p>
                        )}
                        {fwReturnDayFlights.map((f) => (
                          <FlightCard key={f.id} flight={f} isSelected={fwReturnFlight?.id === f.id}
                            requiredSeats={seatCount}
                            onClick={() => setFwReturnFlight(fwReturnFlight?.id === f.id ? null : f)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Continue btn */}
            <div className="pt-2">
              <button type="button"
                disabled={!canProceedToPassengers}
                onClick={() => setStep("passengers")}
                className={cn(
                  "flex items-center gap-2 px-8 py-3 rounded-[10px] text-sm font-semibold transition-all",
                  canProceedToPassengers ? "text-white" : "bg-neutral-100 text-neutral-400 cursor-not-allowed",
                )}
                style={canProceedToPassengers ? { background: CHARCOAL } : {}}>
                <ArrowRight className="size-4" />
                Continue to Passenger Details
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Passengers ────────────────────────────────────────────── */}
        {step === "passengers" && (
          <div className="space-y-6">
            <button onClick={() => setStep("search")} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600">
              <ArrowLeft className="size-3.5" /> Back to flight selection
            </button>

            {/* Flight summary */}
            <div className="bg-white rounded-[10px] border border-neutral-100 p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Selected Flight</p>
              {bookingKind === "helicopter" && selectedProduct && selectedSlot && (
                <div className="flex items-center gap-4 text-sm">
                  <Helicopter className="size-4 shrink-0" style={{ color: BRAND }} />
                  <div>
                    <p className="font-medium text-neutral-800">{selectedProduct.name}</p>
                    <p className="text-neutral-500 text-xs">{fmtDate(selectedSlot.scheduledDeparture)} · {fmtTime(selectedSlot.scheduledDeparture)} · {seatCount} seat{seatCount > 1 ? "s" : ""}</p>
                  </div>
                </div>
              )}
              {bookingKind === "fixed_wing" && fwFlight && (
                <div className="flex items-center gap-4 text-sm">
                  <Plane className="size-4 shrink-0" style={{ color: BRAND }} />
                  <div>
                    <p className="font-medium text-neutral-800">{fwFlight.origin} → {fwFlight.destination}</p>
                    <p className="text-neutral-500 text-xs">{fmtDate(fwFlight.scheduledDeparture)} · {fmtTime(fwFlight.scheduledDeparture)} · {seatCount} seat{seatCount > 1 ? "s" : ""}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(() => {
              if (seatMap && seatMap.seats.length > 0 && !selectedSeatId) {
                document.getElementById("seat-selection-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
              }
              setStep("confirm");
            })}>

              {/* Lead contact */}
              <div className="bg-white rounded-[10px] border border-neutral-100 p-5 mb-4">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Contact Information</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400" />
                      <input type="email" {...register("leadEmail")}
                        placeholder="you@example.com"
                        className={cn("w-full border-2 rounded-[8px] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors",
                          errors.leadEmail
                            ? "border-red-300 focus:border-red-400 focus:ring-red-200 bg-red-50/30"
                            : "border-neutral-200 focus:border-[#8cc63f]/50 focus:ring-[#8cc63f]/20")} />
                    </div>
                    {errors.leadEmail && (
                      <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                        <AlertCircle className="size-3 shrink-0" /> {errors.leadEmail.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400" />
                      {(() => { const { onChange: rhfOnChange, ...reg } = register("leadPhone"); return (
                        <input type="tel" {...reg}
                          onChange={(e) => { e.target.value = maskPhone(e.target.value); return rhfOnChange(e); }}
                          placeholder="+92 300 0000000"
                          className={cn("w-full border-2 rounded-[8px] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors",
                            errors.leadPhone
                              ? "border-red-300 focus:border-red-400 focus:ring-red-200 bg-red-50/30"
                              : "border-neutral-200 focus:border-[#8cc63f]/50 focus:ring-[#8cc63f]/20")} />
                      ); })()}
                    </div>
                    {errors.leadPhone && (
                      <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                        <AlertCircle className="size-3 shrink-0" /> {errors.leadPhone.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Passenger cards */}
              <div className="space-y-4">
                {fields.map((field, i) => {
                  const isLead = i === 0;
                  return (
                    <div key={field.id} className="bg-white rounded-[10px] border border-neutral-100 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: isLead ? BRAND : CHARCOAL }}>
                            {i + 1}
                          </div>
                          <p className="text-sm font-semibold text-neutral-700">
                            {isLead ? "Lead Passenger" : `Passenger ${i + 1}`}
                          </p>
                        </div>
                        {!isLead && (
                          <button type="button" onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-600">
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {([
                          ["firstName",      "First Name"],
                          ["lastName",       "Last Name"],
                          ["cnicOrPassport", "CNIC / Passport"],
                          ["nationality",    "Nationality"],
                        ] as const).map(([field_, label]) => {
                          const key = `passengers.${i}.${field_}` as const;
                          const err = errors.passengers?.[i]?.[field_];
                          return (
                            <div key={field_} className={field_ === "cnicOrPassport" ? "sm:col-span-2" : ""}>
                              <label className="block text-xs font-medium text-neutral-500 mb-1.5">{label} *</label>
                              {(() => { const { onChange: rhfOnChange, ...reg } = register(key); return (
                                <input type="text" {...reg}
                                  onChange={(e) => {
                                    if (field_ === "cnicOrPassport" && /^\d/.test(e.target.value)) {
                                      e.target.value = maskCnic(e.target.value);
                                    }
                                    return rhfOnChange(e);
                                  }}
                                  placeholder={field_ === "cnicOrPassport" ? "42201-1234567-1 or Passport No." : undefined}
                                  className={cn("w-full border-2 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/20 transition-colors",
                                    err ? "border-red-300 focus:border-red-400 bg-red-50/30" : "border-neutral-200 focus:border-[#8cc63f]/50")} />
                              ); })()}
                              {err && (
                                <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                  <AlertCircle className="size-3 shrink-0" />
                                  {err.message}
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {/* Date of Birth — shadcn DatePicker */}
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1.5">Date of Birth *</label>
                          <Controller
                            name={`passengers.${i}.dateOfBirth`}
                            control={control}
                            render={({ field, fieldState }) => (
                              <>
                                <DOBPicker value={field.value} onChange={field.onChange} hasError={!!fieldState.error} />
                                {fieldState.error && (
                                  <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                    <AlertCircle className="size-3 shrink-0" />
                                    {fieldState.error.message}
                                  </p>
                                )}
                              </>
                            )}
                          />
                        </div>
                      </div>
                      {/* Hidden field */}
                      <input type="hidden" {...register(`passengers.${i}.isLeadPassenger`)} value={String(isLead)} />
                    </div>
                  );
                })}
              </div>


              {/* Seat Selection */}
              {seatMap && seatMap.seats.length > 0 && (
                <div id="seat-selection-section" className={cn(
                  "mt-4 bg-white rounded-[10px] border p-5 transition-all",
                  !selectedSeatId ? "border-red-200" : "border-neutral-100",
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Select Your Seat <span className="text-red-400">*</span></p>
                    {!selectedSeatId && (
                      <span className="text-xs text-red-500 font-medium">Please select a seat to continue</span>
                    )}
                  </div>

                  {seatMap.lopaImageUrl ? (
                    /* ── Portal-style: fixed image left + seat panel right ── */
                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                      {/* LOPA image with overlaid circular seat buttons */}
                      <div className="relative shrink-0 select-none w-full sm:w-[200px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={seatMap.lopaImageUrl}
                          alt="Aircraft LOPA diagram"
                          className="w-full rounded-lg border border-neutral-200 shadow-sm"
                          draggable={false}
                        />
                        {seatMap.seats.map((seat) => {
                          if (seat.seatX == null || seat.seatY == null) return null;
                          const isSel = selectedSeatId === seat.id;
                          return (
                            <div
                              key={seat.id}
                              className="absolute -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${seat.seatX}%`, top: `${seat.seatY}%` }}
                            >
                              <button
                                type="button"
                                disabled={seat.isTaken}
                                onClick={() => setSelectedSeatId(isSel ? null : seat.id)}
                                title={seat.seatNumber}
                                className={cn(
                                  "flex items-center justify-center text-[10px] font-bold border-2 rounded-full w-7 h-7",
                                  "transition-all duration-150 focus:outline-none shadow-sm hover:scale-110",
                                  seat.isTaken
                                    ? "bg-neutral-300 border-neutral-400 text-neutral-500 cursor-not-allowed"
                                    : isSel
                                      ? "bg-[#8cc63f] border-[#5a8a20] text-white ring-2 ring-[#8cc63f]/40 scale-110"
                                      : "bg-white border-neutral-300 text-neutral-600 hover:border-[#8cc63f] cursor-pointer",
                                )}
                              >
                                {seat.seatNumber}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right panel: seat status list */}
                      <div className="flex-1 min-w-0 space-y-3">
                        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Seats</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[...seatMap.seats].sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)).map((seat) => {
                            const isSel = selectedSeatId === seat.id;
                            return (
                              <button
                                key={seat.id}
                                type="button"
                                disabled={seat.isTaken}
                                onClick={() => setSelectedSeatId(isSel ? null : seat.id)}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                  seat.isTaken
                                    ? "bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed"
                                    : isSel
                                      ? "bg-[#f0f9e8] border-[#8cc63f] text-[#5a8a20]"
                                      : "bg-white border-neutral-200 text-neutral-600 hover:border-[#8cc63f] hover:bg-[#f0f9e8]/50 cursor-pointer",
                                )}
                              >
                                <div className={cn(
                                  "size-2 rounded-full shrink-0",
                                  seat.isTaken ? "bg-neutral-400" : isSel ? "bg-[#8cc63f]" : "bg-neutral-300",
                                )} />
                                {seat.seatNumber}
                                {(seat.isTaken || isSel) && (
                                  <span className="ml-auto text-[10px] opacity-60">
                                    {seat.isTaken ? "Taken" : "✓"}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 text-[11px] text-neutral-400">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#8cc63f] bg-[#8cc63f] inline-block" /> Selected
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-neutral-300 bg-white inline-block" /> Available
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-full bg-neutral-300 inline-block" /> Taken
                          </span>
                        </div>
                        {selectedSeatId && (
                          <p className="text-xs font-semibold text-[#8cc63f]">
                            Seat {seatMap.seats.find(s => s.id === selectedSeatId)?.seatNumber} selected ✓
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ── No LOPA image: row/column grid fallback ── */
                    <>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {Array.from(new Set(seatMap.seats.map(s => s.row))).sort((a, b) => a - b).map(row => (
                          <div key={row} className="flex items-center gap-1.5">
                            <span className="text-[10px] text-neutral-300 w-4 text-right">{row}</span>
                            {seatMap.seats.filter(s => s.row === row).sort((a, b) => a.column.localeCompare(b.column)).map(seat => {
                              const isSel = selectedSeatId === seat.id;
                              return (
                                <button key={seat.id} type="button"
                                  disabled={seat.isTaken}
                                  onClick={() => setSelectedSeatId(isSel ? null : seat.id)}
                                  className={cn(
                                    "flex items-center justify-center text-[10px] font-bold border-2 rounded-full w-7 h-7",
                                    "transition-all duration-150 shadow-sm",
                                    seat.isTaken
                                      ? "bg-neutral-300 border-neutral-400 text-neutral-500 cursor-not-allowed"
                                      : isSel
                                        ? "bg-[#8cc63f] border-[#5a8a20] text-white ring-2 ring-[#8cc63f]/40"
                                        : "bg-white border-neutral-300 text-neutral-600 hover:border-[#8cc63f] hover:scale-110 cursor-pointer",
                                  )}>
                                  {seat.seatNumber}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-neutral-400 pt-3 border-t border-neutral-100">
                        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-[#8cc63f] bg-[#8cc63f] inline-block" /> Selected</span>
                        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-neutral-300 bg-white inline-block" /> Available</span>
                        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-neutral-300 inline-block" /> Taken</span>
                        {selectedSeatId && <span className="ml-auto text-[#8cc63f] font-semibold">Seat selected ✓</span>}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Submit */}
              {(() => {
                const seatRequired = !!(seatMap && seatMap.seats.length > 0 && !selectedSeatId);
                return (
                  <div className="pt-4 flex gap-3 items-center">
                    <button type="submit"
                      disabled={seatRequired}
                      className={cn(
                        "flex items-center gap-2 px-8 py-3 rounded-[10px] text-sm font-semibold transition-colors",
                        seatRequired
                          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                          : "text-white",
                      )}
                      style={seatRequired ? {} : { background: CHARCOAL }}>
                      <ArrowRight className="size-4" />
                      Review Booking
                    </button>
                    {seatRequired && (
                      <span className="text-xs text-red-500">Select a seat first</span>
                    )}
                  </div>
                );
              })()}
            </form>
          </div>
        )}

        {/* ── STEP: Confirm ────────────────────────────────────────────────── */}
        {step === "confirm" && (
          <div className="max-w-lg space-y-5">
            <button onClick={() => setStep("passengers")} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600">
              <ArrowLeft className="size-3.5" /> Back
            </button>

            {/* Summary */}
            <div className="bg-white rounded-[10px] border border-neutral-100 p-5">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">Booking Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Type</span>
                  <span className="font-medium text-neutral-800 capitalize">{bookingKind.replace("_", " ")}</span>
                </div>
                {bookingKind === "helicopter" && selectedProduct && selectedSlot && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Product</span>
                      <span className="font-medium text-neutral-800">{selectedProduct.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Date & Time</span>
                      <span className="font-medium text-neutral-800">{fmtDate(selectedSlot.scheduledDeparture)} · {fmtTime(selectedSlot.scheduledDeparture)}</span>
                    </div>
                  </>
                )}
                {bookingKind === "fixed_wing" && fwFlight && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Trip</span>
                      <span className="font-medium text-neutral-800">{tripType === "round_trip" ? "Round Trip" : "One Way"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Route</span>
                      <span className="font-medium text-neutral-800">{fwFlight.origin} → {fwFlight.destination}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Departure</span>
                      <span className="font-medium text-neutral-800">{fmtDate(fwFlight.scheduledDeparture)} · {fmtTime(fwFlight.scheduledDeparture)}</span>
                    </div>
                    {tripType === "round_trip" && fwReturnFlight && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Return</span>
                        <span className="font-medium text-neutral-800">{fwReturnDate} · {fwDest} → {fwOrigin}</span>
                      </div>
                    )}
                    {fwFlight.pricePerSeat != null && (
                      <div className="flex justify-between pt-1 border-t border-neutral-100">
                        <span className="text-neutral-500">Est. Price</span>
                        <span className="font-bold text-neutral-800">${Math.round(fwFlight.pricePerSeat * seatCount)} <span className="text-xs font-normal text-neutral-400">({seatCount} seat{seatCount > 1 ? "s" : ""})</span></span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Passengers</span>
                  <span className="font-medium text-neutral-800">{formDataPassengers.length}</span>
                </div>
                {(bookingKind === "helicopter" ? selectedSlot?.operatorName : fwFlight?.operatorName) && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Operator</span>
                    <span className="font-medium text-neutral-800 flex items-center gap-1">
                      {(bookingKind === "helicopter" ? selectedSlot?.operatorLogo : fwFlight?.operatorLogo) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={(bookingKind === "helicopter" ? selectedSlot?.operatorLogo : fwFlight?.operatorLogo)!} alt="" className="size-4 rounded object-cover" />
                      )}
                      {bookingKind === "helicopter" ? selectedSlot?.operatorName : fwFlight?.operatorName}
                    </span>
                  </div>
                )}
                {selectedSeatId && seatMap && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Seat</span>
                    <span className="font-medium text-neutral-800">
                      {seatMap.seats.find(s => s.id === selectedSeatId)?.seatNumber ?? '—'}
                    </span>
                  </div>
                )}
                {customer && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Account</span>
                    <span className="font-medium text-neutral-800">{customer.name} ({customer.email})</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs rounded-[8px] p-3">
                <AlertCircle className="size-3.5 shrink-0" /> {error}
              </div>
            )}

            <button type="button"
              disabled={confirmMut.isPending}
              onClick={() => {
                if (isLoggedIn) {
                  confirmMut.mutate(undefined);
                } else {
                  // Pre-fill email from passenger form
                  setOtpEmail(formDataLeadEmail || "");
                  setOtpName(formDataPassengers?.[0]
                    ? `${formDataPassengers[0].firstName} ${formDataPassengers[0].lastName}`.trim()
                    : "");
                  setOtpStep("email");
                  setOtpError("");
                  setShowOtpModal(true);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={{ background: CHARCOAL }}>
              {confirmMut.isPending
                ? <><Loader2 className="size-4 animate-spin" /> Reserving seats…</>
                : <><CreditCard className="size-4" /> Proceed to Payment</>
              }
            </button>
          </div>
        )}

        {/* ── STEP: Payment ──────────────────────────────────────────────────── */}
        {step === "payment" && pendingBooking && stripeClientSecret && (
          <div className="max-w-md space-y-5">
            {/* Hold timer in header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-700">Complete Payment</p>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">PNR: {pendingBooking.pnr}</p>
              </div>
              <HoldCountdown
                expiresAt={pendingBooking.holdExpiresAt}
                onExpired={() => {
                  // H-4: Don't wipe passenger data — preserve it, just return to search
                  setHoldExpiredMessage("Your seat hold has expired. Please select your flight again — your passenger details have been saved.");
                  setStep("search");
                }}
              />
            </div>

            <div className="bg-white rounded-[10px] border border-neutral-100 p-6">
              <Elements stripe={stripePromise ?? null} options={{
                clientSecret: stripeClientSecret,
                appearance: { theme: "stripe", variables: { colorPrimary: "#8cc63f", borderRadius: "8px" } },
              }}>
                <StripePaymentForm
                  amountUsd={pendingBooking.totalAmountUsd}
                  holdExpiresAt={pendingBooking.holdExpiresAt}
                  customerEmail={formDataLeadEmail}
                  onSuccess={handlePaymentSuccess}
                  onHoldExpired={() => {
                    // H-4: Preserve passenger data, show friendly message
                    setHoldExpiredMessage("Your seat hold has expired. Please select your flight again — your passenger details have been saved.");
                    setStep("search");
                  }}
                />
              </Elements>
            </div>
          </div>
        )}
      </div>

      {/* ── OTP Modal — shown before payment if not logged in ───────────────── */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-[16px] w-full max-w-sm shadow-2xl p-7 relative">
            <button onClick={() => setShowOtpModal(false)}
              className="absolute right-4 top-4 text-neutral-300 hover:text-neutral-500">
              <XIcon className="size-4" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#f0f9e8" }}>
                <Mail className="size-5" style={{ color: BRAND }} />
              </div>
              <h2 className="text-base font-semibold text-neutral-800">
                {otpStep === "email" ? "Verify your email to continue" : "Enter your code"}
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                {otpStep === "email" ? "A one-time code will be sent to your email" : `Code sent to ${otpEmail}`}
              </p>
            </div>

            {otpError && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs rounded-[8px] p-3 mb-4">
                <AlertCircle className="size-3.5 shrink-0" /> {otpError}
              </div>
            )}

            {otpStep === "email" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5">Full Name</label>
                  <input type="text" value={otpName} onChange={e => setOtpName(e.target.value)}
                    placeholder="Ali Khan"
                    className="w-full border-2 border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:border-[#8cc63f]/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5">Email Address</label>
                  <input type="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border-2 border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:border-[#8cc63f]/50" />
                </div>
                <button type="button"
                  disabled={!otpEmail || !otpName || requestOtpMut.isPending}
                  onClick={() => requestOtpMut.mutate()}
                  className="w-full py-3 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: BRAND }}>
                  {requestOtpMut.isPending ? "Sending…" : "Send Code"}
                </button>
                <p className="text-center text-[10px] text-neutral-300">No password needed — secure one-time code</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5">6-Digit Code</label>
                  <input type="text" value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" maxLength={6} autoFocus
                    className="w-full border-2 border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-[#8cc63f]/50" />
                </div>
                <button type="button"
                  disabled={otpCode.length !== 6 || verifyOtpMut.isPending}
                  onClick={() => verifyOtpMut.mutate()}
                  className="w-full py-3 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50"
                  style={{ background: BRAND }}>
                  {verifyOtpMut.isPending ? "Verifying…" : "Verify & Book"}
                </button>
                {/* H-2: Resend code button with cooldown */}
                <button type="button"
                  disabled={resendCooldown > 0 || requestOtpMut.isPending}
                  onClick={handleResendOtp}
                  className="w-full text-xs text-neutral-400 hover:text-neutral-600 py-1 disabled:opacity-50">
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
                <button type="button" onClick={() => { setOtpStep("email"); setOtpCode(""); setOtpError(""); }}
                  className="w-full text-xs text-neutral-400 hover:text-neutral-600 py-1">
                  Use a different email
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

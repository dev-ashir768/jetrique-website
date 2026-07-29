"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plane, Helicopter, CheckCircle, ArrowRight, ArrowLeft,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw, ArrowLeftRight,
  Clock, Mail, Check, Phone, ChevronDown, Search, X as XIcon,
  CreditCard, Plus, Minus, CalendarDays,
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
  type PublicProduct, type ProductSlot, type PublicFlight, type CityAirportGroup, type Nationality,
} from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerStore";
import { maskPhone, maskCnic } from "@/lib/utils/input-mask";
import { getPassengerTypeFromDob, type PassengerAgeType } from "@/lib/passengerAge";

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

type Step = "search" | "passengers" | "addons" | "seats" | "confirm" | "payment";

const STEPS: { key: Step; label: string }[] = [
  { key: "search",     label: "Select Flight" },
  { key: "passengers", label: "Passengers"    },
  { key: "addons",     label: "Add-ons"       },
  { key: "seats",      label: "Seats"         },
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
  options, value, onChange, placeholder, disabled, padStart, hideChevron, buttonClassName, buttonStyle,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  padStart?: boolean;
  hideChevron?: boolean;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
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
        style={buttonStyle}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-sm rounded-[8px] border-2 py-[9px] transition-all bg-white",
          padStart ? "pl-5 pr-3" : "px-3",
          disabled ? "border-neutral-200 text-neutral-400 cursor-not-allowed opacity-50"
            : open ? "border-[#8cc63f] text-neutral-800"
            : value ? "border-neutral-200 text-neutral-800 hover:border-[#8cc63f]/50"
            : "border-neutral-200 text-neutral-400 hover:border-[#8cc63f]/50",
          buttonClassName,
        )}>
        <span className={cn("font-medium truncate", !value && "font-normal")}>{value || placeholder || "Select…"}</span>
        {!hideChevron && <ChevronDown className={cn("size-4 shrink-0 transition-transform text-neutral-400", open && "rotate-180")} />}
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

// ── NationalityCombobox ────────────────────────────────────────────────────────

function NationalityCombobox({
  nationalities, value, onChange, hasError,
}: {
  nationalities: Nationality[];
  value: number;
  onChange: (id: number, code: string) => void;
  hasError?: boolean;
}) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected  = nationalities.find((n) => n.id === value);
  const filtered  = useMemo(
    () => query
      ? nationalities.filter((n) => n.name.toLowerCase().includes(query.toLowerCase()) || n.code.toLowerCase().includes(query.toLowerCase()))
      : nationalities,
    [nationalities, query],
  );

  function select(n: Nationality) {
    onChange(n.id, n.code);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-sm rounded-[8px] border-2 px-3 py-[9px] bg-white transition-all",
          hasError  ? "border-red-300 bg-red-50/30"
            : open ? "border-[#8cc63f]"
            : selected ? "border-neutral-200 hover:border-[#8cc63f]/50"
            : "border-neutral-200 hover:border-[#8cc63f]/50",
        )}>
        <span className={cn("truncate text-sm", selected ? "text-neutral-800 font-medium" : "text-neutral-400 font-normal")}>
          {selected ? `${selected.flag ?? ""} ${selected.name}`.trim() : "Select nationality…"}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-neutral-200 rounded-[10px] shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-100">
            <div className="flex items-center gap-2 bg-neutral-50 rounded-[6px] px-2.5 py-1.5">
              <Search className="size-3.5 text-neutral-400 shrink-0" />
              <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search nationality…"
                className="flex-1 bg-transparent text-xs outline-none text-neutral-700 placeholder:text-neutral-400" />
              {query && (
                <button type="button" onClick={() => setQuery("")}>
                  <XIcon className="size-3 text-neutral-400 hover:text-neutral-600" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-neutral-400 text-center">No results</p>
            ) : filtered.map((n) => (
              <button key={n.id} type="button" onClick={() => select(n)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2",
                  value === n.id ? "bg-[#f0f9e8] text-[#8cc63f] font-medium" : "text-neutral-700 hover:bg-neutral-50",
                )}>
                <span>{n.flag ? `${n.flag} ` : ""}{n.name}</span>
                {value === n.id && <Check className="size-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AirportCombobox — city header + nested airports (Google Flights style) ────

function AirportCombobox({
  groups, allowedAirportNames, value, onChange, placeholder, disabled, padStart, hideChevron, buttonClassName,
}: {
  groups: CityAirportGroup[];
  allowedAirportNames?: Set<string>; // restrict to airports valid for the current route graph (e.g. destinations)
  value: string; // selected airport NAME (matches Route.origin/destination)
  onChange: (airportName: string) => void;
  placeholder?: string;
  disabled?: boolean;
  padStart?: boolean;
  hideChevron?: boolean;
  buttonClassName?: string;
}) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        airports: g.airports.filter((a) => {
          if (allowedAirportNames && !allowedAirportNames.has(a.name)) return false;
          if (!q) return true;
          return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || g.cityName.toLowerCase().includes(q);
        }),
      }))
      .filter((g) => g.airports.length > 0);
  }, [groups, query, allowedAirportNames]);

  let selectedAirportName = "";
  let selectedCityName    = "";
  for (const g of groups) {
    const match = g.airports.find((a) => a.name === value);
    if (match) { selectedAirportName = match.name; selectedCityName = g.cityName; break; }
  }

  function select(airportName: string) {
    onChange(airportName);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-sm rounded-[8px] border-2 py-[9px] transition-all bg-white",
          padStart ? "pl-5 pr-3" : "px-3",
          disabled ? "border-neutral-200 text-neutral-400 cursor-not-allowed opacity-50"
            : open ? "border-[#8cc63f] text-neutral-800"
            : value ? "border-neutral-200 text-neutral-800 hover:border-[#8cc63f]/50"
            : "border-neutral-200 text-neutral-400 hover:border-[#8cc63f]/50",
          buttonClassName,
        )}>
        <span className={cn("font-medium truncate text-left flex items-baseline gap-1", !value && "font-normal")}>
          {selectedCityName ? (
            <>
              <span className="truncate">{selectedCityName}</span>
              <span className="text-[10px] text-neutral-400 font-mono shrink-0">{groups.flatMap((g) => g.airports).find((a) => a.name === selectedAirportName)?.code}</span>
            </>
          ) : (placeholder || "Select…")}
        </span>
        {!hideChevron && <ChevronDown className={cn("size-4 shrink-0 transition-transform text-neutral-400", open && "rotate-180")} />}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[260px] bg-white border border-neutral-200 rounded-[10px] shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-100">
            <div className="flex items-center gap-2 bg-neutral-50 rounded-[6px] px-2.5 py-1.5">
              <Search className="size-3.5 text-neutral-400 shrink-0" />
              <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city or airport…"
                className="flex-1 bg-transparent text-xs outline-none text-neutral-700 placeholder:text-neutral-400" />
              {query && <button type="button" onClick={() => setQuery("")}><XIcon className="size-3 text-neutral-400 hover:text-neutral-600" /></button>}
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filteredGroups.length === 0 ? (
              <p className="px-3 py-4 text-xs text-neutral-400 text-center">No results</p>
            ) : filteredGroups.map((g) => (
              <div key={g.cityId}>
                <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">{g.cityName}</span>
                  <span className="text-[10px] text-neutral-300">· {g.province}</span>
                </div>
                {g.airports.map((a) => (
                  <button key={a.id} type="button" onClick={() => select(a.name)}
                    className={cn(
                      "w-full text-left pl-6 pr-3 py-2 text-sm transition-colors flex items-center justify-between gap-2",
                      value === a.name ? "bg-[#f0f9e8] text-[#8cc63f] font-medium" : "text-neutral-700 hover:bg-neutral-50",
                    )}>
                    <span className="flex items-center gap-2 truncate">
                      <Plane className="size-3.5 shrink-0 text-neutral-400" />
                      <span className="truncate">{a.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono shrink-0">{a.code}</span>
                    </span>
                    {value === a.name && <Check className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MiniDropdown (for search bar chips) ───────────────────────────────────────

function MiniDropdown<T extends string>({
  icon, value, options, onChange, disabled,
}: {
  icon?:    React.ReactNode;
  value:    string;
  options:  { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 px-3 h-9 rounded-[8px] text-xs font-medium border transition-all",
          disabled
            ? "border-neutral-100 text-neutral-300 bg-neutral-50 cursor-not-allowed"
            : "border-neutral-200 text-neutral-700 bg-white hover:border-[#8cc63f]/60",
        )}>
        {icon && <span className="text-neutral-500">{icon}</span>}
        <span>{value}</span>
        <ChevronDown className={cn("size-3.5 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 min-w-[160px] bg-white border border-neutral-200 rounded-[10px] shadow-lg overflow-hidden py-1">
          {options.map((o) => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2",
                value === o.label ? "bg-[#f0f9e8] text-[#8cc63f] font-medium" : "text-neutral-700 hover:bg-neutral-50",
              )}>
              {o.label}
              {value === o.label && <Check className="size-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Passenger Counter Dropdown ────────────────────────────────────────────────

function PaxDropdown({
  value, onChange, max = 9,
}: {
  value:    { adults: number; children: number; infants: number };
  onChange: (v: { adults: number; children: number; infants: number }) => void;
  max?:     number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const total = value.adults + value.children + value.infants;

  const rows: { key: keyof typeof value; label: string; sub: string; min: number }[] = [
    { key: "adults",   label: "Adults",   sub: "Age 12+",  min: 1 },
    { key: "children", label: "Children", sub: "Age 2-12", min: 0 },
    { key: "infants",  label: "Infants",  sub: "Under 2",  min: 0 },
  ];

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 h-9 rounded-[8px] text-xs font-medium border border-neutral-200 text-neutral-700 bg-white hover:border-[#8cc63f]/60 transition-all">
        <span className="text-neutral-500">👤</span>
        <span>{total} {total === 1 ? "Passenger" : "Passengers"}</span>
        <ChevronDown className={cn("size-3.5 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 min-w-[280px] bg-white border border-neutral-200 rounded-[10px] shadow-lg p-3 space-y-2">
          {rows.map((r) => {
            const v = value[r.key];
            return (
              <div key={r.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{r.label}</p>
                  <p className="text-[10px] text-neutral-400">{r.sub}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={v <= r.min}
                    onClick={() => onChange({ ...value, [r.key]: Math.max(r.min, v - 1) })}
                    className="size-7 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-[#8cc63f]/60 disabled:opacity-30 disabled:cursor-not-allowed">
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-neutral-800 tabular-nums">{v}</span>
                  <button type="button" disabled={total >= max}
                    onClick={() => onChange({ ...value, [r.key]: v + 1 })}
                    className="size-7 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-[#8cc63f]/60 disabled:opacity-30 disabled:cursor-not-allowed">
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={() => setOpen(false)}
            className="mt-2 w-full text-xs font-semibold text-white py-2 rounded-[8px]"
            style={{ background: BRAND }}>
            Done
          </button>
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
  const dur      = fmtDuration(flight.scheduledDeparture, flight.scheduledArrival);
  const hasSeats = flight.availableSeats >= requiredSeats;
  return (
    <button type="button" onClick={onClick} disabled={!hasSeats}
      className={cn(
        "group w-full text-left rounded-[12px] border transition-all",
        !hasSeats && "opacity-40 cursor-not-allowed",
        isSelected
          ? "border-[#8cc63f] bg-[#f0f9e8] shadow-sm"
          : "border-neutral-200 bg-white hover:border-[#8cc63f]/60 hover:shadow-sm",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4">
        {/* Operator logo */}
        <div className="size-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
          {flight.operatorLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flight.operatorLogo} alt="" className="size-full object-cover" />
          ) : (
            <Plane className="size-4 text-neutral-400" />
          )}
        </div>

        {/* Times + route */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-neutral-900 tabular-nums">{fmtTime(flight.scheduledDeparture)}</span>
            <span className="text-neutral-300">–</span>
            <span className="text-base font-semibold text-neutral-900 tabular-nums">
              {flight.scheduledArrival ? fmtTime(flight.scheduledArrival) : "—"}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {flight.operatorName ?? "Jetrique"} · {flight.origin} → {flight.destination}
          </p>
        </div>

        {/* Duration + stops */}
        <div className="hidden sm:block text-right shrink-0 min-w-[90px]">
          <p className="text-sm font-medium text-neutral-700">{dur ?? "—"}</p>
          <p className="text-[11px] text-neutral-400">Non-stop</p>
        </div>

        {/* Price / seat pill */}
        <div className="text-right shrink-0 col-start-3 sm:col-start-auto flex flex-col items-end gap-1">
          {flight.pricePerSeat != null ? (
            <p className="text-lg font-bold text-neutral-900 tabular-nums">${Math.round(flight.pricePerSeat)}</p>
          ) : (
            <p className="text-xs text-neutral-400">On request</p>
          )}
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            flight.availableSeats > 3 ? "bg-[#f0f9e8] text-[#8cc63f]" :
            flight.availableSeats > 0 ? "bg-amber-50 text-amber-600" :
            "bg-red-50 text-red-500",
          )}>
            {flight.availableSeats === 0 ? "Full" : `${flight.availableSeats} seats`}
          </span>
        </div>
      </div>

      {/* Meta strip */}
      <div className="px-4 py-2 border-t border-neutral-100 flex items-center flex-wrap gap-2 text-[11px] text-neutral-400 bg-neutral-50/60 rounded-b-[12px]">
        <span className="font-mono">{flight.flightNumber || flight.slotCode}</span>
        <span>· {flight.aircraft.name}</span>
        {flight.aircraft.registrationNo && <span>· {flight.aircraft.registrationNo}</span>}
        {flight.distanceNm && <span>· {flight.distanceNm} NM</span>}
        {isSelected && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ background: BRAND }}>
            <Check className="size-3" /> Selected
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
  const dur      = fmtDuration(slot.scheduledDeparture, slot.scheduledArrival);
  const hasSeats = slot.availableSeats >= requiredSeats;
  return (
    <button type="button" onClick={onClick} disabled={!hasSeats}
      className={cn(
        "group w-full text-left rounded-[12px] border transition-all",
        !hasSeats && "opacity-40 cursor-not-allowed",
        isSelected
          ? "border-[#8cc63f] bg-[#f0f9e8] shadow-sm"
          : "border-neutral-200 bg-white hover:border-[#8cc63f]/60 hover:shadow-sm",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4">
        <div className="size-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
          {slot.operatorLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slot.operatorLogo} alt="" className="size-full object-cover" />
          ) : (
            <Helicopter className="size-4 text-neutral-400" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-neutral-900 tabular-nums">{fmtTime(slot.scheduledDeparture)}</span>
            {slot.scheduledArrival && (
              <>
                <span className="text-neutral-300">–</span>
                <span className="text-base font-semibold text-neutral-900 tabular-nums">{fmtTime(slot.scheduledArrival)}</span>
              </>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {slot.operatorName ?? "Jetrique"} · {slot.aircraft.name}
          </p>
        </div>
        <div className="hidden sm:block text-right shrink-0 min-w-[90px]">
          <p className="text-sm font-medium text-neutral-700">{dur ?? "—"}</p>
          <p className="text-[11px] text-neutral-400">Non-stop</p>
        </div>
        <div className="text-right shrink-0 col-start-3 sm:col-start-auto flex flex-col items-end gap-1">
          {slot.pricePerSeat != null ? (
            <p className="text-lg font-bold text-neutral-900 tabular-nums">${Math.round(slot.pricePerSeat)}</p>
          ) : (
            <p className="text-xs text-neutral-400">On request</p>
          )}
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            slot.availableSeats > 3 ? "bg-[#f0f9e8] text-[#8cc63f]" :
            slot.availableSeats > 0 ? "bg-amber-50 text-amber-600" :
            "bg-red-50 text-red-500",
          )}>
            {slot.availableSeats === 0 ? "Full" : `${slot.availableSeats}/${slot.aircraft.saleableSeats} seats`}
          </span>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-neutral-100 flex items-center flex-wrap gap-2 text-[11px] text-neutral-400 bg-neutral-50/60 rounded-b-[12px]">
        <span className="font-mono">{slot.flightNumber || slot.slotCode}</span>
        {isSelected && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ background: BRAND }}>
            <Check className="size-3" /> Selected
          </span>
        )}
      </div>
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

const PASSENGER_TITLES = ["MR", "MRS", "MS", "MASTER", "MISS"] as const;
type PaxType  = PassengerAgeType; // "ADULT" | "CHILD" | "INFANT" — derived from dateOfBirth, never chosen directly
type PaxTitle = typeof PASSENGER_TITLES[number];

const passengerSchema = z.object({
  firstName:       z.string().min(1, "First name is required"),
  lastName:        z.string().min(1, "Last name is required"),
  title:           z.enum(PASSENGER_TITLES).optional().nullable(),
  cnicOrPassport:  z.string().default(""),
  guardianCnic:    z.string().default(""),
  dateOfBirth:     z.string().min(1, "Date of birth is required").refine((v) => {
    const d = new Date(v); return !isNaN(d.getTime()) && d < new Date();
  }, "Enter a valid past date"),
  nationalityId:   z.number().int().positive("Nationality is required"),
  nationalityCode: z.string().length(2),
  contactEmail:    z.string().default(""),
  contactPhone:    z.string().default(""),
  isLeadPassenger: z.boolean(),
}).superRefine((p, ctx) => {
  const isPk   = p.nationalityCode === "PK";
  const dob    = new Date(p.dateOfBirth);
  const type   = isNaN(dob.getTime()) ? "ADULT" : getPassengerTypeFromDob(dob);
  const isMinor = type === "CHILD" || type === "INFANT";

  if (isPk && isMinor) {
    // Domestic infant/child — no document of their own, travel on parent/guardian's CNIC
    const guardian = (p.guardianCnic ?? "").trim();
    if (!guardian) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianCnic"], message: "Parent/Guardian CNIC is required" });
    } else if (!/^\d{5}-\d{7}-\d$/.test(guardian)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianCnic"], message: "Enter a valid CNIC (42201-1234567-1)" });
    }
  } else {
    const doc = (p.cnicOrPassport ?? "").trim();
    if (!doc) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cnicOrPassport"],
        message: isPk ? "CNIC is required" : "Passport number is required" });
    } else if (isPk && !/^\d{5}-\d{7}-\d$/.test(doc)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cnicOrPassport"],
        message: "Enter a valid CNIC (42201-1234567-1)" });
    } else if (!isPk && !/^[A-Z0-9]{6,20}$/i.test(doc)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cnicOrPassport"],
        message: "Enter a valid passport number" });
    }
  }
  if ((type === "ADULT" || type === "CHILD") && !p.title) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["title"], message: "Title is required" });
  }
  // Lead passenger contact — enforce the same rules the backend does so users get
  // instant feedback instead of a 400 at submit time.
  if (p.isLeadPassenger) {
    if (!p.contactEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.contactEmail)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contactEmail"], message: "Lead passenger email is required" });
    }
    const phone = (p.contactPhone ?? "").trim();
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contactPhone"], message: "Phone number is required" });
    } else if (isPk) {
      if (!PK_PHONE_RE.test(phone.replace(/[\s\-()+]/g, "").replace(/^92/, "0"))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contactPhone"], message: "Enter a valid Pakistani mobile number (e.g. 0312 3456789)" });
      }
    } else {
      if (!INTL_PHONE_RE.test(phone)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contactPhone"], message: "Enter a valid international phone number (e.g. +1 415 555 0100)" });
      }
    }
  }
});
const PK_PHONE_RE   = /^(\+92|0092|0)3[0-9]{9}$/;
const INTL_PHONE_RE = /^\+?[0-9\s\-(). ]{7,20}$/;

const formSchema = z.object({
  passengers: z.array(passengerSchema).min(1),
}).superRefine((val, ctx) => {
  const leads = val.passengers.filter((p) => p.isLeadPassenger).length;
  if (leads !== 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "One lead passenger required", path: ["passengers"] });

  // Duplicate CNIC/Passport check — guardianCnic is intentionally excluded, since a parent's own
  // CNIC is expected to reappear as their infant/child's guardianCnic in the same booking.
  const seen = new Map<string, number>();
  val.passengers.forEach((p, i) => {
    const key = (p.cnicOrPassport ?? "").replace(/\D/g, "").toLowerCase();
    if (!key) return;
    if (seen.has(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "This passenger has already been added to the booking. Please enter different passenger details.", path: ["passengers", i, "cnicOrPassport"] });
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "This passenger has already been added to the booking. Please enter different passenger details.", path: ["passengers", seen.get(key)!, "cnicOrPassport"] });
    } else {
      seen.set(key, i);
    }
  });
});
type BookingForm = z.infer<typeof formSchema>;
type PaxCounts   = { adults: number; children: number; infants: number };

// ── Main Page ─────────────────────────────────────────────────────────────────

const FORM_DRAFT_KEY   = "jetrique_book_draft";
const FLIGHT_DRAFT_KEY = "jetrique_flight_draft";

export default function BookPage() {
  const router = useRouter();
  const { isLoggedIn, token, customer, login } = useCustomerAuth();
  const queryClient = useQueryClient();

  // ── State ─────────────────────────────────────────────────────────────────

  const topRef = useRef<HTMLDivElement>(null);
  function goToStep(s: Step) {
    setStep(s);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const [step,         setStep]         = useState<Step>("search");
  const [bookingKind,  setBookingKind]  = useState<"helicopter" | "fixed_wing">("helicopter");
  const [tripType,     setTripType]     = useState<"one_way" | "round_trip">("one_way");
  const [paxCounts, setPaxCounts] = useState<PaxCounts>({ adults: 1, children: 0, infants: 0 });
  // Every passenger occupies a seat (infants included) — no lap-infant concept anymore.
  const passengerCount = paxCounts.adults + paxCounts.children + paxCounts.infants;
  const seatCount      = passengerCount;
  const [shareContact, setShareContact] = useState<boolean>(true);
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

  // Restore flight draft on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(FLIGHT_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        bookingKind?: string; tripType?: string;
        paxCounts?: PaxCounts;
        fwOrigin?: string; fwDest?: string; fwDate?: string; fwReturnDate?: string;
        fwFlight?: PublicFlight | null; fwReturnFlight?: PublicFlight | null;
        selectedProduct?: PublicProduct | null; helDate?: string; selectedSlot?: ProductSlot | null;
      };
      if (d.bookingKind === "helicopter" || d.bookingKind === "fixed_wing") setBookingKind(d.bookingKind);
      if (d.tripType === "one_way" || d.tripType === "round_trip") setTripType(d.tripType);
      if (d.paxCounts && typeof d.paxCounts.infants === "number") setPaxCounts(d.paxCounts);
      if (d.fwOrigin)      setFwOrigin(d.fwOrigin);
      if (d.fwDest)        setFwDest(d.fwDest);
      if (d.fwDate)        setFwDate(d.fwDate);
      if (d.fwReturnDate)  setFwReturnDate(d.fwReturnDate);
      if (d.fwFlight)      setFwFlight(d.fwFlight);
      if (d.fwReturnFlight) setFwReturnFlight(d.fwReturnFlight);
      if (d.selectedProduct) setSelectedProduct(d.selectedProduct);
      if (d.helDate)       setHelDate(d.helDate);
      if (d.selectedSlot)  setSelectedSlot(d.selectedSlot);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist flight draft on every change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(FLIGHT_DRAFT_KEY, JSON.stringify({
        bookingKind, tripType, paxCounts,
        fwOrigin, fwDest, fwDate, fwReturnDate, fwFlight, fwReturnFlight,
        selectedProduct, helDate, selectedSlot,
      }));
    } catch { /* ignore */ }
  }, [bookingKind, tripType, paxCounts, fwOrigin, fwDest, fwDate, fwReturnDate, fwFlight, fwReturnFlight, selectedProduct, helDate, selectedSlot]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [pendingBooking, setPendingBooking] = useState<{
    bookingId: string; pnr: string; holdExpiresAt: string; totalAmountUsd: number;
    pricing?: { farePerPassenger?: number; passengerCount: number; baseFareUsd: number; addOnsTotalUsd: number; totalAmountUsd: number };
  } | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [confirmedPnr, setConfirmedPnr] = useState("");
  const [paymentOutcome, setPaymentOutcome] = useState<"confirmed" | "processing" | "failed" | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: helProducts = [], isLoading: loadHel } = useQuery({
    queryKey: ["public-hel-products"],
    queryFn:  () => publicApi.getProducts({ productType: "HELICOPTER" }),
  });

  // Fixed-wing: airports grouped by city, for the origin/destination combobox
  const { data: airportGroups = [] } = useQuery<CityAirportGroup[]>({
    queryKey: ["public-airports-grouped"],
    queryFn:  () => publicApi.getAirportsGrouped(),
    staleTime: 10 * 60_000,
  });

  const { data: nationalities = [] } = useQuery<Nationality[]>({
    queryKey: ["nationalities"],
    queryFn:  () => publicApi.getNationalities(token!),
    enabled:  !!token,
    staleTime: 60 * 60_000,
  });

  // Fixed-wing: route graph to constrain valid origin→destination pairs
  const { data: fwRoutes = [] } = useQuery({
    queryKey: ["public-routes-fw"],
    queryFn:  () => publicApi.getRoutes(),
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

  // Fetch all flights for origin+dest; filter by selected date for display
  const { data: fwAllFlights = [], isFetching: fetchingFlights } = useQuery({
    queryKey: ["fw-flights-all", fwOrigin, fwDest],
    queryFn:  () => publicApi.searchFlights({ origin: fwOrigin, destination: fwDest }),
    enabled:  !!fwOrigin && !!fwDest && bookingKind === "fixed_wing",
    staleTime: 5 * 60_000,
  });
  const fwFlights = useMemo(
    () => fwDate ? fwAllFlights.filter(f => f.scheduledDeparture.startsWith(fwDate)) : [],
    [fwAllFlights, fwDate],
  );
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

  const emptyPassenger = (isLead: boolean) => ({
    firstName: "", lastName: "", cnicOrPassport: "", guardianCnic: "", dateOfBirth: "", nationalityId: 0, nationalityCode: "",
    contactEmail: "", contactPhone: "", isLeadPassenger: isLead,
    title: null as PaxTitle | null,
  });

  const { register, control, handleSubmit, formState: { errors }, setValue, getValues } = useForm<BookingForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    mode: "onBlur",
    defaultValues: (() => {
      const seed = { passengers: [emptyPassenger(true)] };
      if (typeof window === "undefined") return seed;
      try {
        const saved = localStorage.getItem(FORM_DRAFT_KEY);
        if (saved) {
          const raw = JSON.parse(saved) as unknown;
          const result = formSchema.safeParse(raw);
          if (result.success) return result.data;
        }
      } catch { /* ignore */ }
      return seed;
    })(),
  });

  const { fields, replace } = useFieldArray({ control, name: "passengers" });

  // Sync passenger cards with paxCounts. Adds/removes cards while preserving entered values.
  // Passenger type is derived from DOB, not stored — so existing cards are matched to the
  // desired bucket by their *current* computed type (via DOB), not a stored label.
  useEffect(() => {
    const desired: PaxType[] = [
      ...Array(paxCounts.adults).fill("ADULT"),
      ...Array(paxCounts.children).fill("CHILD"),
      ...Array(paxCounts.infants).fill("INFANT"),
    ] as PaxType[];
    if (desired.length === 0) return;

    const current = getValues("passengers");
    const departure = fwFlight?.scheduledDeparture ?? selectedSlot?.scheduledDeparture;
    const refDate   = departure ? new Date(departure) : new Date();
    const byType: Record<PaxType, typeof current> = { ADULT: [], CHILD: [], INFANT: [] };
    for (const p of current) {
      const d = new Date(p.dateOfBirth);
      const type: PaxType = p.dateOfBirth && !isNaN(d.getTime()) ? getPassengerTypeFromDob(d, refDate) : "ADULT";
      byType[type].push(p);
    }

    const next = desired.map((type, idx) => {
      const existing = byType[type].shift();
      const isLead = idx === 0;
      if (existing) return { ...existing, isLeadPassenger: isLead };
      return emptyPassenger(isLead);
    });
    replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paxCounts.adults, paxCounts.children, paxCounts.infants]);

  const activeSlotId = bookingKind === "helicopter" ? selectedSlot?.id : fwFlight?.id;
  const activeQuoteId = bookingKind === "helicopter" ? selectedSlot?.quoteId : fwFlight?.quoteId;
  const canProceedToPassengers = !!activeSlotId;

  // Add-on selection: addOnId → quantity
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});

  function setAddOnQty(addOnId: string, qty: number) {
    setSelectedAddOns((prev) => {
      if (qty <= 0) { const next = { ...prev }; delete next[addOnId]; return next; }
      return { ...prev, [addOnId]: qty };
    });
  }

  // Seat selection
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const toggleSeat = (id: string) => {
    setSelectedSeatIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= passengerCount) return prev; // cap at seats needed
      return [...prev, id];
    });
  };

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

  const passengersJson = JSON.stringify(formDataPassengers);

  // Persist form draft so a page refresh doesn't wipe the passenger details
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify({ passengers: formDataPassengers }));
    } catch { /* ignore */ }
  }, [passengersJson]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmMut = useMutation({
    mutationFn: async (freshToken?: string) => {
      const t = freshToken ?? token!;
      const lead = formDataPassengers.find((p) => p.isLeadPassenger);
      const leadEmail = lead?.contactEmail ?? "";
      const leadPhone = lead?.contactPhone ?? "";
      const paxList = formDataPassengers.map((p) => ({
        firstName:       p.firstName,
        lastName:        p.lastName,
        cnicOrPassport:  p.cnicOrPassport ?? "",
        guardianCnic:    p.guardianCnic ?? "",
        dateOfBirth:     p.dateOfBirth,
        nationalityId:   p.nationalityId,
        nationalityCode: p.nationalityCode,
        isLeadPassenger: p.isLeadPassenger,
        title:           (p.title ?? null) as "MR" | "MRS" | "MS" | "MASTER" | "MISS" | null,
        contactEmail:    p.isLeadPassenger ? leadEmail : shareContact ? leadEmail : (p.contactEmail ?? ""),
        contactPhone:    p.isLeadPassenger ? leadPhone : shareContact ? leadPhone : (p.contactPhone ?? ""),
      }));

      const addOnsPayload = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([addOnId, quantity]) => ({ addOnId, quantity }));

      // 1. Create outbound booking
      const booking = await publicApi.createBooking(t, {
        slotId:     activeSlotId!,
        passengers: paxList,
        phone:      leadPhone,
        ...(selectedSeatIds.length > 0 ? { seatIds: selectedSeatIds } : {}),
        ...(activeQuoteId ? { quoteId: activeQuoteId } : {}),
        ...(addOnsPayload.length > 0 ? { addOns: addOnsPayload } : {}),
      });

      // 2. Create return booking if round-trip and flight selected
      if (tripType === "round_trip" && fwReturnFlight) {
        try {
          await publicApi.createBooking(t, {
            slotId:     fwReturnFlight.id,
            passengers: paxList,
            phone:      leadPhone,
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
      setPendingBooking({ pricing: booking.pricing,
        bookingId:     booking.bookingId,
        pnr:           booking.pnr,
        holdExpiresAt: booking.holdExpiresAt,
        totalAmountUsd: booking.totalAmountUsd,
      });
      setStripeClientSecret(pi.clientSecret);
      goToStep("payment");
    },
    onError: (e: Error) => setError(e.message),
  });

  async function handlePaymentSuccess() {
    if (!pendingBooking || !token) return;
    try { localStorage.removeItem(FORM_DRAFT_KEY); localStorage.removeItem(FLIGHT_DRAFT_KEY); } catch { /* ignore */ }
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

  // Origins = airports that appear as an origin in at least one active route
  const origins  = useMemo(
    () => [...new Set(fwRoutes.map((r) => r.origin))].sort(),
    [fwRoutes],
  );
  // Destinations = airports reachable from selected origin via an active route
  const fwDests  = useMemo(
    () => [...new Set(fwRoutes.filter((r) => r.origin === fwOrigin).map((r) => r.destination))].sort(),
    [fwRoutes, fwOrigin],
  );
  const originsSet = useMemo(() => new Set(origins), [origins]);
  const fwDestsSet = useMemo(() => new Set(fwDests), [fwDests]);

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
      <div ref={topRef} className="container max-w-6xl mx-auto">
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

        <div className={cn(
          "grid gap-6",
          activeSlotId ? "lg:grid-cols-[minmax(0,1fr)_340px]" : "",
        )}>
        <div className="min-w-0">
        {/* ── STEP: Search ────────────────────────────────────────────────── */}
        {step === "search" && (
          <div className="space-y-6">

            {/* ── Compact Search Bar ────────────────────────────────────── */}
            <div className="rounded-[14px] border border-neutral-200 bg-white shadow-sm px-4 pt-4 pb-5 space-y-4">
              {/* Options chip row */}
              <div className="flex flex-wrap items-center gap-2">
                <MiniDropdown
                  icon={<RefreshCw className="size-3.5" />}
                  value={tripType === "one_way" ? "One-way" : "Round trip"}
                  disabled={bookingKind === "helicopter"}
                  options={[
                    { value: "one_way",    label: "One-way"    },
                    { value: "round_trip", label: "Round trip" },
                  ]}
                  onChange={(v) => {
                    setTripType(v as "one_way" | "round_trip");
                    setFwReturnDate(""); setFwReturnFlight(null);
                  }}
                />
                <PaxDropdown value={paxCounts} onChange={setPaxCounts} />
                <MiniDropdown
                  icon={bookingKind === "helicopter" ? <Helicopter className="size-3.5" /> : <Plane className="size-3.5" />}
                  value={bookingKind === "helicopter" ? "Helicopter" : "Fixed Wing"}
                  options={[
                    { value: "helicopter", label: "Helicopter" },
                    { value: "fixed_wing", label: "Fixed Wing" },
                  ]}
                  onChange={(v) => {
                    setBookingKind(v as "helicopter" | "fixed_wing");
                    setSelectedProduct(null); setHelDate(""); setSelectedSlot(null);
                    setFwOrigin(""); setFwDest(""); setFwDate(""); setFwFlight(null);
                    setTripType("one_way"); setFwReturnDate(""); setFwReturnFlight(null);
                  }}
                />
              </div>

              {/* Origin / Destination / Date row */}
              <div className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr] gap-3 items-end">
                {/* From ⇄ To — two separate fields with centered swap button */}
                <div>
                  <div className="flex items-center mb-1.5">
                    <label className="flex-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">From</label>
                    <label className="flex-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 pl-3">To</label>
                  </div>
                  <div className="relative flex items-stretch gap-2.5">
                    <div className="flex-1">
                      {bookingKind === "fixed_wing" ? (
                        <AirportCombobox
                          groups={airportGroups}
                          allowedAirportNames={originsSet}
                          value={fwOrigin}
                          placeholder="City or airport"
                          hideChevron
                          buttonClassName="rounded-r-[6px]"
                          onChange={(v) => { setFwOrigin(v); setFwDest(""); setFwDate(""); setFwFlight(null); }}
                        />
                      ) : (
                        <Combobox
                          options={[...new Set(helProducts.map((p) => p.route.origin))].sort()}
                          value={selectedProduct?.route.origin ?? ""}
                          placeholder="City"
                          hideChevron
                          buttonClassName="rounded-r-[6px]"
                          onChange={(v) => {
                            setSelectedProduct(null); setHelDate(""); setSelectedSlot(null);
                            const match = helProducts.find((p) => p.route.origin === v);
                            if (match) setSelectedProduct(match);
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      {bookingKind === "fixed_wing" ? (
                        <AirportCombobox
                          groups={airportGroups}
                          allowedAirportNames={fwDestsSet}
                          value={fwDest}
                          placeholder="City or airport"
                          padStart
                          hideChevron
                          buttonClassName="rounded-l-[6px]"
                          disabled={!fwOrigin}
                          onChange={(v) => { setFwDest(v); setFwDate(""); setFwFlight(null); }}
                        />
                      ) : (
                        <Combobox
                          options={[...new Set(
                            helProducts
                              .filter((p) => !selectedProduct || p.route.origin === selectedProduct.route.origin)
                              .map((p) => p.route.destination),
                          )].sort()}
                          value={selectedProduct?.route.destination ?? ""}
                          placeholder="City"
                          padStart
                          hideChevron
                          buttonClassName="rounded-l-[6px]"
                          disabled={!selectedProduct}
                          onChange={(v) => {
                            const match = helProducts.find(
                              (p) => p.route.origin === selectedProduct?.route.origin && p.route.destination === v,
                            );
                            if (match) { setSelectedProduct(match); setHelDate(""); setSelectedSlot(null); }
                          }}
                        />
                      )}
                    </div>
                    {/* Centered swap circle — its bordered bg cuts concave arcs into both fields' straight facing edges (notch effect) */}
                    <button type="button"
                      onClick={() => {
                        if (bookingKind === "fixed_wing") {
                          const t = fwOrigin; setFwOrigin(fwDest); setFwDest(t); setFwDate(""); setFwFlight(null);
                        }
                      }}
                      disabled={bookingKind === "helicopter" || !fwOrigin || !fwDest}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-7.5 h-7 rounded-full border-2 border-neutral-200 bg-white flex items-center justify-center hover:border-[#8cc63f]/50 transition-colors disabled:cursor-not-allowed disabled:[&>svg]:opacity-40 group">
                      <ArrowLeftRight className="size-3.5 text-neutral-500 group-hover:text-[#8cc63f] transition-colors" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 bg-white h-7.5 w-2.5"></span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                    {bookingKind === "fixed_wing" && tripType === "round_trip" ? "Departure — Return" : "Departure"}
                  </label>
                  {bookingKind === "fixed_wing" && tripType === "round_trip" ? (
                    /* Round-trip: single popover with two-month range picker */
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button"
                          className="w-full h-[42px] px-3 rounded-[8px] border-2 border-neutral-200 bg-white text-left text-sm text-neutral-800 hover:border-[#8cc63f]/50 transition-colors flex items-center justify-between">
                          <span className={cn("truncate", !fwDate && "text-neutral-400")}>
                            {fwDate
                              ? `${fmtDate(fwDate)}${fwReturnDate ? ` — ${fmtDate(fwReturnDate)}` : "  —  Return?"}`
                              : "Departure — Return"}
                          </span>
                          <CalendarDays className="size-4 text-neutral-400 shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          numberOfMonths={2}
                          selected={{
                            from: fwDate       ? new Date(fwDate)       : undefined,
                            to:   fwReturnDate ? new Date(fwReturnDate) : undefined,
                          }}
                          onSelect={(range) => {
                            if (!range) return;
                            if (range.from && isValid(range.from)) {
                              const depIso = format(range.from, "yyyy-MM-dd");
                              setFwDate(depIso); setFwFlight(null); setSelectedSeatIds([]);
                              if (range.to && isValid(range.to)) {
                                const retIso = format(range.to, "yyyy-MM-dd");
                                setFwReturnDate(retIso >= depIso ? retIso : depIso);
                              } else {
                                setFwReturnDate("");
                              }
                            }
                          }}
                          disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    /* One-way: date button flanked by prev / next day arrows */
                    <div className="flex items-stretch gap-1">
                      <button type="button"
                        onClick={() => {
                          const cur = bookingKind === "fixed_wing" ? fwDate : helDate;
                          if (!cur) return;
                          const prev = new Date(cur);
                          prev.setDate(prev.getDate() - 1);
                          const today = new Date(); today.setHours(0,0,0,0);
                          if (prev < today) return;
                          const iso = format(prev, "yyyy-MM-dd");
                          if (bookingKind === "fixed_wing") { setFwDate(iso); setFwFlight(null); setSelectedSeatIds([]); }
                          else                              { setHelDate(iso); setSelectedSlot(null); setSelectedSeatIds([]); }
                        }}
                        disabled={!(bookingKind === "fixed_wing" ? fwDate : helDate)}
                        className="h-[42px] w-9 rounded-[8px] border-2 border-neutral-200 bg-white text-neutral-500 hover:border-[#8cc63f]/50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                        <ChevronLeft className="size-4" />
                      </button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button"
                            className="flex-1 h-[42px] px-3 rounded-[8px] border-2 border-neutral-200 bg-white text-left text-sm text-neutral-800 hover:border-[#8cc63f]/50 transition-colors flex items-center justify-between">
                            <span className={cn("truncate", !(bookingKind === "fixed_wing" ? fwDate : helDate) && "text-neutral-400")}>
                              {bookingKind === "fixed_wing"
                                ? fwDate ? fmtDate(fwDate) : "Pick a date"
                                : helDate ? fmtDate(helDate) : "Pick a date"}
                            </span>
                            <CalendarDays className="size-4 text-neutral-400 shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              (bookingKind === "fixed_wing" ? fwDate : helDate)
                                ? new Date(bookingKind === "fixed_wing" ? fwDate : helDate)
                                : undefined
                            }
                            onSelect={(d) => {
                              if (!d || !isValid(d)) return;
                              const iso = format(d, "yyyy-MM-dd");
                              if (bookingKind === "fixed_wing") { setFwDate(iso); setFwFlight(null); setSelectedSeatIds([]); }
                              else                              { setHelDate(iso); setSelectedSlot(null); setSelectedSeatIds([]); }
                            }}
                            disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                          />
                        </PopoverContent>
                      </Popover>
                      <button type="button"
                        onClick={() => {
                          const cur = bookingKind === "fixed_wing" ? fwDate : helDate;
                          if (!cur) return;
                          const next = new Date(cur);
                          next.setDate(next.getDate() + 1);
                          const iso = format(next, "yyyy-MM-dd");
                          if (bookingKind === "fixed_wing") { setFwDate(iso); setFwFlight(null); setSelectedSeatIds([]); }
                          else                              { setHelDate(iso); setSelectedSlot(null); setSelectedSeatIds([]); }
                        }}
                        disabled={!(bookingKind === "fixed_wing" ? fwDate : helDate)}
                        className="h-[42px] w-9 rounded-[8px] border-2 border-neutral-200 bg-white text-neutral-500 hover:border-[#8cc63f]/50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Search button */}
              <div className="flex items-center justify-end pt-1">
                <button type="button"
                  onClick={() => { /* results render live below as state changes */ }}
                  className="flex items-center gap-2 h-10 px-6 rounded-[10px] text-white text-sm font-semibold shadow-sm hover:opacity-95 transition-opacity"
                  style={{ background: BRAND }}>
                  <Search className="size-4" /> Search
                </button>
              </div>
            </div>

            {/* ── HELICOPTER RESULTS ─────────────────────────────────────── */}
            {bookingKind === "helicopter" && selectedProduct && helDate && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-700">Available Flights
                    <span className="text-neutral-400 font-normal ml-2">
                      {selectedProduct.route.origin} → {selectedProduct.route.destination} · {fmtDate(helDate)}
                    </span>
                  </p>
                  {loadSlots && <Loader2 className="size-4 animate-spin" style={{ color: BRAND }} />}
                </div>
                {!loadSlots && helDaySlots.length === 0 ? (
                  <div className="flex flex-col items-center py-10 border border-dashed border-neutral-200 rounded-[10px]">
                    <Helicopter className="size-8 text-neutral-200 mb-2" />
                    <p className="text-sm text-neutral-400">No flights on this date.</p>
                    <p className="text-xs text-neutral-300 mt-1">Try another date.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {helDaySlots.map(sl => (
                      <SlotCard key={sl.id} slot={sl} isSelected={selectedSlot?.id === sl.id}
                        requiredSeats={passengerCount} onClick={() => { setSelectedSlot(selectedSlot?.id === sl.id ? null : sl); setSelectedSeatIds([]); }} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {bookingKind === "helicopter" && !helDate && (
              <div className="flex flex-col items-center py-14 border border-dashed border-neutral-200 rounded-[10px]">
                <Helicopter className="size-8 text-neutral-200 mb-2" />
                <p className="text-sm text-neutral-400">Pick a route and date to see available flights.</p>
              </div>
            )}

            {/* ── FIXED WING ──────────────────────────────────────────────── */}
            {bookingKind === "fixed_wing" && (
              <div className="space-y-6">

                {(!fwOrigin || !fwDest || !fwDate) && (
                  <div className="flex flex-col items-center py-14 border border-dashed border-neutral-200 rounded-[10px]">
                    <Plane className="size-8 text-neutral-200 mb-2" />
                    <p className="text-sm text-neutral-400">Pick a route and date to see available flights.</p>
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
                        requiredSeats={passengerCount} onClick={() => { setFwFlight(fwFlight?.id === f.id ? null : f); setSelectedSeatIds([]); }} />
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

                    {fwDate && (
                      <p className="text-[11px] text-neutral-400">
                        Must be on or after departure date ({fwDate})
                      </p>
                    )}

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
                            requiredSeats={passengerCount}
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
                onClick={() => goToStep("passengers")}
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => goToStep("search")}
                className="h-9 px-4 flex items-center gap-2 rounded-[8px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium"
              >
                <ArrowLeft className="size-3.5" /> Previous
              </button>
              <button
                type="button"
                onClick={() => { try { localStorage.removeItem(FORM_DRAFT_KEY); } catch { /* ignore */ } goToStep("search"); }}
                className="h-9 px-4 rounded-[8px] border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>

            {/* Flight summary */}
            <div className="bg-white rounded-[10px] border border-neutral-100 p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Selected Flight</p>
              {bookingKind === "helicopter" && selectedProduct && selectedSlot && (
                <div className="flex items-center gap-4 text-sm">
                  <Helicopter className="size-4 shrink-0" style={{ color: BRAND }} />
                  <div>
                    <p className="font-medium text-neutral-800">{selectedProduct.name}</p>
                    <p className="text-neutral-500 text-xs">{selectedSlot.flightNumber || selectedSlot.slotCode} · {fmtDate(selectedSlot.scheduledDeparture)} · {fmtTime(selectedSlot.scheduledDeparture)} · {passengerCount} seat{passengerCount > 1 ? "s" : ""}</p>
                  </div>
                </div>
              )}
              {bookingKind === "fixed_wing" && fwFlight && (
                <div className="flex items-center gap-4 text-sm">
                  <Plane className="size-4 shrink-0" style={{ color: BRAND }} />
                  <div>
                    <p className="font-medium text-neutral-800">{fwFlight.origin} → {fwFlight.destination}</p>
                    <p className="text-neutral-500 text-xs">{fwFlight.flightNumber || fwFlight.slotCode} · {fmtDate(fwFlight.scheduledDeparture)} · {fmtTime(fwFlight.scheduledDeparture)} · {passengerCount} seat{passengerCount > 1 ? "s" : ""}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(
              () => { goToStep("addons"); },
              () => {
                requestAnimationFrame(() => {
                  const el =
                    document.querySelector<HTMLElement>('[aria-invalid="true"]') ??
                    document.querySelector<HTMLElement>('.text-red-500, .text-red-600');
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                });
              },
            )}>

              {/* Passenger cards */}
              <div className="space-y-4">
                {fields.map((field, i) => {
                  const isLead    = i === 0;
                  const dobStr    = formDataPassengers?.[i]?.dateOfBirth ?? "";
                  const dobDate   = new Date(dobStr);
                  // Compute age at the flight's departure date so a passenger who ages up before travel
                  // shows correctly in the form (e.g. a 23-month-old flying in 2 months is a CHILD).
                  const departure = fwFlight?.scheduledDeparture ?? selectedSlot?.scheduledDeparture;
                  const refDate   = departure ? new Date(departure) : new Date();
                  const paxType: PaxType = dobStr && !isNaN(dobDate.getTime()) ? getPassengerTypeFromDob(dobDate, refDate) : "ADULT";
                  const isPk      = getValues(`passengers.${i}.nationalityCode`) === "PK";
                  const isMinor   = paxType === "CHILD" || paxType === "INFANT";
                  const titleOpts: PaxTitle[] = (paxType === "ADULT")
                    ? ["MR", "MRS", "MS"]
                    : (paxType === "CHILD") ? ["MASTER", "MISS"] : [];
                  const typeLabel = {
                    ADULT: "Adult", CHILD: "Child (2-11)", INFANT: "Infant (Under 2)",
                  }[paxType];
                  const errs = errors.passengers?.[i];

                  return (
                    <div key={field.id} className="bg-white rounded-[10px] border border-neutral-100 p-5">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: isLead ? BRAND : CHARCOAL }}>{i + 1}</div>
                          <p className="text-sm font-semibold text-neutral-700">
                            {isLead ? "Lead Passenger" : `Passenger ${i + 1}`}
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 uppercase tracking-wide">
                            {typeLabel}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Nationality — first, drives doc field */}
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1.5">Nationality *</label>
                          <Controller
                            name={`passengers.${i}.nationalityId`}
                            control={control}
                            render={({ field, fieldState }) => (
                              <>
                                <NationalityCombobox
                                  nationalities={nationalities}
                                  value={field.value}
                                  hasError={!!fieldState.error}
                                  onChange={(id, code) => {
                                    field.onChange(id);
                                    setValue(`passengers.${i}.nationalityCode`, code);
                                    setValue(`passengers.${i}.cnicOrPassport`, "");
                                  }}
                                />
                                {fieldState.error && (
                                  <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                    <AlertCircle className="size-3 shrink-0" /> {fieldState.error.message}
                                  </p>
                                )}
                              </>
                            )}
                          />
                        </div>

                        {/* Title (adults + children only) */}
                        {titleOpts.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Title *</label>
                            <Controller
                              name={`passengers.${i}.title`}
                              control={control}
                              render={({ field, fieldState }) => (
                                <>
                                  <select {...field} value={field.value ?? ""}
                                    className={cn("w-full border-2 rounded-[8px] px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/20 transition-colors",
                                      fieldState.error ? "border-red-300 bg-red-50/30" : "border-neutral-200 focus:border-[#8cc63f]/50")}>
                                    <option value="">—</option>
                                    {titleOpts.map((t) => (
                                      <option key={t} value={t}>
                                        {({ MR: "Mr", MRS: "Mrs", MS: "Ms", MASTER: "Master", MISS: "Miss" } as Record<string,string>)[t]}
                                      </option>
                                    ))}
                                  </select>
                                  {fieldState.error && (
                                    <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                      <AlertCircle className="size-3 shrink-0" /> {fieldState.error.message}
                                    </p>
                                  )}
                                </>
                              )}
                            />
                          </div>
                        )}

                        {/* First / Last name */}
                        {(["firstName","lastName"] as const).map((f) => {
                          const err = errs?.[f];
                          const label = f === "firstName" ? "First Name" : "Last Name";
                          return (
                            <div key={f}>
                              <label className="block text-xs font-medium text-neutral-500 mb-1.5">{label} *</label>
                              <input type="text" {...register(`passengers.${i}.${f}`)}
                                className={cn("w-full border-2 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/20 transition-colors",
                                  err ? "border-red-300 focus:border-red-400 bg-red-50/30" : "border-neutral-200 focus:border-[#8cc63f]/50")} />
                              {err && (
                                <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                  <AlertCircle className="size-3 shrink-0" /> {err.message}
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {/* Date of Birth */}
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
                                    <AlertCircle className="size-3 shrink-0" /> {fieldState.error.message}
                                  </p>
                                )}
                              </>
                            )}
                          />
                        </div>

                        {/* Document (dynamic) — domestic infant/child use a parent/guardian's CNIC instead of their own */}
                        {isPk && isMinor ? (
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Parent/Guardian CNIC *</label>
                            {(() => { const { onChange: rhfOnChange, ...reg } = register(`passengers.${i}.guardianCnic`); return (
                              <input type="text" {...reg}
                                onChange={(e) => { e.target.value = maskCnic(e.target.value); return rhfOnChange(e); }}
                                placeholder="42201-1234567-1"
                                className={cn("w-full border-2 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/20 transition-colors",
                                  errs?.guardianCnic ? "border-red-300 focus:border-red-400 bg-red-50/30" : "border-neutral-200 focus:border-[#8cc63f]/50")} />
                            ); })()}
                            {errs?.guardianCnic && (
                              <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                <AlertCircle className="size-3 shrink-0" /> {errs.guardianCnic.message}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                              {isPk ? "CNIC *" : "Passport Number *"}
                            </label>
                            {(() => { const { onChange: rhfOnChange, ...reg } = register(`passengers.${i}.cnicOrPassport`); return (
                              <input type="text" {...reg}
                                onChange={(e) => {
                                  if (isPk) e.target.value = maskCnic(e.target.value);
                                  else       e.target.value = e.target.value.toUpperCase();
                                  return rhfOnChange(e);
                                }}
                                placeholder={isPk ? "42201-1234567-1" : "e.g. A1234567"}
                                className={cn("w-full border-2 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/20 transition-colors",
                                  errs?.cnicOrPassport ? "border-red-300 focus:border-red-400 bg-red-50/30" : "border-neutral-200 focus:border-[#8cc63f]/50")} />
                            ); })()}
                            {errs?.cnicOrPassport && (
                              <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                <AlertCircle className="size-3 shrink-0" /> {errs.cnicOrPassport.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Lead contact + share toggle */}
                      {isLead && (
                        <div className="mt-5 pt-5 border-t border-neutral-100 space-y-3">
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Contact Information</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Email *</label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400" />
                                <input type="email" {...register(`passengers.${i}.contactEmail`)}
                                  placeholder="you@example.com"
                                  className={cn("w-full border-2 rounded-[8px] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors",
                                    errs?.contactEmail
                                      ? "border-red-300 focus:border-red-400 focus:ring-red-200 bg-red-50/30"
                                      : "border-neutral-200 focus:border-[#8cc63f]/50 focus:ring-[#8cc63f]/20")} />
                              </div>
                              {errs?.contactEmail && (
                                <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                  <AlertCircle className="size-3 shrink-0" /> {errs.contactEmail.message}
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Phone *</label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400" />
                                {(() => { const { onChange: rhfOnChange, ...reg } = register(`passengers.${i}.contactPhone`); return (
                                  <input type="tel" {...reg}
                                    onChange={(e) => { if (isPk) e.target.value = maskPhone(e.target.value); return rhfOnChange(e); }}
                                    placeholder={isPk ? "0312 3456789" : "+1 415 555 0100"}
                                    className={cn("w-full border-2 rounded-[8px] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors",
                                      errs?.contactPhone
                                        ? "border-red-300 focus:border-red-400 focus:ring-red-200 bg-red-50/30"
                                        : "border-neutral-200 focus:border-[#8cc63f]/50 focus:ring-[#8cc63f]/20")} />
                                ); })()}
                              </div>
                              {errs?.contactPhone && (
                                <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5 font-medium">
                                  <AlertCircle className="size-3 shrink-0" /> {errs.contactPhone.message}
                                </p>
                              )}
                            </div>
                          </div>
                          {fields.length > 1 && (
                            <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer select-none pt-1">
                              <input type="checkbox" checked={shareContact}
                                onChange={(e) => setShareContact(e.target.checked)}
                                className="size-4 rounded border-neutral-300 accent-[#8cc63f]" />
                              All passengers share my contact info
                            </label>
                          )}
                        </div>
                      )}

                      {/* Non-lead: contact fields when share is OFF */}
                      {!isLead && !shareContact && (
                        <div className="mt-5 pt-5 border-t border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Email</label>
                            <input type="email" {...register(`passengers.${i}.contactEmail`)}
                              className="w-full border-2 border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/20 focus:border-[#8cc63f]/50 transition-colors" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Phone</label>
                            {(() => { const { onChange: rhfOnChange, ...reg } = register(`passengers.${i}.contactPhone`); return (
                              <input type="tel" {...reg}
                                onChange={(e) => { if (isPk) e.target.value = maskPhone(e.target.value); return rhfOnChange(e); }}
                                placeholder={isPk ? "0312 3456789" : "+1 415 555 0100"}
                                className="w-full border-2 border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/20 focus:border-[#8cc63f]/50 transition-colors" />
                            ); })()}
                          </div>
                        </div>
                      )}
                      {!isLead && shareContact && (
                        <p className="mt-4 text-[11px] text-neutral-400">Contact: shared with Lead Passenger</p>
                      )}

                      {/* isLeadPassenger is set in the paxCounts sync effect; no hidden input needed */}
                    </div>
                  );
                })}
              </div>


              {/* Submit */}
              <div className="pt-4 flex gap-3 items-center flex-wrap">
                <button
                  type="button"
                  onClick={() => goToStep("search")}
                  className="h-11 px-5 flex items-center gap-2 rounded-[10px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium"
                >
                  <ArrowLeft className="size-4" /> Previous
                </button>
                <button type="submit"
                  className="flex-1 flex items-center justify-center gap-2 h-11 px-8 rounded-[10px] text-sm font-semibold text-white transition-colors"
                  style={{ background: CHARCOAL }}>
                  <ArrowRight className="size-4" />
                  Continue to Add-ons
                </button>
                <button
                  type="button"
                  onClick={() => { try { localStorage.removeItem(FORM_DRAFT_KEY); } catch { /* ignore */ } goToStep("search"); }}
                  className="h-11 px-5 rounded-[10px] border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP: Add-ons ────────────────────────────────────────────────── */}
        {step === "addons" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => goToStep("passengers")}
                className="h-9 px-4 flex items-center gap-2 rounded-[8px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium">
                <ArrowLeft className="size-3.5" /> Previous
              </button>
              <button type="button"
                onClick={() => { try { localStorage.removeItem(FORM_DRAFT_KEY); } catch { /* ignore */ } goToStep("search"); }}
                className="h-9 px-4 rounded-[8px] border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium">
                Cancel
              </button>
            </div>

            {/* Available add-ons */}
            {(() => {
              const purchasableAddOns = (slotDetail?.product?.addOns ?? []).filter((a) => !a.isIncluded);
              const includedAddOns    = (slotDetail?.product?.addOns ?? []).filter((a) => a.isIncluded);
              return (
                <div className="space-y-4">
                  {includedAddOns.length > 0 && (
                    <div className="bg-[#f0f9e8] rounded-[10px] p-4 border border-[#8cc63f]/20">
                      <p className="text-xs font-semibold text-[#5a8a20] uppercase tracking-wide mb-2">Included in your fare</p>
                      <ul className="space-y-1">
                        {includedAddOns.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 text-sm text-neutral-700">
                            <Check className="size-3.5 text-[#8cc63f] shrink-0" /> {a.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {purchasableAddOns.length > 0 ? (
                    <div className="bg-white rounded-[10px] border border-neutral-100 p-5 space-y-3">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Optional Add-ons</p>
                      {purchasableAddOns.map((a) => {
                        const qty = selectedAddOns[a.id] ?? 0;
                        return (
                          <div key={a.id} className="flex items-center justify-between gap-4 py-2 border-b border-neutral-50 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-neutral-800">{a.label}</p>
                              <p className="text-xs text-neutral-400">${a.priceUsd.toFixed(2)} each</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button type="button" onClick={() => setAddOnQty(a.id, qty - 1)}
                                disabled={qty === 0}
                                className="size-7 rounded-full border border-neutral-200 flex items-center justify-center hover:border-neutral-400 disabled:opacity-30 transition-colors">
                                <Minus className="size-3" />
                              </button>
                              <span className="w-5 text-center text-sm font-semibold text-neutral-800">{qty}</span>
                              <button type="button" onClick={() => setAddOnQty(a.id, qty + 1)}
                                className="size-7 rounded-full border border-neutral-200 flex items-center justify-center hover:border-[#8cc63f] transition-colors">
                                <Plus className="size-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {Object.values(selectedAddOns).some((q) => q > 0) && (
                        <div className="pt-2 flex justify-between text-sm font-semibold text-neutral-800">
                          <span>Add-ons Total</span>
                          <span style={{ color: BRAND }}>
                            ${purchasableAddOns.reduce((s, a) => s + (selectedAddOns[a.id] ?? 0) * a.priceUsd, 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-[10px] border border-neutral-100 p-5 text-center">
                      <p className="text-sm text-neutral-400">No optional add-ons available for this flight.</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex gap-3 items-center">
              <button type="button" onClick={() => goToStep("passengers")}
                className="h-11 px-5 flex items-center gap-2 rounded-[10px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium">
                <ArrowLeft className="size-4" /> Previous
              </button>
              <button type="button" onClick={() => goToStep("seats")}
                className="flex-1 flex items-center justify-center gap-2 h-11 px-8 rounded-[10px] text-sm font-semibold text-white transition-colors"
                style={{ background: CHARCOAL }}>
                <ArrowRight className="size-4" />
                Continue to Seat Selection
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Seats ──────────────────────────────────────────────────── */}
        {step === "seats" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => goToStep("addons")}
                className="h-9 px-4 flex items-center gap-2 rounded-[8px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium">
                <ArrowLeft className="size-3.5" /> Previous
              </button>
              <button type="button"
                onClick={() => { try { localStorage.removeItem(FORM_DRAFT_KEY); } catch { /* ignore */ } goToStep("search"); }}
                className="h-9 px-4 rounded-[8px] border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium">
                Cancel
              </button>
            </div>

            {seatMap && seatMap.seats.length > 0 ? (
              <div className="bg-white rounded-[10px] border border-neutral-100 p-5">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Select Your Seat</p>

                {seatMap.lopaImageUrl ? (
                  <div className="flex flex-col sm:flex-row gap-5 items-start">
                    <div className="relative shrink-0 select-none w-full sm:w-[200px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={seatMap.lopaImageUrl} alt="Aircraft LOPA diagram"
                        className="w-full rounded-lg border border-neutral-200 shadow-sm" draggable={false} />
                      {seatMap.seats.map((seat) => {
                        if (seat.seatX == null || seat.seatY == null) return null;
                        const isSel = selectedSeatIds.includes(seat.id);
                        return (
                          <div key={seat.id} className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${seat.seatX}%`, top: `${seat.seatY}%` }}>
                            <button type="button" disabled={seat.isTaken}
                              onClick={() => toggleSeat(seat.id)}
                              title={seat.seatNumber}
                              className={cn(
                                "flex items-center justify-center text-[10px] font-bold border-2 rounded-full w-7 h-7",
                                "transition-all duration-150 focus:outline-none shadow-sm hover:scale-110",
                                seat.isTaken
                                  ? "bg-neutral-300 border-neutral-400 text-neutral-500 cursor-not-allowed"
                                  : isSel
                                    ? "bg-[#8cc63f] border-[#5a8a20] text-white ring-2 ring-[#8cc63f]/40 scale-110"
                                    : "bg-white border-neutral-300 text-neutral-600 hover:border-[#8cc63f] cursor-pointer",
                              )}>
                              {seat.seatNumber}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Seats</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[...seatMap.seats].sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)).map((seat) => {
                          const isSel = selectedSeatIds.includes(seat.id);
                          return (
                            <button key={seat.id} type="button" disabled={seat.isTaken}
                              onClick={() => toggleSeat(seat.id)}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                seat.isTaken
                                  ? "bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed"
                                  : isSel
                                    ? "bg-[#f0f9e8] border-[#8cc63f] text-[#5a8a20]"
                                    : "bg-white border-neutral-200 text-neutral-600 hover:border-[#8cc63f] hover:bg-[#f0f9e8]/50 cursor-pointer",
                              )}>
                              <div className={cn("size-2 rounded-full shrink-0",
                                seat.isTaken ? "bg-neutral-400" : isSel ? "bg-[#8cc63f]" : "bg-neutral-300")} />
                              {seat.seatNumber}
                              {(seat.isTaken || isSel) && (
                                <span className="ml-auto text-[10px] opacity-60">{seat.isTaken ? "Taken" : "✓"}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-[#8cc63f] bg-[#8cc63f] inline-block" /> Selected</span>
                        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-neutral-300 bg-white inline-block" /> Available</span>
                        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-neutral-300 inline-block" /> Taken</span>
                      </div>
                      {selectedSeatIds.length > 0 && (
                        <p className="text-xs font-semibold text-[#8cc63f]">
                          {selectedSeatIds.length} of {passengerCount} seat{passengerCount > 1 ? "s" : ""} selected: {selectedSeatIds.map((id) => seatMap.seats.find((s) => s.id === id)?.seatNumber).filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(seatMap.seats.map(s => s.row))).sort((a, b) => a - b).map(row => (
                        <div key={row} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-neutral-300 w-4 text-right">{row}</span>
                          {seatMap.seats.filter(s => s.row === row).sort((a, b) => a.column.localeCompare(b.column)).map(seat => {
                            const isSel = selectedSeatIds.includes(seat.id);
                            return (
                              <button key={seat.id} type="button" disabled={seat.isTaken}
                                onClick={() => toggleSeat(seat.id)}
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
                      {selectedSeatIds.length > 0 && <span className="ml-auto text-[#8cc63f] font-semibold">{selectedSeatIds.length}/{passengerCount} selected</span>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[10px] border border-neutral-100 p-5 text-center">
                <p className="text-sm text-neutral-400">No seat map available for this flight. You can proceed to review.</p>
              </div>
            )}

            <div className="flex gap-3 items-center">
              <button type="button" onClick={() => goToStep("addons")}
                className="h-11 px-5 flex items-center gap-2 rounded-[10px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium">
                <ArrowLeft className="size-4" /> Previous
              </button>
              <button type="button" onClick={() => goToStep("confirm")}
                className="flex-1 flex items-center justify-center gap-2 h-11 px-8 rounded-[10px] text-sm font-semibold text-white transition-colors"
                style={{ background: CHARCOAL }}>
                <ArrowRight className="size-4" />
                {selectedSeatIds.length === passengerCount ? "Review Booking" : "Skip & Review"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Confirm ────────────────────────────────────────────────── */}
        {step === "confirm" && (() => {
          const reviewSlot    = bookingKind === "helicopter" ? selectedSlot : fwFlight as typeof selectedSlot | null;
          const operatorLogo  = bookingKind === "helicopter" ? selectedSlot?.operatorLogo  : fwFlight?.operatorLogo;
          const operatorName  = bookingKind === "helicopter" ? selectedSlot?.operatorName  : fwFlight?.operatorName;
          const flightCode    = bookingKind === "helicopter" ? (selectedSlot?.flightNumber || selectedSlot?.slotCode) : (fwFlight?.flightNumber || fwFlight?.slotCode);
          const aircraft      = bookingKind === "helicopter" ? selectedSlot?.aircraft?.name : fwFlight?.aircraft?.name;
          const selectedAddOnLines = (slotDetail?.product?.addOns ?? [])
            .filter((a) => (selectedAddOns[a.id] ?? 0) > 0)
            .map((a) => ({ ...a, qty: selectedAddOns[a.id] ?? 0 }));
          const addOnsTotal   = selectedAddOnLines.reduce((s, a) => s + a.priceUsd * a.qty, 0);
          const baseFare      = bookingKind === "fixed_wing" && fwFlight?.pricePerSeat != null
            ? fwFlight.pricePerSeat * passengerCount
            : bookingKind === "helicopter" && selectedSlot?.pricePerSeat != null
              ? selectedSlot.pricePerSeat * passengerCount
              : null;
          const grandTotal    = baseFare != null ? baseFare + addOnsTotal : null;
          const seatLabel     = selectedSeatIds.length > 0
            ? selectedSeatIds.map((id) => seatMap?.seats.find((s) => s.id === id)?.seatNumber).filter(Boolean).join(", ")
            : null;
          const leadPax       = formDataPassengers.find((p) => p.isLeadPassenger);
          const titleMap: Record<string, string> = { MR: "Mr", MRS: "Mrs", MS: "Ms", MASTER: "Master", MISS: "Miss" };
          const typeMap:  Record<string, string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };

          return (
            <div className="space-y-5">
              {/* nav */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => goToStep("seats")}
                  className="h-9 px-4 flex items-center gap-2 rounded-[8px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium">
                  <ArrowLeft className="size-3.5" /> Previous
                </button>
                <button type="button"
                  onClick={() => { try { localStorage.removeItem(FORM_DRAFT_KEY); } catch { /* ignore */ } goToStep("search"); }}
                  className="h-9 px-4 rounded-[8px] border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium">
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
                {/* ── LEFT COLUMN ─────────────────────────────────────── */}
                <div className="space-y-4">

                  {/* Flight card */}
                  <div className="bg-white rounded-[12px] border border-neutral-100 p-5">
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                      {bookingKind === "helicopter" ? "Helicopter Flight" : tripType === "round_trip" ? "Round Trip" : "One-Way Flight"}
                    </p>

                    {/* Outbound */}
                    <div className="flex items-start gap-4">
                      {operatorLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={operatorLogo} alt={operatorName ?? ""} className="size-10 rounded-full object-cover shrink-0 border border-neutral-100" />
                      ) : (
                        <div className="size-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                          {bookingKind === "helicopter" ? <Helicopter className="size-5 text-neutral-400" /> : <Plane className="size-5 text-neutral-400" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          {bookingKind === "helicopter" && selectedProduct && (
                            <span className="text-sm font-semibold text-neutral-800">{selectedProduct.name}</span>
                          )}
                          {bookingKind === "fixed_wing" && fwFlight && (
                            <span className="text-sm font-semibold text-neutral-800">{fwFlight.origin} → {fwFlight.destination}</span>
                          )}
                          {operatorName && <span className="text-xs text-neutral-400">{operatorName}</span>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                          {reviewSlot && (
                            <>
                              <span>{fmtDate(reviewSlot.scheduledDeparture)}</span>
                              <span className="font-semibold text-neutral-700">{fmtTime(reviewSlot.scheduledDeparture)} → {fmtTime(reviewSlot.scheduledArrival)}</span>
                            </>
                          )}
                          {flightCode && <span className="font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded">{flightCode}</span>}
                          {aircraft   && <span>{aircraft}</span>}
                          {seatLabel  && <span className="font-medium text-[#8cc63f]">Seat {seatLabel}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Return leg */}
                    {tripType === "round_trip" && fwReturnFlight && (
                      <div className="mt-4 pt-4 border-t border-dashed border-neutral-100 flex items-start gap-4">
                        <div className="size-10 rounded-full bg-neutral-50 flex items-center justify-center shrink-0">
                          <Plane className="size-5 text-neutral-300 rotate-180" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-neutral-800">{fwDest} → {fwOrigin}</span>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                            <span>{fmtDate(fwReturnFlight.scheduledDeparture)}</span>
                            <span className="font-semibold text-neutral-700">{fmtTime(fwReturnFlight.scheduledDeparture)} → {fmtTime(fwReturnFlight.scheduledArrival)}</span>
                            {(fwReturnFlight.flightNumber || fwReturnFlight.slotCode) && (
                              <span className="font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded">{fwReturnFlight.flightNumber || fwReturnFlight.slotCode}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Passengers */}
                  <div className="bg-white rounded-[12px] border border-neutral-100 p-5">
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                      Passengers ({formDataPassengers.length})
                    </p>
                    <div className="space-y-3">
                      {formDataPassengers.map((p, idx) => {
                        const titleStr = p.title ? titleMap[p.title] : "";
                        const dob      = new Date(p.dateOfBirth);
                        const dep      = fwFlight?.scheduledDeparture ?? selectedSlot?.scheduledDeparture;
                        const ref      = dep ? new Date(dep) : new Date();
                        const pType    = p.dateOfBirth && !isNaN(dob.getTime()) ? getPassengerTypeFromDob(dob, ref) : "ADULT";
                        const typeStr  = typeMap[pType] ?? "Adult";
                        return (
                          <div key={idx} className="flex items-start gap-3 pb-3 last:pb-0 border-b border-neutral-50 last:border-0">
                            <div className="size-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ background: p.isLeadPassenger ? BRAND : CHARCOAL }}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-neutral-800">
                                  {titleStr && `${titleStr} `}{p.firstName} {p.lastName}
                                </span>
                                {p.isLeadPassenger && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white" style={{ background: BRAND }}>Lead</span>
                                )}
                                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">{typeStr}</span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-400">
                                {p.dateOfBirth && <span>DOB: {p.dateOfBirth}</span>}
                                {p.nationalityCode && <span>{nationalities.find((n) => n.code === p.nationalityCode)?.name ?? p.nationalityCode}</span>}
                                {p.cnicOrPassport && <span className="font-mono">{p.cnicOrPassport}</span>}
                              </div>
                              {p.isLeadPassenger && (p.contactEmail || p.contactPhone) && (
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                                  {p.contactEmail && <span className="flex items-center gap-1"><Mail className="size-2.5" />{p.contactEmail}</span>}
                                  {p.contactPhone && <span className="flex items-center gap-1"><Phone className="size-2.5" />{p.contactPhone}</span>}
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => goToStep("passengers")}
                              className="text-[11px] text-neutral-400 hover:text-[#8cc63f] transition-colors shrink-0 mt-0.5">
                              Edit
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add-ons */}
                  {selectedAddOnLines.length > 0 && (
                    <div className="bg-white rounded-[12px] border border-neutral-100 p-5">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Add-ons</p>
                      <div className="space-y-2">
                        {selectedAddOnLines.map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-sm">
                            <span className="text-neutral-700">{a.label} <span className="text-neutral-400 text-xs">× {a.qty}</span></span>
                            <span className="font-medium text-neutral-800">${(a.priceUsd * a.qty).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── RIGHT COLUMN: price + CTA ───────────────────────── */}
                <div className="space-y-4">
                  {/* Price breakdown */}
                  <div className="bg-white rounded-[12px] border border-neutral-100 p-5">
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-4">Price Summary</p>
                    <div className="space-y-2 text-sm">
                      {baseFare != null && (
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Base fare <span className="text-neutral-400 text-xs">({passengerCount} pax)</span></span>
                          <span className="font-medium text-neutral-800">${baseFare.toFixed(2)}</span>
                        </div>
                      )}
                      {addOnsTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Add-ons</span>
                          <span className="font-medium text-neutral-800">${addOnsTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {grandTotal != null && (
                        <div className="flex justify-between pt-3 mt-1 border-t border-neutral-100">
                          <span className="font-semibold text-neutral-700">Total</span>
                          <span className="font-bold text-lg text-neutral-900">${grandTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {grandTotal == null && (
                        <p className="text-xs text-neutral-400">Final price will be confirmed after booking.</p>
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
                        setOtpEmail(formDataPassengers?.[0]?.contactEmail || "");
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
                      : <><CreditCard className="size-4" /> Confirm &amp; Pay</>
                    }
                  </button>

                  <p className="text-[11px] text-neutral-400 text-center">
                    By confirming you agree to our terms &amp; conditions. Seats are held temporarily — complete payment promptly to confirm.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

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
                  try { localStorage.removeItem(FORM_DRAFT_KEY); } catch { /* ignore */ }
                  setHoldExpiredMessage("Your seat hold has expired. Please select your flight again.");
                  goToStep("search");
                }}
              />
            </div>

            {/* Fare breakdown */}
            <div className="bg-white rounded-[10px] border border-neutral-100 p-5 space-y-0">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">Fare Summary</p>
              {pendingBooking.pricing && [
                ...(pendingBooking.pricing.farePerPassenger != null
                  ? [{ label: "Fare per Passenger", value: `$${pendingBooking.pricing.farePerPassenger.toFixed(2)}` }]
                  : []),
                { label: "No. of Passengers",  value: String(pendingBooking.pricing.passengerCount) },
                { label: "Base Fare",           value: `$${pendingBooking.pricing.baseFareUsd.toFixed(2)}` },
                ...(pendingBooking.pricing.addOnsTotalUsd > 0
                  ? [{ label: "Add-ons", value: `$${pendingBooking.pricing.addOnsTotalUsd.toFixed(2)}` }]
                  : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs py-2 border-b border-neutral-50 last:border-0">
                  <span className="text-neutral-500">{label}</span>
                  <span className="font-medium text-neutral-700">{value}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 mt-1 border-t border-neutral-200">
                <span className="text-sm font-semibold text-neutral-800">Total Payable</span>
                <span className="text-sm font-bold text-neutral-900">${pendingBooking.totalAmountUsd.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-white rounded-[10px] border border-neutral-100 p-6">
              <Elements stripe={stripePromise ?? null} options={{
                clientSecret: stripeClientSecret,
                appearance: { theme: "stripe", variables: { colorPrimary: "#8cc63f", borderRadius: "8px" } },
              }}>
                <StripePaymentForm
                  amountUsd={pendingBooking.totalAmountUsd}
                  holdExpiresAt={pendingBooking.holdExpiresAt}
                  customerEmail={formDataPassengers?.[0]?.contactEmail ?? ""}
                  onSuccess={handlePaymentSuccess}
                  onHoldExpired={() => {
                    setHoldExpiredMessage("Your seat hold has expired. Please select your flight again — your passenger details have been saved.");
                    goToStep("search");
                  }}
                />
              </Elements>
            </div>
          </div>
        )}
        </div>{/* /left column */}

        {/* ── Sticky Preview Panel ─────────────────────────────────────── */}
        {activeSlotId && (() => {
          const flightRoute = bookingKind === "helicopter"
            ? { from: selectedProduct?.route.origin, to: selectedProduct?.route.destination,
                depIso: selectedSlot?.scheduledDeparture, arrIso: selectedSlot?.scheduledArrival,
                code: selectedSlot?.flightNumber || selectedSlot?.slotCode,
                aircraft: selectedSlot?.aircraft.name,
                operatorName: selectedSlot?.operatorName, operatorLogo: selectedSlot?.operatorLogo,
                price: slotDetail?.product?.pricingType }
            : { from: fwFlight?.origin, to: fwFlight?.destination,
                depIso: fwFlight?.scheduledDeparture, arrIso: fwFlight?.scheduledArrival,
                code: fwFlight?.flightNumber || fwFlight?.slotCode,
                aircraft: fwFlight?.aircraft.name,
                operatorName: fwFlight?.operatorName, operatorLogo: fwFlight?.operatorLogo,
                price: null };

          const baseFare = bookingKind === "fixed_wing" && fwFlight?.pricePerSeat != null
            ? fwFlight.pricePerSeat * passengerCount
            : bookingKind === "helicopter" && selectedSlot?.pricePerSeat != null
              ? selectedSlot.pricePerSeat * passengerCount
              : null;

          const addOnLines = (slotDetail?.product?.addOns ?? [])
            .filter((a) => (selectedAddOns[a.id] ?? 0) > 0)
            .map((a) => ({ label: a.label, qty: selectedAddOns[a.id], price: a.priceUsd * (selectedAddOns[a.id] ?? 0), isIncluded: a.isIncluded }));
          const addOnsTotal = addOnLines.reduce((s, l) => s + l.price, 0);
          const seatLabel = selectedSeatIds.length > 0
            ? selectedSeatIds.map((id) => slotDetail?.seatMap?.seats.find((s) => s.id === id)?.seatNumber).filter(Boolean).join(", ")
            : null;

          return (
            <aside className="hidden lg:block">
              <div className="sticky top-4 rounded-[14px] border border-neutral-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2"
                  style={{ background: "#f9fbf5" }}>
                  {bookingKind === "helicopter"
                    ? <Helicopter className="size-4" style={{ color: BRAND }} />
                    : <Plane className="size-4" style={{ color: BRAND }} />}
                  <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Trip Summary</p>
                </div>
                <div className="p-4 space-y-4 text-sm">
                  {/* Route */}
                  <div>
                    <div className="flex items-center gap-2 text-neutral-800 font-medium">
                      <span>{flightRoute.from}</span>
                      <ArrowRight className="size-3.5 text-neutral-400" />
                      <span>{flightRoute.to}</span>
                    </div>
                    {flightRoute.depIso && (
                      <p className="text-xs text-neutral-500 mt-1">
                        {fmtDate(flightRoute.depIso)} · {fmtTime(flightRoute.depIso)}
                        {flightRoute.arrIso && <> — {fmtTime(flightRoute.arrIso)}</>}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-neutral-500">
                      {flightRoute.code && <span className="font-mono">{flightRoute.code}</span>}
                      {flightRoute.aircraft && <span>· {flightRoute.aircraft}</span>}
                    </div>
                    {flightRoute.operatorName && (
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-500">
                        {flightRoute.operatorLogo &&
                          <img src={flightRoute.operatorLogo} alt="" className="size-4 rounded object-cover" />}
                        <span>{flightRoute.operatorName}</span>
                      </div>
                    )}
                  </div>

                  {/* Return leg */}
                  {tripType === "round_trip" && fwReturnFlight && (
                    <div className="pt-3 border-t border-neutral-100">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Return</p>
                      <div className="flex items-center gap-2 text-neutral-800 font-medium">
                        <span>{fwReturnFlight.origin}</span>
                        <ArrowRight className="size-3.5 text-neutral-400" />
                        <span>{fwReturnFlight.destination}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {fmtDate(fwReturnFlight.scheduledDeparture)} · {fmtTime(fwReturnFlight.scheduledDeparture)}
                      </p>
                    </div>
                  )}

                  {/* Passengers */}
                  <div className="pt-3 border-t border-neutral-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Passengers</p>
                    {formDataPassengers && formDataPassengers.length > 0 && formDataPassengers.some((p) => p.firstName) ? (
                      <ul className="space-y-1">
                        {formDataPassengers.map((p, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-neutral-700">
                            <span className="text-neutral-400">👤</span>
                            <span className="truncate">
                              {p.firstName || p.lastName ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : `Passenger ${i + 1}`}
                            </span>
                            {i === 0 && <span className="text-[10px] text-[#8cc63f] font-semibold ml-auto">Lead</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-neutral-400">{passengerCount} {passengerCount === 1 ? "Passenger" : "Passengers"}</p>
                    )}
                  </div>

                  {/* Add-ons / Seat */}
                  {(addOnLines.length > 0 || seatLabel) && (
                    <div className="pt-3 border-t border-neutral-100 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Extras</p>
                      {addOnLines.map((l, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-neutral-700">
                          <span className="truncate">🧳 {l.label} × {l.qty}</span>
                          {!l.isIncluded && <span className="tabular-nums text-neutral-500">${l.price.toFixed(2)}</span>}
                        </div>
                      ))}
                      {seatLabel && (
                        <div className="flex items-center justify-between text-xs text-neutral-700">
                          <span>💺 Seat {seatLabel}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pricing */}
                  {(baseFare != null || addOnsTotal > 0) && (
                    <div className="pt-3 border-t border-neutral-100 space-y-1">
                      {baseFare != null && (
                        <div className="flex items-center justify-between text-xs text-neutral-600">
                          <span>Base fare ({passengerCount} pax)</span>
                          <span className="tabular-nums">${baseFare.toFixed(2)}</span>
                        </div>
                      )}
                      {addOnsTotal > 0 && (
                        <div className="flex items-center justify-between text-xs text-neutral-600">
                          <span>Add-ons</span>
                          <span className="tabular-nums">${addOnsTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-neutral-100">
                        <span className="text-sm font-semibold text-neutral-800">Total</span>
                        <span className="text-base font-bold text-neutral-800 tabular-nums">
                          ${((baseFare ?? 0) + addOnsTotal).toFixed(2)}
                          <span className="text-[10px] font-normal text-neutral-400 ml-1">USD</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          );
        })()}
        </div>{/* /grid */}
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

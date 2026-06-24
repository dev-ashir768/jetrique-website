"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Plane, Clock, CheckCircle, XCircle, AlertCircle,
  Loader2, LogOut, CalendarDays, ArrowRight,
} from "lucide-react";
import { customerApi, type CustomerBooking } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerStore";

const BRAND    = "#8cc63f";
const CHARCOAL = "#3a3a3a";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CONFIRMED:       { label: "Confirmed",        color: "#16a34a", bg: "#f0fdf4", icon: <CheckCircle className="size-3.5" /> },
  PENDING_PAYMENT: { label: "Pending Payment",  color: "#d97706", bg: "#fffbeb", icon: <Clock className="size-3.5" /> },
  CANCELLED:       { label: "Cancelled",        color: "#dc2626", bg: "#fef2f2", icon: <XCircle className="size-3.5" /> },
  COMPLETED:       { label: "Completed",        color: "#7c3aed", bg: "#f5f3ff", icon: <CheckCircle className="size-3.5" /> },
  NO_SHOW:         { label: "No Show",          color: "#6b7280", bg: "#f9fafb", icon: <AlertCircle className="size-3.5" /> },
};

function BookingCard({ b }: { b: CustomerBooking }) {
  const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.CONFIRMED;
  return (
    <div className="bg-white rounded-[12px] border border-neutral-100 p-5 hover:border-neutral-200 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-mono text-sm font-bold text-neutral-800 tracking-widest">{b.pnr}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{b.product}</p>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
          style={{ color: cfg.color, background: cfg.bg }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="text-center">
          <p className="text-base font-bold text-neutral-800">{fmtTime(b.departure)}</p>
          <p className="text-[10px] text-neutral-400 mt-0.5">{fmtDate(b.departure)}</p>
        </div>
        <div className="flex-1 flex items-center gap-1.5">
          <div className="h-px flex-1 bg-neutral-200" />
          <Plane className="size-3.5 text-neutral-300 rotate-90" />
          <div className="h-px flex-1 bg-neutral-200" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-neutral-800">{fmtTime(b.arrival)}</p>
          <p className="text-[10px] text-neutral-400 mt-0.5">{fmtDate(b.arrival)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-neutral-50">
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3" /> {fmtDate(b.createdAt)}
          </span>
        </div>
        <span className="text-sm font-bold text-neutral-800">${Number(b.totalAmountUsd).toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { isLoggedIn, hydrated, token, customer, logout } = useCustomerAuth();

  useEffect(() => {
    if (hydrated && !isLoggedIn) router.replace("/login?redirect=/account");
  }, [hydrated, isLoggedIn, router]);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings", token],
    queryFn:  () => customerApi.getBookings(token!),
    enabled:  !!token,
  });

  if (!hydrated) return null;

  const confirmed  = bookings.filter(b => b.status === "CONFIRMED" || b.status === "COMPLETED");
  const pending    = bookings.filter(b => b.status === "PENDING_PAYMENT");
  const cancelled  = bookings.filter(b => b.status === "CANCELLED" || b.status === "NO_SHOW");

  return (
    <section className="w-full py-8 px-4">
      <div className="container max-w-3xl mx-auto space-y-5">

        {/* Profile header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ background: CHARCOAL }}>
              {customer?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-semibold text-neutral-800">{customer?.name}</p>
              <p className="text-xs text-neutral-400">{customer?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/book")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-white text-xs font-semibold"
              style={{ background: BRAND }}>
              <ArrowRight className="size-3.5" /> Book a Flight
            </button>
            <button onClick={() => { logout(); router.push("/"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-neutral-500 text-xs border border-neutral-200 hover:border-neutral-300 transition-colors">
              <LogOut className="size-3.5" /> Sign Out
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Confirmed", value: confirmed.length,  color: "#16a34a", bg: "#f0fdf4" },
            { label: "Pending",   value: pending.length,    color: "#d97706", bg: "#fffbeb" },
            { label: "Cancelled", value: cancelled.length,  color: "#dc2626", bg: "#fef2f2" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-[10px] border border-neutral-100 p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-neutral-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Bookings list */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-700 mb-4">My Bookings</h2>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-neutral-400 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex items-center justify-between bg-white rounded-[12px] border border-neutral-100 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center">
                  <Plane className="size-5 text-neutral-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-600">No bookings yet</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Your flight bookings will appear here once you book</p>
                </div>
              </div>
              <button onClick={() => router.push("/book")}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-white text-xs font-semibold"
                style={{ background: BRAND }}>
                <ArrowRight className="size-3.5" /> Book a Flight
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => <BookingCard key={b.pnr} b={b} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

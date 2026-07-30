"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements, PaymentElement,
  useStripe, useElements,
} from "@stripe/react-stripe-js";
import {
  AlertCircle, CreditCard, Clock,
  CheckCircle, ArrowLeft, Loader2,
  Plane, Calendar, Users, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { publicApi, customerApi } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerStore";

const BRAND    = "#8cc63f";
const CHARCOAL = "#3a3a3a";

const stripeKey     = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ── Hold Countdown ─────────────────────────────────────────────────────────────

function HoldCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired?: () => void }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );
  useEffect(() => {
    if (secs <= 0) { onExpired?.(); return; }
    const t = setInterval(() => setSecs((s) => {
      if (s <= 1) { onExpired?.(); clearInterval(t); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = Math.floor(secs / 60), s = secs % 60;
  const isLow = secs < 300;
  if (secs <= 0) return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] bg-red-50 border border-red-200">
      <AlertCircle className="size-4 text-red-500 shrink-0" />
      <span className="text-xs font-medium text-red-600">Hold expired — please book again</span>
    </div>
  );
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-[8px] border", isLow ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}>
      <Clock className={cn("size-4 shrink-0", isLow ? "text-red-500" : "text-amber-600")} />
      <div>
        <p className={cn("text-xs font-semibold tabular-nums", isLow ? "text-red-600" : "text-amber-700")}>
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")} remaining
        </p>
        <p className="text-[10px] text-amber-600 mt-0.5">Complete payment before your seat hold expires</p>
      </div>
    </div>
  );
}

// ── Stripe Form ────────────────────────────────────────────────────────────────

function StripeForm({
  amountUsd, holdExpiresAt, customerEmail, bookingId, token,
  onSuccess, onExpired,
}: {
  amountUsd:     number;
  holdExpiresAt: string;
  customerEmail: string;
  bookingId:     string;
  token:         string;
  onSuccess:     () => void;
  onExpired:     () => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading,  setLoading]  = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "return") return;
    void (async () => {
      try {
        const res = await publicApi.getPaymentStatus(token, bookingId);
        if (res.status === "CONFIRMED") onSuccess();
      } catch { /* ignore */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setPayError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setLoading(false);
      setPayError(submitError.message ?? "Please check your payment details");
      return;
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pay/${bookingId}?payment=return`,
        ...(customerEmail ? { payment_method_data: { billing_details: { email: customerEmail } } } : {}),
      },
      redirect: "if_required",
    });
    setLoading(false);
    if (error) { setPayError(error.message ?? "Payment failed — please try again"); return; }
    if (paymentIntent?.status === "succeeded") {
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        try {
          const res = await publicApi.getPaymentStatus(token, bookingId);
          if (res.status === "CONFIRMED") { clearInterval(poll); onSuccess(); }
        } catch { /* ignore */ }
        if (tries >= 10) clearInterval(poll);
      }, 1500);
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      {holdExpiresAt && <HoldCountdown expiresAt={holdExpiresAt} onExpired={onExpired} />}

      {payError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[8px] p-3 text-xs text-red-600">
          <AlertCircle className="size-3.5 shrink-0" /> {payError}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-[12px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="size-4 text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-700">Payment Details</p>
        </div>
        <PaymentElement
          options={{
            layout:             "accordion",
            paymentMethodOrder: ["card"],
            wallets:            { applePay: "never", googlePay: "never" },
            ...(customerEmail ? {
              fields: { billingDetails: { email: "never" } },
              defaultValues: { billingDetails: { email: customerEmail } },
            } : {}),
          }}
        />
      </div>

      {/* Pay button */}
      <button type="submit" disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-[12px] text-white text-sm font-bold disabled:opacity-50 transition-all shadow-sm"
        style={{ background: loading ? CHARCOAL : BRAND }}>
        {loading
          ? <><Loader2 className="size-4 animate-spin" /> Processing Payment…</>
          : <><CreditCard className="size-4" /> Pay ${amountUsd.toFixed(2)} USD</>
        }
      </button>

      <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400">
        <Shield className="size-3.5" />
        <span>Secured by Stripe · 256-bit SSL encryption</span>
      </div>
    </form>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PayPage() {
  const router        = useRouter();
  const { bookingId } = useParams<{ bookingId: string }>();
  const { isLoggedIn, hydrated, token, customer } = useCustomerAuth();

  const [clientSecret,   setClientSecret]   = useState<string | null>(null);
  const [amountUsd,      setAmountUsd]      = useState<number>(0);
  const [holdExpiresAt,  setHoldExpiresAt]  = useState<string>("");
  const [pnr,            setPnr]            = useState<string>("");
  const [bookingDetail,  setBookingDetail]  = useState<{ departure: string; arrival: string; product: string; totalPassengers: number } | null>(null);
  const [done,           setDone]           = useState(false);
  const [expired,        setExpired]        = useState(false);
  const [initError,      setInitError]      = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !isLoggedIn) router.replace(`/login?redirect=/pay/${bookingId}`);
  }, [hydrated, isLoggedIn, router, bookingId]);

  const initMut = useMutation({
    mutationFn: () => publicApi.createPaymentIntent(token!, bookingId),
    onSuccess: (pi) => { setClientSecret(pi.clientSecret); setAmountUsd(pi.amountUsd); },
    onError: (e: Error) => setInitError(e.message),
  });

  useEffect(() => {
    if (!token || !bookingId) return;
    if (clientSecret) return;
    void (async () => {
      try {
        const st = await publicApi.getPaymentStatus(token, bookingId);
        if (st.status === "CONFIRMED") { setDone(true); setPnr(st.pnr); return; }
        if (st.holdExpiresAt) setHoldExpiresAt(st.holdExpiresAt);
        setPnr(st.pnr);
        setAmountUsd(st.totalAmountUsd);
        initMut.mutate();
      } catch (e) {
        setInitError((e as Error).message ?? "Could not load booking");
      }
    })();
    // Also fetch booking detail for the summary panel
    void (async () => {
      try {
        const bk = await customerApi.getBooking(token, bookingId);
        setBookingDetail({ departure: bk.departure, arrival: bk.arrival, product: bk.product, totalPassengers: bk.totalPassengers });
        if (!pnr) setPnr(bk.pnr);
      } catch { /* non-critical */ }
    })();
  }, [token, bookingId, clientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) return null;

  // ── Done ──
  if (done) return (
    <section className="w-full min-h-[60vh] flex items-center justify-center py-16 px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0fdf4", border: "2px solid #bbf7d0" }}>
          <CheckCircle className="size-10 text-green-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-neutral-800">Payment Confirmed!</p>
          <p className="text-sm text-neutral-500 mt-2">
            Booking <span className="font-mono font-bold text-neutral-700">{pnr}</span>
          </p>
          <p className="text-sm text-neutral-400 mt-1">Your e-ticket will be emailed to you shortly.</p>
        </div>
        <button onClick={() => router.push("/account")}
          className="w-full py-3.5 rounded-[12px] text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: CHARCOAL }}>
          View My Bookings
        </button>
      </div>
    </section>
  );

  // ── Expired ──
  if (expired) return (
    <section className="w-full min-h-[60vh] flex items-center justify-center py-16 px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-red-50 border-2 border-red-100">
          <Clock className="size-10 text-red-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-neutral-800">Hold Expired</p>
          <p className="text-sm text-neutral-400 mt-2">This seat hold has expired. Please make a new booking.</p>
        </div>
        <button onClick={() => router.push("/book")}
          className="w-full py-3.5 rounded-[12px] text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: BRAND }}>
          Book Again
        </button>
      </div>
    </section>
  );

  return (
    <section className="w-full py-8 px-4">
      <div className="container max-w-5xl mx-auto">

        {/* Back */}
        <button onClick={() => router.push("/account")}
          className="mb-6 h-9 px-4 flex items-center gap-2 rounded-[8px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium">
          <ArrowLeft className="size-3.5" /> My Bookings
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

          {/* ── Left: Booking Summary ── */}
          <div className="space-y-4">
            <div className="bg-white rounded-[16px] border border-neutral-100 shadow-sm overflow-hidden">
              {/* Header band */}
              <div className="px-6 py-4 border-b border-neutral-100" style={{ background: "#f9fafb" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Order Summary</p>
                {pnr && (
                  <p className="text-xs font-mono text-neutral-500">PNR: <span className="font-bold text-neutral-700">{pnr}</span></p>
                )}
              </div>

              <div className="p-6 space-y-5">
                {/* Flight route */}
                {bookingDetail ? (
                  <>
                    <div className="flex items-start gap-4">
                      <div className="size-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "#f0f9e8" }}>
                        <Plane className="size-5" style={{ color: BRAND }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">{bookingDetail.product}</p>
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-base font-bold text-neutral-800">{fmtDate(bookingDetail.departure)}</p>
                            <p className="text-[11px] text-neutral-400 mt-0.5">Departure</p>
                          </div>
                          <div className="flex-1 flex items-center gap-1 mx-1">
                            <div className="h-[1px] flex-1 bg-neutral-200" />
                            <Plane className="size-3.5 text-neutral-300" />
                            <div className="h-[1px] flex-1 bg-neutral-200" />
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-neutral-800">{fmtDate(bookingDetail.arrival)}</p>
                            <p className="text-[11px] text-neutral-400 mt-0.5">Arrival</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="h-[1px] bg-neutral-100" />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-[8px] flex items-center justify-center bg-neutral-50 border border-neutral-100">
                          <Users className="size-4 text-neutral-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">Passengers</p>
                          <p className="text-sm font-semibold text-neutral-700">{bookingDetail.totalPassengers} {bookingDetail.totalPassengers === 1 ? "Passenger" : "Passengers"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-[8px] flex items-center justify-center bg-neutral-50 border border-neutral-100">
                          <Calendar className="size-4 text-neutral-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">Booked</p>
                          <p className="text-sm font-semibold text-neutral-700">{new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3 py-4">
                    <div className="size-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "#f0f9e8" }}>
                      <Plane className="size-5" style={{ color: BRAND }} />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-2/3 bg-neutral-100 rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-neutral-100 rounded animate-pulse" />
                    </div>
                  </div>
                )}

                <div className="h-[1px] bg-neutral-100" />

                {/* Total */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-neutral-600">Total Amount</p>
                  <p className="text-2xl font-bold text-neutral-800">
                    ${amountUsd.toFixed(2)} <span className="text-xs font-normal text-neutral-400">USD</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Shield, label: "Secure Payment", sub: "SSL Encrypted" },
                { icon: CheckCircle, label: "Instant Confirmation", sub: "E-ticket via email" },
                { icon: Clock, label: "24/7 Support", sub: "hello@jetrique.com" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="bg-white rounded-[12px] border border-neutral-100 p-3 text-center">
                  <Icon className="size-5 mx-auto mb-1.5 text-neutral-300" />
                  <p className="text-[10px] font-semibold text-neutral-600">{label}</p>
                  <p className="text-[9px] text-neutral-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Payment Form ── */}
          <div className="bg-white rounded-[16px] border border-neutral-100 shadow-sm p-6">
            <div className="mb-5">
              <h1 className="text-lg font-bold text-neutral-800">Complete Payment</h1>
              <p className="text-xs text-neutral-400 mt-1">Enter your card details to confirm your booking</p>
            </div>

            {initError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[10px] p-4 text-sm text-red-600 mb-4">
                <AlertCircle className="size-4 shrink-0" /> {initError}
              </div>
            )}

            {!clientSecret && !initError && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-neutral-400">
                <Loader2 className="size-7 animate-spin" style={{ color: BRAND }} />
                <p className="text-sm">Loading payment details…</p>
              </div>
            )}

            {clientSecret && stripePromise && (
              <Elements stripe={stripePromise} options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: { colorPrimary: BRAND, borderRadius: "8px", fontFamily: "inherit" },
                },
              }}>
                <StripeForm
                  amountUsd={amountUsd}
                  holdExpiresAt={holdExpiresAt}
                  customerEmail={customer?.email ?? ""}
                  bookingId={bookingId}
                  token={token!}
                  onSuccess={() => setDone(true)}
                  onExpired={() => setExpired(true)}
                />
              </Elements>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { publicApi } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerStore";

const BRAND    = "#8cc63f";
const CHARCOAL = "#3a3a3a";

const stripeKey     = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

// ── Hold Countdown ────────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-red-50 border border-red-200">
      <AlertCircle className="size-4 text-red-500" />
      <span className="text-xs font-medium text-red-600">Hold expired — please book again</span>
    </div>
  );
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-[8px] border", isLow ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}>
      <Clock className={cn("size-4", isLow ? "text-red-500" : "text-amber-600")} />
      <span className={cn("text-xs font-semibold tabular-nums", isLow ? "text-red-600" : "text-amber-700")}>
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")} seat hold remaining
      </span>
    </div>
  );
}

// ── Stripe Form ───────────────────────────────────────────────────────────────

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

  // Poll status after 3DS return
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
      // Poll to get CONFIRMED status
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
      <div className="bg-[#f0f9e8] rounded-[10px] p-4 flex items-center justify-between">
        <span className="text-sm text-neutral-600">Total Amount</span>
        <span className="text-xl font-bold text-neutral-800">
          ${amountUsd.toFixed(2)} <span className="text-xs font-normal text-neutral-500">USD</span>
        </span>
      </div>

      <HoldCountdown expiresAt={holdExpiresAt} onExpired={onExpired} />

      {payError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[8px] p-3 text-xs text-red-600">
          <AlertCircle className="size-3.5 shrink-0" /> {payError}
        </div>
      )}

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
            ...(customerEmail ? {
              fields: { billingDetails: { email: "never" } },
              defaultValues: { billingDetails: { email: customerEmail } },
            } : {}),
          }}
        />
      </div>

      <button type="submit" disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
        style={{ background: CHARCOAL }}>
        {loading
          ? <><Loader2 className="size-4 animate-spin" /> Processing…</>
          : <><CreditCard className="size-4" /> Confirm Payment</>
        }
      </button>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PayPage() {
  const router     = useRouter();
  const { bookingId } = useParams<{ bookingId: string }>();
  const { isLoggedIn, hydrated, token, customer } = useCustomerAuth();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountUsd,    setAmountUsd]    = useState<number>(0);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string>("");
  const [pnr,          setPnr]          = useState<string>("");
  const [done,         setDone]         = useState(false);
  const [expired,      setExpired]      = useState(false);
  const [initError,    setInitError]    = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !isLoggedIn) router.replace(`/login?redirect=/pay/${bookingId}`);
  }, [hydrated, isLoggedIn, router, bookingId]);

  const initMut = useMutation({
    mutationFn: async () => {
      const pi = await publicApi.createPaymentIntent(token!, bookingId);
      return pi;
    },
    onSuccess: (pi) => {
      setClientSecret(pi.clientSecret);
      setAmountUsd(pi.amountUsd);
    },
    onError: (e: Error) => setInitError(e.message),
  });

  // Also fetch hold time from payment status.
  // Guard against re-initialising an already-created PaymentIntent — a token refresh
  // could otherwise fire a second createPaymentIntent while the user is mid-typing
  // in the current Stripe PaymentElement, swapping clientSecret from under them.
  useEffect(() => {
    if (!token || !bookingId) return;
    if (clientSecret) return;
    void (async () => {
      try {
        const st = await publicApi.getPaymentStatus(token, bookingId);
        if (st.status === "CONFIRMED") { setDone(true); setPnr(st.pnr); return; }
        if (st.holdExpiresAt) setHoldExpiresAt(st.holdExpiresAt);
        setPnr(st.pnr);
        initMut.mutate();
      } catch (e) {
        setInitError((e as Error).message ?? "Could not load booking");
      }
    })();
  }, [token, bookingId, clientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) return null;

  // ── Done ──
  if (done) return (
    <section className="w-full py-16 px-4">
      <div className="container max-w-md mx-auto text-center space-y-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0fdf4" }}>
          <CheckCircle className="size-8 text-green-600" />
        </div>
        <div>
          <p className="text-xl font-bold text-neutral-800">Payment Confirmed!</p>
          <p className="text-sm text-neutral-500 mt-1">PNR <span className="font-mono font-bold">{pnr}</span> — your ticket will be emailed to you.</p>
        </div>
        <button onClick={() => router.push("/account")}
          className="w-full py-3 rounded-[10px] text-white text-sm font-semibold"
          style={{ background: CHARCOAL }}>
          View My Bookings
        </button>
      </div>
    </section>
  );

  // ── Expired ──
  if (expired) return (
    <section className="w-full py-16 px-4">
      <div className="container max-w-md mx-auto text-center space-y-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-red-50">
          <AlertCircle className="size-8 text-red-500" />
        </div>
        <div>
          <p className="text-xl font-bold text-neutral-800">Hold Expired</p>
          <p className="text-sm text-neutral-500 mt-1">This seat hold has expired. Please make a new booking.</p>
        </div>
        <button onClick={() => router.push("/book")}
          className="w-full py-3 rounded-[10px] text-white text-sm font-semibold"
          style={{ background: BRAND }}>
          Book Again
        </button>
      </div>
    </section>
  );

  return (
    <section className="w-full py-8 px-4">
      <div className="container max-w-md mx-auto space-y-5">

        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/account")}
            className="h-9 px-4 flex items-center gap-2 rounded-[8px] border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors font-medium">
            <ArrowLeft className="size-3.5" /> My Bookings
          </button>
        </div>

        <div>
          <h1 className="text-xl font-bold text-neutral-800">Complete Payment</h1>
          {pnr && <p className="text-xs text-neutral-400 mt-1 font-mono">PNR: {pnr}</p>}
        </div>

        {initError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[8px] p-4 text-sm text-red-600">
            <AlertCircle className="size-4 shrink-0" /> {initError}
          </div>
        )}

        {!clientSecret && !initError && (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-400 text-sm">
            <Loader2 className="size-5 animate-spin" /> Loading payment details…
          </div>
        )}

        {clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{
            clientSecret,
            appearance: { theme: "stripe", variables: { colorPrimary: BRAND, borderRadius: "8px" } },
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
    </section>
  );
}

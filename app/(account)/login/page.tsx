"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ArrowRight, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { customerApi } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerStore";
import { useMutation } from "@tanstack/react-query";

const BRAND = "#8cc63f";

function LoginForm() {
  const router       = useRouter();
  const params       = useSearchParams();
  const redirect     = params.get("redirect") || "/account";
  const { isLoggedIn, hydrated, login } = useCustomerAuth();

  const [step,   setStep]   = useState<"email" | "otp">("email");
  const [email,  setEmail]  = useState("");
  const [code,   setCode]   = useState("");
  const [error,  setError]  = useState("");

  useEffect(() => {
    if (hydrated && isLoggedIn) router.replace(redirect);
  }, [hydrated, isLoggedIn, redirect, router]);

  const requestMut = useMutation({
    mutationFn: () => customerApi.requestOtp(email),
    onSuccess:  () => { setStep("otp"); setError(""); },
    onError:    (e: Error) => setError(e.message),
  });

  const verifyMut = useMutation({
    mutationFn: () => customerApi.verifyOtp(email, code),
    onSuccess:  ({ accessToken, customer: c }) => {
      login(accessToken, c);
      router.replace(redirect);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <section className="w-full py-16 px-4">
      <div className="max-w-sm mx-auto">

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#f0f9e8" }}>
            <Mail className="size-6" style={{ color: BRAND }} />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-800">
            {step === "email" ? "Sign in to Jetrique" : "Check your email"}
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            {step === "email"
              ? "Enter your email to receive a one-time login code"
              : `We've sent a 6-digit code to ${email}`}
          </p>
        </div>

        <div className="bg-white rounded-[14px] border border-neutral-100 shadow-sm p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-[8px] p-3 text-xs text-red-600">
              <AlertCircle className="size-3.5 shrink-0" /> {error}
            </div>
          )}

          {step === "email" ? (
            <>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">Email Address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoFocus
                  onKeyDown={e => e.key === "Enter" && email && requestMut.mutate()}
                  className="w-full border-2 border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:border-[#8cc63f]/50 transition-colors" />
              </div>
              <button type="button" disabled={!email || requestMut.isPending}
                onClick={() => requestMut.mutate()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                style={{ background: BRAND }}>
                {requestMut.isPending
                  ? <><Loader2 className="size-4 animate-spin" /> Sending…</>
                  : <><ArrowRight className="size-4" /> Send Login Code</>}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">6-Digit Code</label>
                <input
                  type="text" value={code} autoFocus
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  onKeyDown={e => e.key === "Enter" && code.length === 6 && verifyMut.mutate()}
                  className="w-full border-2 border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm text-center tracking-[0.6em] font-mono focus:outline-none focus:border-[#8cc63f]/50 transition-colors" />
              </div>
              <button type="button" disabled={code.length !== 6 || verifyMut.isPending}
                onClick={() => verifyMut.mutate()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                style={{ background: BRAND }}>
                {verifyMut.isPending
                  ? <><Loader2 className="size-4 animate-spin" /> Verifying…</>
                  : <><CheckCircle className="size-4" /> Verify & Sign In</>}
              </button>
              <button type="button"
                onClick={() => { setStep("email"); setCode(""); setError(""); }}
                className="w-full text-xs text-neutral-400 hover:text-neutral-600 py-1 transition-colors">
                Use a different email
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-neutral-300 mt-5">
          No password needed · Secure one-time codes · Your data is safe
        </p>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><div className="size-6 border-2 border-[#8cc63f] border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

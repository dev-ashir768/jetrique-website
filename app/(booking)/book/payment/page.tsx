"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { customerApi } from '@/lib/api';
import { useCustomerAuth } from '@/lib/customerStore';

function PaymentPageInner() {
  const params  = useSearchParams();
  const router  = useRouter();
  const slotId  = params.get('slotId') ?? '';
  const pax     = params.get('pax') ?? '1';
  const { isLoggedIn, login } = useCustomerAuth();

  // OTP flow state
  const [step,  setStep]  = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [name,  setName]  = useState('');
  const [otp,   setOtp]   = useState('');
  const [error, setError] = useState('');

  const requestMut = useMutation({
    mutationFn: () => customerApi.requestOtp(email, name),
    onSuccess:  () => { setStep('otp'); setError(''); },
    onError:    (e: Error) => setError(e.message),
  });

  const verifyMut = useMutation({
    mutationFn: () => customerApi.verifyOtp(email, otp),
    onSuccess:  ({ accessToken, customer }) => {
      login(accessToken, customer);
      // After login, confirm booking
      router.push(`/book/confirm-booking?slotId=${slotId}&pax=${pax}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  // Already logged in — skip to confirmation
  useEffect(() => {
    if (isLoggedIn) {
      router.push(`/book/confirm-booking?slotId=${slotId}&pax=${pax}`);
    }
  }, [isLoggedIn, slotId, pax, router]);

  return (
    <section className="w-full py-12 px-4">
      <div className="container max-w-md mx-auto">
        <button onClick={() => router.back()} className="text-xs text-neutral-400 hover:text-neutral-600 mb-6">
          ← Back
        </button>

        <div className="bg-white rounded-[10px] border border-neutral-100 p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-[#8cc63f]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-[#8cc63f] text-xl">✉</span>
            </div>
            <h2 className="text-lg font-medium text-neutral-800">
              {step === 'email' ? 'Enter your email to continue' : 'Check your email'}
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              {step === 'email'
                ? 'We\'ll send you a one-time login code'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs rounded-[6px] p-3 mb-4">{error}</div>
          )}

          {step === 'email' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ali Khan"
                  className="w-full border border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                />
              </div>
              <button
                onClick={() => requestMut.mutate()}
                disabled={!email || !name || requestMut.isPending}
                className="w-full bg-[#8cc63f] text-white py-3 rounded-[8px] font-medium hover:bg-[#7ab535] transition-colors disabled:opacity-50"
              >
                {requestMut.isPending ? 'Sending...' : 'Send Login Code'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">6-Digit Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full border border-neutral-200 rounded-[8px] px-3 py-2.5 text-sm text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                />
              </div>
              <button
                onClick={() => verifyMut.mutate()}
                disabled={otp.length !== 6 || verifyMut.isPending}
                className="w-full bg-[#8cc63f] text-white py-3 rounded-[8px] font-medium hover:bg-[#7ab535] transition-colors disabled:opacity-50"
              >
                {verifyMut.isPending ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                className="w-full text-sm text-neutral-400 hover:text-neutral-600 py-1"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-neutral-300 mt-4">
          No password needed — we use secure one-time codes
        </p>
      </div>
    </section>
  );
}

export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentPageInner />
    </Suspense>
  );
}

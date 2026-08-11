'use client';

import { useState } from 'react';
import TermsModal from '../TermsModal';

interface ContactFormProps {
  style?: string;
  collection?: string;
  category?: string;
  option?: string;
  initialMessage: string;
  onSuccess?: () => void;
}

export default function ContactForm({
  style,
  collection,
  category,
  option,
  initialMessage,
  onSuccess,
}: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the Terms & Conditions before sending your inquiry.');
      return;
    }

    setError('');
    setSending(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          message,
          style,
          collection,
          category,
          option,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send inquiry');
      }

      window.location.href = '/contact/success';
    } catch (err) {
      console.error(err);
      setError(
        'Something went wrong while sending your inquiry. Please try again.'
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="
            w-full rounded-2xl border border-white/10 bg-white/10
            px-5 py-4 text-white placeholder:text-white/50
            backdrop-blur-xl outline-none
          "
        />

        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="
            w-full rounded-2xl border border-white/10 bg-white/10
            px-5 py-4 text-white placeholder:text-white/50
            backdrop-blur-xl outline-none
          "
        />

        <textarea
          rows={8}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell me about your project..."
          className="
            w-full rounded-2xl border border-white/10 bg-white/10
            px-5 py-4 text-white placeholder:text-white/50
            backdrop-blur-xl outline-none
          "
        />

        {/* Terms & Conditions */}
        <label className="flex items-start gap-3 text-sm text-white/80">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-white"
          />

          <span>
            I have read and agree to the{' '}
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="underline decoration-white/40 underline-offset-2 transition hover:text-white"
            >
              Terms of Service
            </button>
            .
          </span>
        </label>

        <div className="flex justify-center md:justify-start">
          <button
            type="submit"
            disabled={sending || !termsAccepted}
            className="
              rounded-full border border-white/20 bg-white/10
              px-8 py-3 text-sm uppercase tracking-[0.15em]
              text-white transition duration-300
              hover:bg-white hover:text-[#2f3558]
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {sending ? 'Sending...' : 'Send inquiry'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-300">
            {error}
          </p>
        )}
      </form>

      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
      />
    </>
  );
}
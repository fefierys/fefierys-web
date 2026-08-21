'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const TermsModal = dynamic(() => import('../TermsModal'));

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

  /*
   * Honeypot.
   *
   * Los usuarios reales no ven ni rellenan este campo.
   * Muchos bots intentan completar todos los inputs.
   */
  const [website, setWebsite] = useState('');

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    if (termsOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [termsOpen]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]{2,}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedMessage = message.trim();


    /*
     * ============================================================
     * NAME
     * ============================================================
     */

    if (!normalizedName) {
      setError('Please enter your name.');
      return;
    }

    if (normalizedName.length > 100) {
      setError('Your name is too long.');
      return;
    }

    if (!nameRegex.test(normalizedName)) {
      setError('Please enter a valid name.');
      return;
    }


    /*
     * ============================================================
     * EMAIL
     * ============================================================
     */

    if (!normalizedEmail) {
      setError('Please enter your email.');
      return;
    }

    if (normalizedEmail.length > 254) {
      setError('Your email address is too long.');
      return;
    }

    if (!emailRegex.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }


    /*
     * ============================================================
     * MESSAGE
     * ============================================================
     */

    if (!normalizedMessage) {
      setError('Please tell me about your project.');
      return;
    }

    if (normalizedMessage.length > 5000) {
      setError(
        'Your project message is too long. Please keep it under 5000 characters.'
      );
      return;
    }


    /*
     * ============================================================
     * TERMS
     * ============================================================
     */

    if (!termsAccepted) {
      setError(
        'You must accept the Terms & Conditions before sending your inquiry.'
      );
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
          name: normalizedName,
          email: normalizedEmail,
          message: normalizedMessage,

          style,
          collection,
          category,
          option,

          /*
           * Honeypot.
           */
          website,
        }),
      });


      if (!response.ok) {
        throw new Error('Failed to send inquiry');
      }


      if (onSuccess) {
        onSuccess();
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
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-5"
      >

        {/* ======================================================
            HONEYPOT
        ====================================================== */}

        <div
          aria-hidden="true"
          className="
            absolute
            -left-[9999px]
            top-auto
            h-px
            w-px
            overflow-hidden
          "
        >
          <label htmlFor="website">
            Website
          </label>

          <input
            id="website"
            name="website"
            type="text"
            value={website}
            tabIndex={-1}
            autoComplete="off"
            onChange={(e) =>
              setWebsite(e.target.value)
            }
          />
        </div>


        {/* ======================================================
            NAME
        ====================================================== */}

        <input
          type="text"
          placeholder="Your name"
          value={name}
          required
          maxLength={100}
          autoComplete="name"
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          className="
            w-full rounded-2xl border border-white/10 bg-[#5966A5]/55
            px-5 py-4 text-white placeholder:text-white/50
            backdrop-blur-xl outline-none
          "
        />


        {/* ======================================================
            EMAIL
        ====================================================== */}

        <input
          type="email"
          placeholder="Your email"
          value={email}
          required
          maxLength={254}
          autoComplete="email"
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          className="
            w-full rounded-2xl border border-white/10 bg-[#5966A5]/55
            px-5 py-4 text-white placeholder:text-white/50
            backdrop-blur-xl outline-none
          "
        />


        {/* ======================================================
            MESSAGE
        ====================================================== */}

        <textarea
          rows={8}
          value={message}
          required
          maxLength={5000}
          onChange={(e) => {
            setMessage(e.target.value);
            setError('');
          }}
          placeholder="Tell me about your project..."
          className="
            w-full rounded-2xl border border-white/10 bg-[#5966A5]/55
            px-5 py-4 text-white placeholder:text-white/50
            backdrop-blur-xl outline-none
          "
        />


        {/* ======================================================
            TERMS & CONDITIONS
        ====================================================== */}

        <label className="flex items-start gap-3 text-sm text-white">

          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              setTermsAccepted(
                e.target.checked
              );
              setError('');
            }}
            className="
              mt-1
              h-4
              w-4
              rounded
              border-white/20
              bg-white/10
              text-white
            "
          />


          <span>
            I have read and agree to the{' '}

            <button
              type="button"
              onClick={() =>
                setTermsOpen(true)
              }
              className="
                underline
                decoration-white/40
                underline-offset-2
                transition
                hover:text-white
              "
            >
              Terms of Service
            </button>

            .
          </span>

        </label>


        {/* ======================================================
            SUBMIT
        ====================================================== */}

        <div className="flex justify-center md:justify-start">

          <button
            type="submit"
            disabled={
              sending ||
              !termsAccepted
            }
            className="
              rounded-full
              border
              border-white/20
              bg-[#2f3558]/20

              px-8
              py-3

              text-sm
              uppercase
              tracking-[0.15em]

              text-white

              transition
              duration-300

              hover:bg-white
              hover:text-[#2f3558]

              disabled:cursor-not-allowed
            "
          >
            {sending
              ? 'Sending...'
              : 'Send inquiry'}
          </button>

        </div>


        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <p className="text-sm text-red-300">
            {error}
          </p>
        )}

      </form>


      {/* ========================================================
          TERMS MODAL
      ======================================================== */}

      {termsOpen && (
        <TermsModal
          open={termsOpen}
          onClose={() =>
            setTermsOpen(false)
          }
        />
      )}

    </>
  );
}
'use client';

import {
  type FormEvent,
  useRef,
  useState,
} from 'react';

interface ContactFormProps {
  style?: string;
  collection?: string;
  category?: string;
  option?: string;
  onSuccess?: () => void;
}

export default function ContactForm({
  style,
  collection,
  category,
  option,
  onSuccess,
}: ContactFormProps) {
  const [name, setName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [message, setMessage] =
    useState('');

  /*
   * Honeypot.
   *
   * Invisible to real users.
   */
  const [website, setWebsite] =
    useState('');

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState('');

  /*
   * Reused if the request has an
   * uncertain network result.
   *
   * The backend uses this as its
   * idempotency key.
   */
  const submissionIdRef =
    useRef<string | null>(null);

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    const nameRegex =
      /^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/;

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const normalizedName =
      name.trim();

    const normalizedEmail =
      email.trim();

    const normalizedMessage =
      message.trim();

    /*
     * ============================================================
     * NAME
     * ============================================================
     */

    if (!normalizedName) {
      setError(
        'Please enter your name.',
      );

      return;
    }

    if (
      normalizedName.length > 100
    ) {
      setError(
        'Your name is too long.',
      );

      return;
    }

    if (
      !nameRegex.test(
        normalizedName,
      )
    ) {
      setError(
        'Please enter a valid name.',
      );

      return;
    }

    /*
     * ============================================================
     * EMAIL
     * ============================================================
     */

    if (!normalizedEmail) {
      setError(
        'Please enter your email.',
      );

      return;
    }

    if (
      normalizedEmail.length > 254
    ) {
      setError(
        'Your email address is too long.',
      );

      return;
    }

    if (
      !emailRegex.test(
        normalizedEmail,
      )
    ) {
      setError(
        'Please enter a valid email address.',
      );

      return;
    }

    /*
     * ============================================================
     * MESSAGE
     * ============================================================
     */

    if (!normalizedMessage) {
      setError(
        'Please tell me about your project.',
      );

      return;
    }

    if (
      normalizedMessage.length > 5000
    ) {
      setError(
        'Your project message is too long. Please keep it under 5000 characters.',
      );

      return;
    }

    setError('');
    setSending(true);

    try {
      const submissionId =
        submissionIdRef.current ??
        crypto.randomUUID();

      submissionIdRef.current =
        submissionId;

      const response =
        await fetch(
          '/api/contact',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              submissionId,

              name:
                normalizedName,

              email:
                normalizedEmail,

              message:
                normalizedMessage,

              style,
              collection,
              category,
              option,

              /*
               * Honeypot.
               */
              website,
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          'Failed to send inquiry',
        );
      }

      if (onSuccess) {
        onSuccess();
      }

      window.location.href =
        '/contact/success';
    } catch (err) {
      console.error(err);

      setError(
        'Something went wrong while sending your inquiry. Please try again.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="
        relative
        rounded-[2rem]
        border
        border-white/10
        bg-[#5966A5]/45
        p-5
        text-white
        backdrop-blur-xl
        shadow-[0_20px_60px_rgba(40,40,90,0.16)]
        sm:p-7
        lg:p-8
      "
    >
      {/* ======================================================
          FORM INTRO
      ====================================================== */}

      <div
        className="
          mb-6
          border-b
          border-white/10
          pb-5
        "
      >
        <h2
          className="
            text-xl
            font-light
            text-white
            sm:text-2xl
          "
        >
          Your project
        </h2>

        <p
          className="
            mt-2
            max-w-2xl
            text-xs
            leading-relaxed
            text-white/55
            sm:text-sm
          "
        >
          Share whatever information you have for now, whether it’s a lot or a little. 
          We can discuss references, timelines, budget, or other details once I receive your request.
        </p>
      </div>

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
            setWebsite(
              e.target.value,
            )
          }
        />
      </div>

      {/* ======================================================
          NAME + EMAIL
      ====================================================== */}

      <div
        className="
          grid
          gap-4
          md:grid-cols-2
        "
      >
        <div>
          <label
            htmlFor="contact-name"
            className="
              mb-2
              block
              text-xs
              text-white/65
            "
          >
            Your name
          </label>

          <input
            id="contact-name"
            name="name"
            type="text"
            value={name}
            required
            maxLength={100}
            autoComplete="name"
            placeholder="What should I call you?"
            onChange={(e) => {
              setName(
                e.target.value,
              );

              setError('');
            }}
            className="
              w-full
              rounded-2xl
              border
              border-white/10
              bg-black/[0.08]
              px-4
              py-3.5
              text-sm
              text-white
              outline-none
              transition
              placeholder:text-white/30
              focus:border-white/30
              focus:bg-white/[0.055]
            "
          />
        </div>

        <div>
          <label
            htmlFor="contact-email"
            className="
              mb-2
              block
              text-xs
              text-white/65
            "
          >
            Your email
          </label>

          <input
            id="contact-email"
            name="email"
            type="email"
            value={email}
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@example.com"
            onChange={(e) => {
              setEmail(
                e.target.value,
              );

              setError('');
            }}
            className="
              w-full
              rounded-2xl
              border
              border-white/10
              bg-black/[0.08]
              px-4
              py-3.5
              text-sm
              text-white
              outline-none
              transition
              placeholder:text-white/30
              focus:border-white/30
              focus:bg-white/[0.055]
            "
          />
        </div>
      </div>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      <div className="mt-5">
        <div
          className="
            mb-2
            flex
            items-end
            justify-between
            gap-3
          "
        >
          <label
            htmlFor="contact-message"
            className="
              text-xs
              text-white/65
            "
          >
            Tell me about your project
          </label>

          <span
            className="
              text-[0.65rem]
              text-white/35
            "
          >
            {message.length}/5000
          </span>
        </div>

        <textarea
          id="contact-message"
          name="message"
          rows={9}
          value={message}
          required
          maxLength={5000}
          onChange={(e) => {
            setMessage(
              e.target.value,
            );

            setError('');
          }}
          placeholder="Tell me what you're working on, what kind of illustration you have in mind, your timeline, budget, references, or anything else you'd like me to know..."
          className="
            w-full
            resize-y
            rounded-2xl
            border
            border-white/10
            bg-black/[0.08]
            px-4
            py-4
            text-sm
            leading-relaxed
            text-white
            outline-none
            transition
            placeholder:text-white/30
            focus:border-white/30
            focus:bg-white/[0.055]
          "
        />
      </div>

      {/* ======================================================
          REASSURANCE
      ====================================================== */}

      <div
        className="
          mt-5
          rounded-2xl
          border
          border-white/10
          bg-white/[0.035]
          px-4
          py-3
        "
      >
        <p
          className="
            text-xs
            leading-relaxed
            text-white/55
          "
        >
          Sending an inquiry does not
          require payment or commit you
          to a commission. If you decide
          to move forward, the applicable
          Terms of Service will be
          accepted later in the
          commission process.
        </p>
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div
          role="alert"
          className="
            mt-5
            rounded-2xl
            border
            border-red-200/15
            bg-red-200/[0.06]
            px-4
            py-3
          "
        >
          <p
            className="
              text-sm
              text-red-200
            "
          >
            {error}
          </p>
        </div>
      )}

      {/* ======================================================
          SUBMIT
      ====================================================== */}

      <div
        className="
          mt-6
          flex
          flex-col
          gap-3
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <p
          className="
            text-[0.7rem]
            leading-relaxed
            text-white/40
          "
        >
          I&apos;ll review your inquiry
          and get back to you by email.
        </p>

        <button
          type="submit"
          disabled={sending}
          className="
            inline-flex
            shrink-0
            items-center
            justify-center
            rounded-full
            border
            border-white/20
            bg-white
            px-7
            py-3
            text-xs
            uppercase
            tracking-[0.15em]
            text-[#353a70]
            transition
            duration-200
            hover:bg-white/90
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {sending
            ? 'Sending...'
            : 'Send inquiry'}
        </button>
      </div>
    </form>
  );
}
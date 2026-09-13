'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

import TermsModal from '@/components/TermsModal';

export default function CommissionTermsButton() {
  const [open, setOpen] = useState(false);

  /*
   * Prevent the page behind the modal
   * from scrolling while Terms are open.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          inline-flex
          items-center
          justify-center

          rounded-full
          border
          border-white/25

          bg-white/10

          px-6
          py-3

          text-xs
          uppercase
          tracking-[0.15em]
          text-white

          backdrop-blur-sm

          transition
          duration-200

          hover:bg-white/20
        "
      >
        Terms of Service
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <TermsModal
            open={open}
            onClose={() =>
              setOpen(false)
            }
          />,
          document.body,
        )}
    </>
  );
}
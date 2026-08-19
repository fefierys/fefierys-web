'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TermsModal({
  open,
  onClose,
}: TermsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="
            fixed inset-0 z-50
            flex items-center justify-center
            bg-[#6b6fa8]/55
            backdrop-blur-lg
            p-6
          "
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="
              relative
              w-full
              max-w-3xl
              max-h-[92vh]

              rounded-4xl
              border
              border-white/10

              bg-[#3A4D84]/60
              backdrop-blur-2xl

              text-white

              shadow-[0_30px_80px_rgba(70,70,120,0.25)]

              overflow-hidden
              flex
              flex-col
            "
            initial={{
              scale: 0.96,
              opacity: 0,
            }}
            animate={{
              scale: 1,
              opacity: 1,
            }}
            exit={{
              scale: 0.96,
              opacity: 0,
            }}
            transition={{
              duration: 0.25,
            }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* ==================================================
                CLOSE BUTTON
            ================================================== */}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close terms"
              className="
                absolute
                top-3
                right-3
                md:top-4
                md:right-4

                z-20

                flex
                h-11
                w-11

                md:h-10
                md:w-10

                items-center
                justify-center

                rounded-full

                text-2xl
                font-light
                leading-none

                text-white/60
                bg-white/10

                transition-all
                duration-200

                hover:bg-white/10
                hover:text-white

                active:scale-95

                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-white/40
              "
            >
              ×
            </button>

            {/* ==================================================
                HEADER
            ================================================== */}

            <div
              className="
                p-8
                pb-4
                md:p-5
                md:pb-2
              "
            >
              <h2 className="mb-2 text-3xl font-light">
                Terms of Service
              </h2>

              <p className="text-sm leading-relaxed text-white/80">
                These terms are here to make the commission process clear,
                transparent, and enjoyable for both of us.
              </p>

              <br />

              <p
                className="
                  text-sm
                  leading-relaxed
                  text-white/80
                  italic
                "
              >
                <strong>
                  &quot;All my commissions are delivered digitally.
                  The resolution and format will depend on each
                  client&apos;s needs&quot;
                </strong>
              </p>
            </div>

            {/* ==================================================
                SCROLLABLE CONTENT
            ================================================== */}

            <div
              className="
                flex-1
                overflow-y-auto
                overscroll-contain

                px-8
                pb-8

                md:px-10
                md:pb-10

                space-y-8
              "
            >

              {/* BOOKING */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Booking and Payment options
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  Commissions can be booked via Behance or through
                  direct contact ví­a Paypal. A portion of the payment
                  is required upfront, and the remainder is due upon
                  receipt of the sketch.

                  <br/>
                  Small projects under $100: 100% upfront
                  <br/>
                  Medium projects: 50% upfront
                  <br/>
                  Large projects ($1000+): 30% upfront
                </p>
              </section>

              {/* DELIVERY */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Delivery Time
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  The standard turnaround time ranges from one week
                  to one month depending on the artwork’s complexity,
                  while larger projects will be discussed directly
                  with the client.
                </p>
              </section>

              {/* REFUND */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Refund Policy
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  No refunds.
                </p>
              </section>

              {/* REVISIONS */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Brief & Revisions
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  To create the illustration, I’ll need a description
                  and/or reference images; a Pinterest/mood board is
                  always very helpful!

                  <br />

                  Revisions will be modifications that don’t require
                  redoing the entire sketch. The price includes three
                  revisions: two during the sketch stage and one in
                  the final stage.

                  <br />

                  In the final revision, we can make minor adjustments
                  to color, lighting, and details.
                </p>
              </section>

              {/* PERSONAL / COMMERCIAL */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Personal & Commercial Use
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  Artworks are for personal use with proper credit
                  unless commercial rights are explicitly requested
                  and purchased.

                  If the artwork will be used to produce physical
                  products for sale (such as prints, apparel,
                  stickers, books, or other merchandise), an
                  additional merchandising license fee will apply.
                </p>
              </section>

              {/* COPYRIGHT */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Copyright & Promotion
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  I retain the original copyright of the artwork and
                  reserve the right to post the process and final
                  piece in my professional portfolio.

                  If you need the illustration to be published after
                  a certain date or to be completely private, this
                  must be agreed upon at the beginning.
                </p>
              </section>

              {/* CANCELLATION */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Cancellation Right
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  I reserve the right to decline or cancel a
                  commission at any time if the client displays
                  disrespectful behavior or if the initial agreement
                  changes drastically.
                </p>
              </section>

              {/* COMMUNICATION */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Communication
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  We can communicate via email or Discord. I avoid
                  using platforms like Instagram or TikTok because
                  messages often glitch or get lost.

                  <br />

                  Clear and respectful communication helps the process
                  move smoothly. I will do my best to respond within
                  a reasonable timeframe, and I appreciate the same
                  courtesy from clients.
                </p>
              </section>

              {/* EXTRA INFO */}

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">
                  Extra info
                </h3>

                <p className="text-sm leading-relaxed text-white/80">
                  Base prices apply to standard designs. Highly
                  detailed or complex requests may be subject to an
                  additional complexity fee.
                  <br/>
                  The illustrations may have style updates on my portfolio over time. You can check if yours has been updated! 💜
                  <br />

                  <strong>
                    <em>
                      For anything not listed, feel free to request
                      a custom quote!
                    </em>
                  </strong>
                </p>
              </section>

            </div>

            {/* ==================================================
                FOOTER
            ================================================== */}

            <div className="bg-transparent p-4 sm:p-2">
              <button
                type="button"
                onClick={onClose}
                className="
                  w-full
                  rounded-full
                  border
                  border-white/20
                  bg-white/10

                  px-6
                  py-3

                  text-sm
                  uppercase
                  tracking-[0.15em]
                  text-white

                  transition
                  duration-150

                  hover:bg-white
                  hover:text-[#2f3558]

                  active:scale-[0.99]

                  focus:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-white/40
                "
              >
                I Understand
              </button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
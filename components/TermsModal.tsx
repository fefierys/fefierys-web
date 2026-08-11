'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TermsModal({ open, onClose }: TermsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="
            fixed inset-0 z-50 flex items-center justify-center
            bg-[#6b6fa8]/55 backdrop-blur-lg p-6
          "
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="
              w-full max-w-3xl max-h-[85vh]
              rounded-4xl border border-white/10
              bg-[#3A4D84]/60 backdrop-blur-2xl
              text-white shadow-[0_30px_80px_rgba(70,70,120,0.25)]
              overflow-hidden flex flex-col
            "
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-8 pb-4 md:p-10 md:pb-6">
              <h2 className="mb-2 text-3xl font-light">
                Terms of Service
              </h2>

              <p className="text-white/80">
                These terms are here to make the commission process clear,
                transparent, and enjoyable for both of us.
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-8 pb-8 md:px-10 md:pb-10 space-y-8">
              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Payment</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  A 50% upfront payment is required before any work begins.
                  The remaining 50% is due upon completion, before the final
                  high-resolution files are delivered. Payments are made in USD
                  through the agreed payment method.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Revisions</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  Reasonable revisions are included during the sketch and
                  refinement stages. Major changes requested after a stage has
                  been approved may incur an additional fee.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Turnaround Time</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  Completion times vary depending on the complexity of the
                  commission and current workload. Any estimated delivery date
                  is an estimate rather than a guarantee.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Copyright & Usage</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  Unless an extended commercial or merchandising license is
                  purchased, the artwork is provided for personal use or the
                  specific licensed purpose discussed during the commission.
                  Redistribution, resale, or use in merchandise is not
                  permitted without prior agreement.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Commercial Use</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  Commercial use licenses are available for projects such as
                  book publication, monetized streaming, promotional campaigns,
                  or other business-related purposes. The exact scope of
                  commercial rights will be agreed upon before work begins.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Merchandising License</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  If the artwork will be used to produce physical products for
                  sale (such as prints, apparel, stickers, books, or other
                  merchandise), an additional merchandising license fee will
                  apply.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Cancellations & Refunds</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  If a commission is cancelled before work has started, the
                  initial payment will be refunded. Once work has begun,
                  refunds will depend on the amount of work already completed.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Portfolio Rights</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  I reserve the right to display completed artwork in my
                  portfolio, social media, and promotional materials unless a
                  confidentiality agreement has been arranged beforehand.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-medium text-white">Communication</h3>
                <p className="text-sm leading-relaxed text-white/80">
                  Clear and respectful communication helps the process move
                  smoothly. I will do my best to respond within a reasonable
                  timeframe, and I appreciate the same courtesy from clients.
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 bg-transparent">
              <button
                onClick={onClose}
                className="
                  w-full rounded-full border border-white/20 bg-white/10
                  px-6 py-3 text-sm uppercase tracking-[0.15em]
                  text-white transition duration-150
                  hover:bg-white hover:text-[#2f3558]
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
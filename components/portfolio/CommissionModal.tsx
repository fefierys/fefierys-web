 'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface CommissionOption {
  title: string;
  price: string;
  description: string;
}

export interface CommissionNote {
  title: string;
  details?: string[];
}

export interface CommissionData {
  id: string;
  title: string;
  subtitle: string;
  heroImage: string;
  options: CommissionOption[];
  notes: CommissionNote[];
  cta: string;
}

interface CommissionModalProps {
  open: boolean;
  onClose: () => void;
  commission: CommissionData;
  styleTitle: string;
  collectionTitle: string;
  categoryTitle: string;
}

export default function CommissionModal({
  open,
  onClose,
  commission,
  styleTitle,
  collectionTitle,
  categoryTitle,
}: CommissionModalProps) {
  const [selectedOption, setSelectedOption] = useState(
    commission.options[0]?.title ?? ''
  );

  const [showIndieBubble, setShowIndieBubble] = useState(true);

  const router = useRouter();

  const handleClose = () => {
    setSelectedOption(commission.options[0]?.title ?? '');
    setShowIndieBubble(true);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    onClose();
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedOption(commission.options[0]?.title ?? '');
        setShowIndieBubble(true);

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, commission, onClose]);

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
          onClick={handleClose}
        >
          <motion.div
            className="
              relative
              w-full max-w-4xl max-h-[91vh]
              rounded-[2rem] border border-white/10
              bg-[#5966A5]/55 backdrop-blur-2xl
              text-white shadow-[0_30px_80px_rgba(70,70,120,0.25)]
              overflow-visible
              flex flex-col
            "
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 pt-8 md:px-10 md:pt-10 pb-6">
              <h2 className="mb-3 text-4xl font-light tracking-tight text-white">
                {commission.title}
              </h2>

              <p className="whitespace-pre-line text-white/80 leading-relaxedtext-white/80">
                {commission.subtitle}
              </p>
            </div>

            {/* Contenido con scroll */}
            <div
              className="
                flex-1 overflow-y-auto overscroll-contain
                px-8 pb-8 md:px-10 md:pb-10
              "
            >
              {/* Hero Image */}
              <div className="mb-6">
                <div className="relative aspect-[16/6] w-full overflow-hidden rounded-[1.5rem] border border-white/10">
                  <Image
                    src={commission.heroImage}
                    alt={commission.title}
                    fill
                    className="object-cover object-center"
                    priority
                  />

                  
                </div>
              </div>

              {/* Opciones */}
              <div className="mb-6 grid gap-5 md:grid-cols-2">
                {commission.options.map((option) => {
                  const isSelected = selectedOption === option.title;

                  return (
                    <button
                      key={option.title}
                      type="button"
                      onClick={() => setSelectedOption(option.title)}
                      className={`
                        rounded-2xl border p-6 text-left
                        transition duration-200
                        ${
                          isSelected
                            ? 'border-white/30 bg-white/18 shadow-lg'
                            : 'border-white/10 bg-white/6 hover:border-white/20 hover:bg-white/10'
                        }
                      `}
                    >
                      <h3 className="mb-2 text-xl font-medium text-white">
                        {option.title}
                      </h3>

                      <p className="mb-3 text-2xl font-light text-white whitespace-pre-wrap">
                        {option.price}
                      </p>

                      <p className="text-sm text-white/65">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Notas */}
              <ul className="space-y-4 text-sm text-white/80">
                {commission.notes.map((note, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="mt-1 text-white/60">•</span>

                    <div>
                      <p className="text-white">{note.title}</p>

                      {note.details && (
                        <div className="mt-2 space-y-1 pl-4 text-white/70">
                          {note.details.map((detail) => (
                            <p key={detail}>{detail}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Chibi + burbuja (desktop) */}
            {showIndieBubble && (
              <div
                className="
                  absolute
                  -right-120
                  -bottom-10
                  hidden lg:block
                  w-100
                  h-90
                "
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative rounded-2xl border border-white/10 bg-white/12 p-4 backdrop-blur-xl shadow-lg">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowIndieBubble(false);
                    }}
                    className="
                      absolute -top-2 -right-2
                      flex h-6 w-6 items-center justify-center
                      rounded-full border border-white/20 bg-white/10
                      text-white/80 transition
                      hover:bg-white hover:text-[#2f3558]
                    "
                    aria-label="Close indie author message"
                  >
                    ×
                  </button>

                  <div
                    className="
                      absolute left-58 top-full h-4 w-4
                      -translate-y-2 rotate-45
                      border-l border-b border-white/10
                      bg-white/12
                    "
                  />

                  <p className="text-[11px] leading-relaxed text-white/90">
                    If you’re an indie author with a special or tight budget, please don’t
                    hesitate to{' '}
                    <Link
                      href="/contact"
                      className="underline underline-offset-2 decoration-white/60 hover:decoration-white transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      contact me 
                    </Link>{' '}
                    directly so we can work out a special agreement!
                  </p>
                </div>

                <Image
                  src="/images/commissions/indie-autor/fefi-love.gif"
                  alt="Fefierys chibi"
                  width={200}
                  height={120}
                  className="mt-4 ml-40 drop-shadow-2xl"
                />
              </div>
            )}

            {/* Footer fijo */}
            <div className="p-6 bg-transparent">
              <button
                className="
                  w-full rounded-full border border-white/20 bg-white/10
                  px-6 py-3 text-sm uppercase tracking-[0.15em]
                  text-white transition duration-150
                  hover:bg-white hover:text-[#2f3558]
                "
                onClick={() => {
                  router.push(
                    `/contact?style=${encodeURIComponent(
                      styleTitle
                    )}&collection=${encodeURIComponent(
                      collectionTitle
                    )}&category=${encodeURIComponent(
                      categoryTitle
                    )}&option=${encodeURIComponent(selectedOption)}`
                  );
                }}
              >
                Start {selectedOption} commission
              </button>
            </div>
          </motion.div>

          {/* Chibi + burbuja (bloque mobile: flotante con botón cerrar) */}
          {showIndieBubble && (
            <div
              className="
                lg:hidden
                fixed
                bottom-4
                right-4
                z-[60]
                w-56
                pointer-events-auto
              "
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative rounded-2xl border border-white/10 bg-[#5966A5]/80 p-3 backdrop-blur-xl shadow-2xl">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowIndieBubble(false);
                  }}
                  className="
                    absolute -top-2 -right-2
                    flex h-6 w-6 items-center justify-center
                    rounded-full border border-white/20 bg-white/10
                    text-white/80 transition
                    hover:bg-white hover:text-[#2f3558]
                  "
                  aria-label="Close indie author message"
                >
                  ×
                </button>

                <div
                  className="
                    absolute right-8 top-full h-3 w-3
                    -translate-y-1.5 rotate-45
                    border-r border-b border-white/10
                    bg-[#5966A5]/80
                  "
                />

                <p className="text-[11px] leading-relaxed text-white/90">
                  If you’re an indie author with a special or tight budget, please don’t
                  hesitate to{' '}
                  <Link
                    href="/contact"
                    className="underline underline-offset-2 decoration-white/60 hover:decoration-white transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    contact me 
                  </Link>{' '}
                  directly so we can work out a special agreement!
                </p>
              </div>

              <Image
                src="/images/commissions/indie-autor/fefi-love.gif"
                alt="Fefierys chibi"
                width={84}
                height={84}
                className="mt-2 ml-auto drop-shadow-2xl"
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

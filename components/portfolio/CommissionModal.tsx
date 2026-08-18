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
        handleClose();
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
            bg-[#6b6fa8]/55 backdrop-blur-lg p-4 sm:p-6
          "
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="
              relative
              w-full max-w-4xl max-h-[92vh]
              rounded-[2rem] border border-white/10
              bg-[#5966A5]/55 backdrop-blur-2xl
              text-white
              shadow-[0_30px_80px_rgba(70,70,120,0.25)]
              overflow-visible
              flex flex-col
            "
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* BOTÓN CERRAR */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close commission modal"
              className="
                absolute
                top-3
                right-3
                md:top-5
                md:right-5
                z-50

                flex
                h-11
                w-11
                md:h-10
                md:w-10
                items-center
                justify-center

                rounded-full
                border
                border-white/15
                bg-black/10
                backdrop-blur-md

                text-2xl
                font-light
                leading-none
                text-white/75

                transition-all
                duration-100

                hover:bg-white/15
                hover:text-white
                hover:scale-105

                active:scale-95
              "
            >
              ×
            </button>

            {/* HEADER */}
            <div className="px-6 pt-6 pb-4 sm:px-8 md:px-10 md:pt-8">
              <h2 className="
                mb-2 
                text-2xl
                font-light 
                tracking-tight
                text-white 
                sm:text-3xl 
                pr-10">
                {commission.title}
              </h2>

              <p className="text-sm whitespace-pre-line leading-relaxed text-white/80">
                {commission.subtitle}
              </p>
            </div>

            {/* CONTENIDO CON SCROLL */}
            <div
              className="
                flex-1
                overflow-y-auto
                overscroll-contain
                px-6
                pb-6
                sm:px-8
                sm:pb-8
                md:px-10
                md:pb-10
              "
            >
              {/* HERO IMAGE */}
              <div className="mb-4">
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

              {/* OPCIONES */}
              <div className="mb-6 grid gap-5 md:grid-cols-2">
                {commission.options.map((option) => {
                  const isSelected = selectedOption === option.title;

                  return (
                    <button
                      key={option.title}
                      type="button"
                      onClick={() => setSelectedOption(option.title)}
                      className={`
                        rounded-2xl
                        border
                        p-4
                        sm:p-6
                        text-left
                        transition
                        duration-200

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

                      <p className="mb-3 whitespace-pre-wrap text-2xl font-light text-white">
                        {option.price}
                      </p>

                      <p className="text-sm text-white/65">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* NOTAS */}
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

            {/* CHIBI + BURBUJA DESKTOP */}
            {showIndieBubble && (
              <div
                className="
                  absolute
                  -right-120
                  -bottom-10
                  hidden
                  h-90
                  w-100
                  xl:block
                "
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative rounded-2xl border border-white/10 bg-white/12 p-4 shadow-lg backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowIndieBubble(false);
                    }}
                    className="
                      absolute
                      -top-2
                      -right-2
                      flex
                      h-6
                      w-6
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-white/20
                      bg-white/10
                      text-white/80
                      transition

                      hover:bg-white
                      hover:text-[#2f3558]
                    "
                    aria-label="Close indie author message"
                  >
                    ×
                  </button>

                  <div
                    className="
                      absolute
                      left-58
                      top-full
                      h-4
                      w-4
                      -translate-y-2
                      rotate-45
                      border-l
                      border-b
                      border-white/10
                      bg-white/12
                    "
                  />

                  <p className="text-[11px] leading-relaxed text-white/90">
                    If you’re an indie author with a special or tight budget,
                    please don’t hesitate to{' '}
                    <Link
                      href="/contact"
                      className="underline underline-offset-2 decoration-white/60 transition hover:decoration-white"
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
                  unoptimized
                  className="ml-40 mt-4 drop-shadow-2xl"
                />
              </div>
            )}

            {/* FOOTER FIJO */}
            <div className="bg-transparent p-4 sm:p-2">
              <button
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

          {/* CHIBI + BURBUJA MOBILE / TABLET */}
          {showIndieBubble && (
            <>
              {/* BURBUJA / MENSAJE */}
              <div
                className="
                  fixed
                  bottom-28
                  right-4
                  z-60
                  w-56
                  xl:hidden
                  pointer-events-auto
                "
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="
                    relative
                    rounded-2xl
                    border border-white/10
                    bg-[#5966A5]/80
                    p-3
                    shadow-2xl
                    backdrop-blur-xl
                  "
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowIndieBubble(false);
                    }}
                    className="
                      absolute
                      -top-2
                      -right-2
                      flex
                      h-6
                      w-6
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-white/20
                      bg-white/10
                      text-white/80
                      transition

                      hover:bg-white
                      hover:text-[#2f3558]
                    "
                    aria-label="Close indie author message"
                  >
                    ×
                  </button>

                  <div
                    className="
                      absolute
                      right-8
                      top-full
                      h-3
                      w-3
                      -translate-y-1.5
                      rotate-45
                      border-r
                      border-b
                      border-white/10
                      bg-[#5966A5]/80
                    "
                  />

                  <p className="text-[11px] leading-relaxed text-white/90">
                    If you’re an indie author with a special or tight budget,
                    please don’t hesitate to{' '}
                    <Link
                      href="/contact"
                      className="
                        underline
                        underline-offset-2
                        decoration-white/60
                        transition
                        hover:decoration-white
                        inline-block
                        py-1
                      "
                      onClick={(e) => e.stopPropagation()}
                    >
                      contact me
                    </Link>{' '}
                    directly so we can work out a special agreement!
                  </p>
                </div>
              </div>


              {/* CHIBI DECORATIVO */}
              <div
                className="
                  fixed
                  bottom-4
                  right-4
                  z-60
                  xl:hidden
                  pointer-events-none
                "
              >
                <Image
                  src="/images/commissions/indie-autor/fefi-love.gif"
                  alt="Fefierys chibi"
                  width={84}
                  height={84}
                  unoptimized
                  className="
                    drop-shadow-2xl
                  "
                />
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
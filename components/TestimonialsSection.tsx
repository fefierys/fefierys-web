'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { testimonials } from '@/data/testimonials';
import { motion, AnimatePresence } from 'framer-motion';

export default function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Dirección de la navegación
  const [direction, setDirection] = useState(1);

  // Cantidad de testimonios visibles según el tamaño de pantalla
  const [visibleCount, setVisibleCount] = useState(3);

  const total = testimonials.length;

  useEffect(() => {
    const updateVisibleCount = () => {
      if (window.innerWidth < 768) {
        // Móvil
        setVisibleCount(1);
      } else if (window.innerWidth < 1024) {
        // Tablet
        setVisibleCount(2);
      } else {
        // Desktop
        setVisibleCount(3);
      }
    };

    updateVisibleCount();

    window.addEventListener('resize', updateVisibleCount);

    return () => {
      window.removeEventListener('resize', updateVisibleCount);
    };
  }, []);

  if (total === 0) {
    return null;
  }

  const goPrevious = () => {
    setDirection(-1);

    setCurrentIndex((current) =>
      (current - 1 + total) % total
    );
  };

  const goNext = () => {
    setDirection(1);

    setCurrentIndex((current) =>
      (current + 1) % total
    );
  };

  // Cantidad de testimonios visibles:
  // Móvil   → 1
  // Tablet  → 2
  // Desktop → 3
  const visibleTestimonials = Array.from(
    { length: Math.min(visibleCount, total) },
    (_, offset) => {
      const index = (currentIndex + offset) % total;

      return {
        testimonial: testimonials[index],
        index,
      };
    }
  );

  return (
    <section
      className="
        px-6
        py-16
        md:py-20

        overflow-x-clip
      "
    >
      <div className="mx-auto max-w-6xl text-white">

        {/* HEADER */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-light md:text-5xl">
            Testimonials
          </h2>

          <p className="mx-auto max-w-2xl text-white">
            A few words from people I’ve had the pleasure of working with.
          </p>
        </div>

        {/* CAROUSEL */}
        <div
          className="
            relative

            md:px-2
            lg:px-0
          "
        >

          {/* FLECHA IZQUIERDA */}
          <button
            type="button"
            onClick={goPrevious}
            aria-label="Previous testimonial"
            className="
              absolute
              left-2
              top-1/2
              z-20

              -translate-y-1/2

              hidden
              md:flex
              h-11
              w-11
              items-center
              justify-center

              rounded-full
              border
              border-white/15
              bg-white/10
              backdrop-blur-md

              text-xl
              text-white/80

              transition-all
              duration-300

              hover:scale-105
              hover:bg-white/20
              hover:text-white

              active:scale-95

              lg:left-0
              lg:-translate-x-1/2
            "
          >
            ‹
          </button>

          {/* TESTIMONIOS */}
          <div
            className="
              grid
              grid-cols-1
              gap-8
              md:grid-cols-2
              lg:grid-cols-3
            "
          >
            <AnimatePresence
              mode="popLayout"
              initial={false}
              custom={direction}
            >
              {visibleTestimonials.map(
                ({ testimonial, index }) => (
                  <motion.div
                    key={`${testimonial.id}-${index}`}
                    custom={direction}
                    variants={{
                      enter: (direction: number) => ({
                        opacity: 0,
                        x: direction > 0 ? 35 : -35,
                        scale: 0.985,
                      }),

                      center: {
                        opacity: 1,
                        x: 0,
                        scale: 1,
                      },

                      exit: (direction: number) => ({
                        opacity: 0,
                        x: direction > 0 ? -35 : 35,
                        scale: 0.985,
                      }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: 0.55,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="
                      glass-card
                      rounded-3xl
                      p-6
                      flex
                      flex-col

                      h-[680px]
                      md:h-[760px]
                      lg:h-[760px]

                      min-w-0
                      will-change-transform
                    "
                  >

                    {/* IMAGEN */}
                    <div
                      className="
                        relative
                        mb-6
                        aspect-[4/5]
                        w-full
                        overflow-hidden
                        rounded-2xl
                        shrink-0
                      "
                    >
                      <Image
                        src={testimonial.image}
                        alt={testimonial.name}
                        fill
                        sizes="
                          (max-width: 767px) 90vw,
                          (max-width: 1023px) 43vw,
                          30vw
                        "
                        className="
                          object-cover
                          transition-transform
                          duration-700
                        "
                      />
                    </div>

                    {/* QUOTE */}
                    <div
                      className="
                        flex-1
                        min-h-0
                        overflow-y-auto
                        pr-1

                        scrollbar-thin
                        scrollbar-thumb-white/20
                        scrollbar-track-transparent
                      "
                    >
                      <p
                        className="
                          leading-relaxed
                          italic
                          text-white/80
                        "
                      >
                        “{testimonial.quote}”
                      </p>
                    </div>

                    {/* INFO */}
                    <div
                      className="
                        mt-6
                        border-t
                        border-white/10
                        pt-4
                        shrink-0
                      "
                    >
                      <a
                          href={testimonial.socialUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                        <p className="font-medium text-white">
                          {testimonial.name}
                        </p>
                      </a>

                      <p className="text-sm text-white/60">
                        {testimonial.role}
                      </p>

                      <p className="text-sm text-white/60">
                        {testimonial.commissionType}
                      </p>

                      {testimonial.social && (
                        <a
                          href={testimonial.socialUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="
                            text-sm
                            text-white/70
                            decoration-white/30
                            transition

                            hover:text-white
                            hover:decoration-white
                          "
                        >
                          {testimonial.social}
                        </a>
                      )}
                    </div>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>

          {/* FLECHA DERECHA */}
          <button
            type="button"
            onClick={goNext}
            aria-label="Next testimonial"
            className="
              absolute
              right-2
              top-1/2
              z-20

              -translate-y-1/2

              hidden
              md:flex
              h-11
              w-11
              items-center
              justify-center

              rounded-full
              border
              border-white/15
              bg-white/10
              backdrop-blur-md

              text-xl
              text-white/80

              transition-all
              duration-300

              hover:scale-105
              hover:bg-white/20
              hover:text-white

              active:scale-95

              lg:right-0
              lg:translate-x-1/2
            "
          >
            ›
          </button>

          {/* FLECHAS MÓVIL */}
          <div
            className="
              mt-6
              flex
              items-center
              justify-center
              gap-4

              md:hidden
            "
          >
            <button
              type="button"
              onClick={goPrevious}
              aria-label="Previous testimonial"
              className="
                flex
                h-10
                w-10
                items-center
                justify-center

                rounded-full
                border
                border-white/15
                bg-white/10

                text-lg
                text-white/80

                backdrop-blur-md

                transition-all
                duration-300

                hover:scale-105
                hover:bg-white/20
                hover:text-white

                active:scale-95
              "
            >
              ‹
            </button>

            <button
              type="button"
              onClick={goNext}
              aria-label="Next testimonial"
              className="
                flex
                h-10
                w-10
                items-center
                justify-center

                rounded-full
                border
                border-white/15
                bg-white/10

                text-lg
                text-white/80

                backdrop-blur-md

                transition-all
                duration-300

                hover:scale-105
                hover:bg-white/20
                hover:text-white

                active:scale-95
              "
            >
              ›
            </button>
          </div>
        </div>

        {/* INDICADORES */}
        {total > 1 && (
          <div className="mt-10 flex items-center justify-center">
            <div className="flex items-center gap-2">
              {testimonials.map((testimonial, index) => (
                <button
                  key={testimonial.id}
                  type="button"
                  onClick={() => {
                    setDirection(
                      index > currentIndex ? 1 : -1
                    );

                    setCurrentIndex(index);
                  }}
                  aria-label={`Go to testimonial ${index + 1}`}
                  className="group py-2"
                >
                  <span
                    className={`
                      block
                      h-px
                      rounded-full

                      transition-all
                      duration-500

                      ${
                        currentIndex === index
                          ? 'w-8 bg-white'
                          : 'w-4 bg-white/25 group-hover:bg-white/50'
                      }
                    `}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
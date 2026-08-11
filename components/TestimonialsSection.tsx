'use client';

import Image from 'next/image';
import { testimonials } from '@/data/testimonials';

export default function TestimonialsSection() {
  return (
    <section className="px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl text-white">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-5xl font-light mb-4">
            Kind words from clients
          </h2>
          <p className="text-white/70 max-w-2xl mx-auto">
            A few words from people I’ve had the pleasure of working with.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="
                glass-card
                p-6
                rounded-3xl
                flex
                flex-col
                h-full
              "
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl mb-6">
                <Image
                  src={testimonial.image}
                  alt={testimonial.name}
                  fill
                  className="object-cover"
                />
              </div>

              <p className="text-white/80 italic leading-relaxed flex-1">
                “{testimonial.quote}”
              </p>

              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="font-medium text-white">
                  {testimonial.name}
                </p>

                <p className="text-sm text-white/60">
                  {testimonial.role}
                </p>

                <p className="text-sm text-white/60">
                  {testimonial.commissionType}
                </p>

                {testimonial.social && (
                  <p className="text-sm text-white/50 mt-1">
                    {testimonial.social}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
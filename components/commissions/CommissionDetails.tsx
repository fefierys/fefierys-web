'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { CommissionData } from '@/data/portfolio/commissions';

interface CommissionDetailsProps {
  commission: CommissionData;
  style: string;
  collection: string;
  category: string;
}

export default function CommissionDetails({
  commission,
  style,
  collection,
  category,
}: CommissionDetailsProps) {
  const router = useRouter();

  /*
   * No seleccionamos automáticamente la
   * primera opción.
   *
   * Queremos que el usuario pueda leer
   * tranquilamente antes de tomar cualquier
   * decisión.
   */
  const [
    selectedOption,
    setSelectedOption,
  ] = useState('');

  function handleInquiry() {
    if (!selectedOption) return;

    /*
     * Conservamos exactamente el contrato que
     * ya utiliza /contact:
     *
     * style
     * collection
     * category
     * option
     */
    const params = new URLSearchParams({
      style,
      collection,
      category,
      option: selectedOption,
    });

    router.push(
      `/contact?${params.toString()}`
    );
  }

  return (
    <section className="min-h-screen px-6 py-32 text-white">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <div className="mb-10 text-center">
          <p
            className="
              mb-4
              text-xs
              uppercase
              tracking-[0.22em]
              text-white/45
            "
          >
            {style}
            {' · '}
            {collection}
            {' · '}
            {category}
          </p>

          <h1 className="mb-5 text-4xl font-light md:text-6xl">
            {commission.title}
          </h1>

          <p
            className="
              mx-auto
              max-w-2xl
              whitespace-pre-line
              leading-relaxed
              text-white/70
            "
          >
            {commission.subtitle}
          </p>
        </div>

        {/* HERO */}
        <div
          className="
            relative
            mb-10
            aspect-[16/6]
            overflow-hidden
            rounded-[2rem]
            border border-white/10
          "
        >
          <Image
            src={commission.heroImage}
            alt={commission.title}
            fill
            priority
            className="object-cover object-center"
          />
        </div>

        {/* OPTIONS */}
        <div className="mb-14">
          <div className="mb-5">
            <p
              className="
                mb-2
                text-xs
                uppercase
                tracking-[0.2em]
                text-white/45
              "
            >
              Commission options
            </p>

            <p className="text-sm leading-relaxed text-white/55">
              Choose the option that seems
              closest to what you have in
              mind. You can still discuss the
              details with me before deciding
              anything.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {commission.options.map(
              (option) => {
                const isSelected =
                  selectedOption ===
                  option.title;

                return (
                  <button
                    key={option.title}
                    type="button"
                    onClick={() =>
                      setSelectedOption(
                        option.title
                      )
                    }
                    className={`
                      rounded-3xl
                      border
                      p-6
                      text-left
                      transition
                      duration-200
                      ${
                        isSelected
                          ? 'border-white/30 bg-white/16 shadow-lg'
                          : 'border-white/10 bg-white/6 hover:border-white/20 hover:bg-white/10'
                      }
                    `}
                  >
                    <div
                      className="
                        mb-4
                        flex
                        items-start
                        justify-between
                        gap-4
                      "
                    >
                      <h2 className="text-xl font-medium">
                        {option.title}
                      </h2>

                      <span
                        aria-hidden="true"
                        className={`
                          mt-1
                          h-4
                          w-4
                          shrink-0
                          rounded-full
                          border
                          ${
                            isSelected
                              ? 'border-white bg-white'
                              : 'border-white/35'
                          }
                        `}
                      />
                    </div>

                    <p className="mb-3 text-2xl font-light">
                      {option.price}
                    </p>

                    <p className="text-sm leading-relaxed text-white/60">
                      {option.description}
                    </p>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ADDITIONAL INFORMATION */}
        {commission.notes.length > 0 && (
          <div
            className="
              mb-16
              rounded-3xl
              border border-white/10
              bg-white/6
              p-6
              md:p-8
            "
          >
            <p
              className="
                mb-6
                text-xs
                uppercase
                tracking-[0.2em]
                text-white/45
              "
            >
              Additional information
            </p>

            <div className="space-y-6">
              {commission.notes.map(
                (note, index) => (
                  <div
                    key={`${note.title}-${index}`}
                  >
                    <p className="text-sm text-white/90">
                      {note.title}
                    </p>

                    {note.details && (
                      <div className="mt-2 space-y-1">
                        {note.details.map(
                          (detail) => (
                            <p
                              key={detail}
                              className="
                                text-sm
                                leading-relaxed
                                text-white/60
                              "
                            >
                              {detail}
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* HOW IT WORKS */}
        <div className="mb-16">
          <p
            className="
              mb-7
              text-center
              text-xs
              uppercase
              tracking-[0.22em]
              text-white/45
            "
          >
            How it works
          </p>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              [
                '01',
                'Tell me about your project',
                'Share your idea, references and anything important about your project.',
              ],
              [
                '02',
                'We talk about the details',
                'We can discuss scope, timing, budget and what works best for you.',
              ],
              [
                '03',
                'You receive a quote',
                'I prepare a proposal based on what your project actually needs.',
              ],
              [
                '04',
                'You decide',
                'Review the proposal first. Sending the inquiry itself does not commit you to anything.',
              ],
            ].map(
              ([number, title, description]) => (
                <div
                  key={number}
                  className="
                    rounded-3xl
                    border
                    border-white/10
                    bg-white/6
                    p-6
                  "
                >
                  <p className="mb-5 text-xs tracking-[0.2em] text-white/35">
                    {number}
                  </p>

                  <h2 className="mb-3 text-lg font-light">
                    {title}
                  </h2>

                  <p className="text-sm leading-relaxed text-white/60">
                    {description}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        {/* INDIE AUTHORS */}
        <div
          className="
            mb-16
            grid
            items-center
            gap-6
            overflow-hidden
            rounded-[2rem]
            border border-white/10
            bg-white/8
            p-7
            backdrop-blur-xl
            md:grid-cols-[1fr_auto]
            md:p-10
          "
        >
          <div>
            <p className="mb-3 text-2xl font-light">
              Indie author or working with a
              smaller budget?
            </p>

            <p className="max-w-2xl leading-relaxed text-white/65">
              Please feel free to tell me
              about your project and budget.
              When possible, I&apos;m happy
              to explore options that better
              fit your scope.
            </p>
          </div>

          <Image
            src="/images/commissions/indie-autor/fefi-love.gif"
            alt="Fefierys chibi"
            width={150}
            height={150}
            unoptimized
            className="
              mx-auto
              drop-shadow-2xl
              md:mx-0
            "
          />
        </div>

        {/* FINAL CTA */}
        <div
          className="
            rounded-[2rem]
            border border-white/10
            bg-white/8
            p-8
            text-center
            backdrop-blur-xl
            md:p-10
          "
        >
          {selectedOption ? (
            <>
              <p className="mb-2 text-sm text-white/50">
                Interested in
              </p>

              <h2 className="mb-7 text-2xl font-light">
                {selectedOption}
              </h2>
            </>
          ) : (
            <>
              <h2 className="mb-3 text-2xl font-light">
                Found something that fits
                your project?
              </h2>

              <p className="mb-7 text-sm text-white/55">
                Select one of the options
                above to include it with your
                inquiry.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={handleInquiry}
            disabled={!selectedOption}
            className="
              inline-flex
              w-full
              max-w-md
              items-center
              justify-center
              rounded-full
              border border-white/20
              bg-white/10
              px-7
              py-3.5
              text-xs
              uppercase
              tracking-[0.16em]
              transition
              hover:bg-white
              hover:text-[#2f3558]
              disabled:cursor-not-allowed
              disabled:opacity-40
              disabled:hover:bg-white/10
              disabled:hover:text-white
            "
          >
            Tell me about your project
          </button>

          <p className="mt-4 text-xs text-white/45">
            No payment or commitment is
            required to send an inquiry.
          </p>
        </div>
      </div>
    </section>
  );
}
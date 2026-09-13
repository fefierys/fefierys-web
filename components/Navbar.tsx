'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface NavbarPortfolioSection {
  slug: string;
  label: string;
}

interface NavbarProps {
  portfolioSections: NavbarPortfolioSection[];
}

export default function Navbar({
  portfolioSections,
}: NavbarProps) {
  const [portfolioOpen, setPortfolioOpen] =
    useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [
    mobilePortfolioOpen,
    setMobilePortfolioOpen,
  ] = useState(false);

  /*
   * ============================================================
   * BREAKPOINTS
   * ============================================================
   *
   * < 768px:
   * Mobile menu.
   *
   * 768px - 1024px:
   * Horizontal navigation + Portfolio by tap.
   *
   * > 1024px:
   * Horizontal navigation + Portfolio by hover.
   */

  const MOBILE_BREAKPOINT = 768;
  const DESKTOP_BREAKPOINT = 1024;

  /*
   * ============================================================
   * RESIZE
   * ============================================================
   */

  useEffect(() => {
    const handleResize = () => {
      /*
       * Leaving mobile:
       * close the mobile panel.
       */
      if (
        window.innerWidth >=
        MOBILE_BREAKPOINT
      ) {
        setMobileMenuOpen(false);
        setMobilePortfolioOpen(false);
      }

      /*
       * Moving into desktop:
       * reset the click-controlled Portfolio
       * dropdown so hover takes over cleanly.
       */
      if (
        window.innerWidth >
        DESKTOP_BREAKPOINT
      ) {
        setPortfolioOpen(false);
      }
    };

    window.addEventListener(
      'resize',
      handleResize,
    );

    return () => {
      window.removeEventListener(
        'resize',
        handleResize,
      );
    };
  }, []);

  /*
   * ============================================================
   * ESCAPE
   * ============================================================
   */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key !== 'Escape') {
        return;
      }

      setMobileMenuOpen(false);
      setMobilePortfolioOpen(false);
      setPortfolioOpen(false);
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, []);

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  const isDesktop = () => {
    return (
      window.innerWidth >
      DESKTOP_BREAKPOINT
    );
  };

  const handlePortfolioClick = () => {
    /*
     * On desktop, Portfolio is controlled
     * through hover.
     *
     * Tablet uses click / tap.
     */
    if (!isDesktop()) {
      setPortfolioOpen(
        (current) => !current,
      );
    }
  };

  const closeMenus = () => {
    setPortfolioOpen(false);
    setMobileMenuOpen(false);
    setMobilePortfolioOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((current) => {
      const next = !current;

      /*
       * Whenever the whole mobile menu
       * closes, also collapse Portfolio.
       */
      if (!next) {
        setMobilePortfolioOpen(false);
      }

      return next;
    });
  };

  return (
    <nav
      className="
        fixed
        left-0
        top-0
        z-50
        w-full

        bg-[#111184]/20
        px-4
        py-3
        backdrop-blur-md
        shadow-lg

        transition-all
        duration-500

        md:px-8
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
        "
      >
        {/* ==================================================
            LOGO
        ================================================== */}

        <Link
          href="/"
          onClick={closeMenus}
          className="
            transition
            hover:text-white/70
          "
        >
          <Image
            src="/images/navbar/logo.webp"
            alt="Fefierys"
            width={360}
            height={97}
            sizes="
              (max-width: 767px) 120px,
              180px
            "
            className="
              h-auto
              w-[120px]
              md:w-[180px]
            "
            priority
          />
        </Link>

        {/* ==================================================
            MOBILE MENU BUTTON
        ================================================== */}

        <button
          type="button"
          onClick={toggleMobileMenu}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          className="
            inline-flex
            items-center
            gap-2

            rounded-full
            border
            border-white/10
            bg-white/[0.04]

            px-4
            py-2

            text-xs
            font-light
            tracking-wide
            text-white

            backdrop-blur-md

            transition
            duration-200

            hover:bg-white/10

            md:hidden
          "
        >
          <span>
            {mobileMenuOpen
              ? 'Close'
              : 'Menu'}
          </span>

          {mobileMenuOpen ? (
            /*
             * Close icon
             */
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          ) : (
            /*
             * Menu icon
             */
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M5 7h14" />
              <path d="M5 12h14" />
              <path d="M5 17h14" />
            </svg>
          )}
        </button>

        {/* ==================================================
            TABLET / DESKTOP NAVIGATION
        ================================================== */}

        <div
          className="
            hidden
            items-center

            gap-6
            md:flex
            md:gap-8
            lg:gap-10

            text-sm
            lg:text-lg

            font-light
            tracking-wide
            text-white

            [font-family:var(--font-lexend)]
          "
        >
          {/* HOME */}

          <Link
            href="/"
            onClick={closeMenus}
            className="
              transition
              hover:text-white/70
            "
          >
            Home
          </Link>

          {/* ==================================================
              PORTFOLIO
          ================================================== */}

          <div
            className="relative"
            onMouseEnter={() => {
              if (
                isDesktop()
              ) {
                setPortfolioOpen(
                  true
                );
              }
            }}
            onMouseLeave={() => {
              if (
                isDesktop()
              ) {
                setPortfolioOpen(
                  false
                );
              }
            }}
          >
            <button
              type="button"
              onClick={
                handlePortfolioClick
              }
              aria-expanded={portfolioOpen}
              className="
                inline-flex
                items-center
                gap-1.5

                transition
                hover:text-white/70
              "
            >
              Portfolio

              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`
                  h-3.5
                  w-3.5
                  transition-transform
                  duration-200
                  ${
                    portfolioOpen
                      ? 'rotate-180'
                      : ''
                  }
                `}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* Dropdown interaction area */}

            <div
              className={`
                absolute
                left-1/2
                top-full
                -translate-x-1/2

                pt-4

                transition-all
                duration-300

                ${
                  portfolioOpen
                    ? 'visible translate-y-0 opacity-100'
                    : 'pointer-events-none invisible -translate-y-2 opacity-0'
                }
              `}
            >
              <div
                className="
                  rounded-2xl

                  border
                  border-[#3A4D84]/10

                  bg-[#4a4594]/50
                  px-6
                  py-4

                  backdrop-blur-xl
                  shadow-xl

                  [font-family:var(--font-lexend)]
                "
              >
                {portfolioSections.map(
                  (section) => (
                    <Link
                      key={section.slug}
                      href={`/portfolio/${section.slug}`}
                      onClick={closeMenus}
                      className="
                        block
                        whitespace-nowrap

                        py-2

                        text-base
                        font-light
                        tracking-wide
                        text-white

                        transition
                        hover:text-white/70

                        md:text-lg
                      "
                    >
                      {section.label}
                    </Link>
                  ),
                )}
              </div>
            </div>
          </div>

          {/* ==================================================
              COMMISSIONS
          ================================================== */}

          <Link
            href="/commissions"
            onClick={closeMenus}
            className="
              transition
              hover:text-white/70
            "
          >
            Commissions
          </Link>

          {/* CONTACT */}

          <Link
            href="/contact"
            onClick={closeMenus}
            className="
              transition
              hover:text-white/70
            "
          >
            Contact
          </Link>

          {/* ABOUT */}

          <Link
            href="/about"
            onClick={closeMenus}
            className="
              transition
              hover:text-white/70
            "
          >
            About
          </Link>
        </div>
      </div>

      {/* ======================================================
          MOBILE NAVIGATION PANEL
      ====================================================== */}

      <div
        id="mobile-navigation"
        className={`
          grid
          transition-[grid-template-rows]
          duration-300
          ease-out

          md:hidden

          ${
            mobileMenuOpen
              ? 'grid-rows-[1fr]'
              : 'pointer-events-none grid-rows-[0fr]'
          }
        `}
      >
        <div className="overflow-hidden">
          <div
            className="
              mt-3
              overflow-hidden

              rounded-[1.5rem]
              border
              border-white/10

              bg-white/[0.025]
              p-2

              backdrop-blur-sm
              shadow-[0_16px_40px_rgba(20,20,70,0.12)]
            "
          >
            {/* ================================================
                PORTFOLIO MOBILE
            ================================================ */}

            <button
              type="button"
              onClick={() =>
                setMobilePortfolioOpen(
                  (current) => !current,
                )
              }
              aria-expanded={
                mobilePortfolioOpen
              }
              className="
                flex
                w-full
                items-center
                justify-between

                rounded-xl

                px-4
                py-3.5

                text-left
                text-sm
                font-light
                tracking-wide
                text-white

                transition
                hover:bg-white/[0.06]
              "
            >
              Portfolio

              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`
                  h-4
                  w-4

                  text-white/60

                  transition-transform
                  duration-200

                  ${
                    mobilePortfolioOpen
                      ? 'rotate-180'
                      : ''
                  }
                `}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* Portfolio children */}

            <div
              className={`
                grid
                transition-[grid-template-rows]
                duration-300

                ${
                  mobilePortfolioOpen
                    ? 'grid-rows-[1fr]'
                    : 'grid-rows-[0fr]'
                }
              `}
            >
              <div className="overflow-hidden">
                <div
                  className="
                    mx-3
                    mb-2

                    rounded-xl
                    border
                    border-white/10

                    px-2
                    py-1
                  "
                >
                  {portfolioSections.map(
                    (section) => (
                      <Link
                        key={section.slug}
                        href={`/portfolio/${section.slug}`}
                        onClick={closeMenus}
                        className="
                          block

                          rounded-lg

                          px-3
                          py-2.5

                          text-sm
                          font-light
                          text-white/70

                          transition

                          hover:bg-white/[0.06]
                          hover:text-white
                        "
                      >
                        {section.label}
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* ================================================
                COMMISSIONS
            ================================================ */}

            <Link
              href="/commissions"
              onClick={closeMenus}
              className="
                block

                rounded-xl

                px-4
                py-3.5

                text-sm
                font-light
                tracking-wide
                text-white

                transition
                hover:bg-white/[0.06]
              "
            >
              Commissions
            </Link>

            {/* CONTACT */}

            <Link
              href="/contact"
              onClick={closeMenus}
              className="
                block

                rounded-xl

                px-4
                py-3.5

                text-sm
                font-light
                tracking-wide
                text-white

                transition
                hover:bg-white/[0.06]
              "
            >
              Contact
            </Link>

            {/* ABOUT */}

            <Link
              href="/about"
              onClick={closeMenus}
              className="
                block

                rounded-xl

                px-4
                py-3.5

                text-sm
                font-light
                tracking-wide
                text-white

                transition
                hover:bg-white/[0.06]
              "
            >
              About
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { portfolioSections } from '@/data/portfolio';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);

  /*
   * Desktop:
   * > 1024px → hover
   *
   * Tablet + móvil:
   * <= 1024px → tap / click
   */
  const DESKTOP_BREAKPOINT = 1024;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  /*
   * Cerramos el dropdown si la pantalla cambia
   * desde tablet/móvil hacia desktop.
   *
   * No hacemos ningún setState directamente dentro
   * del efecto: solamente reaccionamos al evento resize.
   */
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > DESKTOP_BREAKPOINT) {
        setPortfolioOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isDesktop = () => {
    return window.innerWidth > DESKTOP_BREAKPOINT;
  };

  const handlePortfolioClick = () => {
    if (!isDesktop()) {
      setPortfolioOpen((prev) => !prev);
    }
  };

  const closePortfolio = () => {
    setPortfolioOpen(false);
  };

  return (
    <nav
      className="
        fixed
        top-0
        left-0
        z-50
        w-full

        px-4
        py-3
        md:px-8

        transition-all
        duration-500

        bg-[#111184]/20
        backdrop-blur-md
        shadow-lg
      "
    >
      <div className="flex items-center justify-between">

        {/* ==================================================
            LOGO
        ================================================== */}

        <Link
          href="/"
          onClick={closePortfolio}
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
            sizes="(max-width: 767px) 120px, 180px"
            className="
              h-auto
              w-[120px]
              md:w-[180px]
            "
            priority
          />
        </Link>

        {/* ==================================================
            NAVIGATION
        ================================================== */}

        <div
          className="
            flex
            items-center

            gap-3
            md:gap-10

            text-xs
            md:text-lg

            font-light
            tracking-wide
            text-white

            [font-family:var(--font-lexend)]
          "
        >

          {/* ==================================================
              HOME
          ================================================== */}

          <Link
            href="/"
            onClick={closePortfolio}
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

            /*
             * DESKTOP:
             * El dropdown se controla mediante hover.
             *
             * TABLET / MOBILE:
             * No hacemos nada aquí.
             * El dropdown se controla mediante tap.
             */
            onMouseEnter={() => {
              if (isDesktop()) {
                setPortfolioOpen(true);
              }
            }}
            onMouseLeave={() => {
              if (isDesktop()) {
                setPortfolioOpen(false);
              }
            }}
          >
            {/* Portfolio button */}

            <button
              type="button"
              onClick={handlePortfolioClick}
              className="
                transition
                hover:text-white/70
              "
            >
              Portfolio
            </button>

            {/* ==================================================
                DROPDOWN INTERACTION AREA

                IMPORTANTE:

                Antes teníamos:

                  mt-4

                Eso generaba un hueco real entre Portfolio
                y el dropdown.

                Ahora el contenedor ocupa ese espacio mediante
                padding-top, por lo que el cursor nunca abandona
                el área del elemento padre.

                Visualmente seguimos teniendo 16px de separación.
            ================================================== */}

            <div
              className={`
                absolute
                top-full
                left-1/2
                -translate-x-1/2

                pt-4

                transition-all
                duration-300

                ${
                  portfolioOpen
                    ? 'visible opacity-100 translate-y-0'
                    : 'invisible opacity-0 -translate-y-2 pointer-events-none'
                }
              `}
            >
              {/* ==================================================
                  DROPDOWN VISUAL CONTAINER
              ================================================== */}

              <div
                className="
                  rounded-2xl

                  bg-[#4a4594]/50
                  backdrop-blur-xl

                  border
                  border-[#3A4D84]/10

                  px-6
                  py-4

                  shadow-xl

                  [font-family:var(--font-lexend)]
                "
              >
                {portfolioSections.map((section) => (
                  <Link
                    key={section.slug}
                    href={`/portfolio/${section.slug}`}
                    onClick={closePortfolio}
                    className="
                      block
                      whitespace-nowrap

                      py-2

                      text-base
                      md:text-lg

                      font-light
                      tracking-wide

                      text-white

                      transition

                      hover:text-white/70
                    "
                  >
                    {section.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ==================================================
              CONTACT
          ================================================== */}

          <Link
            href="/contact"
            onClick={closePortfolio}
            className="
              transition
              hover:text-white/70
            "
          >
            Contact
          </Link>

          {/* ==================================================
              ABOUT
          ================================================== */}

          <Link
            href="/about"
            onClick={closePortfolio}
            className="
              transition
              hover:text-white/70
            "
          >
            About
          </Link>

        </div>
      </div>
    </nav>
  );
}
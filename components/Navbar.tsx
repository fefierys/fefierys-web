'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { portfolioSections } from '@/data/portfolio';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
        <Link
            href="/"
            onClick={() => setPortfolioOpen(false)}
            className="hover:text-white/70 transition"
          >
          <Image
            src="/images/navbar/logo.png"
            alt="Fefierys"
            width={140}
            height={48}
            className="h-auto w-[120px] md:w-[180px]"
            priority
          />
        </Link>

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
          <Link
            href="/"
            onClick={() => setPortfolioOpen(false)}
            className="hover:text-white/70 transition"
          >
            Home
          </Link>

          {/* PORTFOLIO DROPDOWN */}
          <div
            className="relative"
            onMouseEnter={() => {
              if (window.innerWidth >= 768) {
                setPortfolioOpen(true);
              }
            }}
            onMouseLeave={() => {
              if (window.innerWidth >= 768) {
                setPortfolioOpen(false);
              }
            }}
          >
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setPortfolioOpen((prev) => !prev);
                }
              }}
              className="hover:text-white/70 transition"
            >
              Portfolio
            </button>

            <div
              className={`
                absolute
                top-full
                left-1/2
                -translate-x-1/2
                mt-4

                rounded-2xl

              bg-[#4a4594]/50
                backdrop-blur-xl

                border
                border-[#3A4D84]/10

                px-6
                py-4

                shadow-xl

                [font-family:var(--font-lexend)]

                transition-all
                duration-300

                ${
                  portfolioOpen
                    ? 'opacity-100 visible translate-y-0'
                    : 'opacity-0 invisible -translate-y-2'
                }
              `}
            >
              {portfolioSections.map((section) => (
                <Link
                  key={section.slug}
                  href={`/portfolio/${section.slug}`}
                  onClick={() => setPortfolioOpen(false)}
                  className="
                    block
                    whitespace-nowrap
                    py-2

                    text-base
                    md:text-lg
                    font-light
                    tracking-wide

                    text-white

                    hover:text-white/70

                    transition
                  "
                >
                  {section.title}
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/contact"
            onClick={() => setPortfolioOpen(false)}
            className="hover:text-white/70 transition"
          >
            Contact
          </Link>

          <Link
            href="/about"
            onClick={() => setPortfolioOpen(false)}
            className="hover:text-white/70 transition"
          >
            About
          </Link>
        </div>
      </div>
    </nav>
  );
}
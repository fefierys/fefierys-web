import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="px-8 py-8 text-center text-sm text-white">

      <div className="mt-8 flex items-center justify-center gap-5">
        {/* BEHANCE */}
        <a
          href="https://www.behance.net/fefierys/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Behance"
          className="
            text-white
            transition-all
            duration-300
            hover:text-white
            hover:scale-110
          "
        >
          <span className="text-[22px] font-semibold tracking-tight">
            Be
          </span>
        </a>

        {/* INSTAGRAM */}
        <a
          href="https://www.instagram.com/fefierys"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="
            text-white
            transition-all
            duration-300
            hover:text-white
            hover:scale-110
          "
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[26px] w-[26px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
          </svg>
        </a>

        {/* TIKTOK */}
        <a
          href="https://www.tiktok.com/@fefierys"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="TikTok"
          className="
            text-white
            transition-all
            duration-300
            hover:text-white
            hover:scale-110
          "
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[26px] w-[26px]"
            fill="currentColor"
          >
            <path d="M16.6 3c.3 1.8 1.3 3.1 3.4 3.2v3.1c-1.2 0-2.3-.3-3.3-.9v6.2c0 4-2.9 6.4-6.4 6.4-3.5 0-5.8-2.2-5.8-5.3 0-3.4 2.7-5.8 6.4-5.8.3 0 .6 0 .9.1v3.2c-.3-.1-.6-.1-.9-.1-1.5 0-2.7.9-2.7 2.4 0 1.2.9 2.3 2.2 2.3 1.4 0 2.7-.9 2.7-3V3h3.5z" />
          </svg>
        </a>

        {/* ARTSTATION */}
        <a
          href="https://www.artstation.com/fefierys"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="ArtStation"
          className="
            transition-all
            duration-300
            hover:scale-110
          "
        >
          <Image
            src="/images/footer/logo-artstation.png"
            alt="ArtStation"
            width={26}
            height={26}
            className="
              h-5.5
              w-5.5
              object-contain
              transition-all
              duration-300
              hover:scale-100
              hover:opacity-100
            "
          />
        </a>

      </div>
      

      <br/>

      © {new Date().getFullYear()} Fefierys. All rights reserved.
      <br/>
      Made by Luan
    </footer>
  );
}
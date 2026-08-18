'use client';

import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <section
      className="
        min-h-screen

        flex
        items-center
        justify-center

        px-6

        pt-10
        
        lg:pt-0
      "
    >
      <div
        className="
          mx-auto
          max-w-5xl

          text-center
          text-white

          lg:-translate-y-4
        "
      >
        <h1
          className="
            text-3xl
            leading-tight

            lg:text-5xl

            font-medium
          "
        >
          Hi, I&apos;m Fefi! I illustrate fantasy characters and environments
          to help bring your creations to life.
        </h1>

        <h2
          className="
            mt-6
            text-xl
            lg:text-1xl
          "
        >
          Book illustrator | Character design | Fantasy art
        </h2>

        <p
          className="
            mt-6
            text-xl
            lg:text-2xl
          "
        >
          Welcome to my page 💜
        </p>

        <p
          className="
            mt-3

            text-lg
            lg:text-xl
          "
        >
          Below I&apos;ll show you a little bit of what I do.
        </p>


        {/* Scroll indicator */}
        <div
          className="
            mt-4
            lg:mt-10
          "
        >

          {/* Desktop */}
          <div
            className="
              hidden
              lg:flex

              flex-col
              items-center

              text-white/60
            "
          >
            <span className="animate-bounce text-3xl">
              ↓
            </span>
          </div>


          {/* Mobile */}
          <motion.div
            className="
              lg:hidden

              flex
              flex-col
              items-center
              gap-1

              text-white
            "
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <span className="text-3xl">
              👆
            </span>

            <span
              className="
                text-[10px]
                uppercase
                tracking-[0.18em]
              "
            >
              Swipe up
            </span>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
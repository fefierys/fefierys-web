'use client';

import AnimatedSection from './AnimatedSection';

export default function Hero() {
  return (
    <section
      className="
        min-h-screen
        flex
        items-center
        justify-center
        px-6
        pt-24
        sm:pt-24
        md:pt-0
      "
    >
      <AnimatedSection>
        <div
          className="
            mx-auto
            max-w-4xl
            text-center
            text-white
          "
        >
          <h1 className="text-4xl md:text-5xl lg:text-4xl font-medium">
            Hi, I&apos;m Fefi! I illustrate fantasy characters and environments to help bring your creations to life.
          </h1>
          <h2>
            <br/>Book illustrator | Character design | Fantasy art
          </h2>

          <p className="mt-6 text-xl leading-relaxed text-white/80">
            Welcome to my page 💜
          </p>

          <p className="mt-6 text-l leading-relaxed text-white/80">
            Below I&apos;ll show you a little bit of what I do.
          </p>

          <div className="mt-5 flex justify-center">
            <span className="animate-bounce text-3xl text-white/60">
              ↓
            </span>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}
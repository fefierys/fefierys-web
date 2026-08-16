import Image from 'next/image';

export default function AboutPage() {
  return (
    <main className="min-h-screen px-6 py-32">
      <section className="mx-auto max-w-6xl">
        <div className="glass-card px-8 py-12 md:px-12 md:py-16">
          <div className="grid gap-12 md:grid-cols-[320px_1fr] md:items-center">
            {/* Foto */}
            <div className="flex justify-center md:justify-start">
              <div className="relative h-64 w-64 overflow-hidden rounded-full border-white/15 md:h-80 md:w-80">
                <Image
                  src="/images/about/fefi-profile.png"
                  alt="Fefierys portrait"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Texto */}
            <div className="text-white">
              <h1 className="mb-6 text-4xl font-light md:text-5xl">
                About Fefierys
              </h1>

              <div className="space-y-6 text-[1.05rem] leading-8 text-white/80 text-justify">
                <p>
                  I’m <strong className="text-white font-medium">Josefa Santis</strong>,
                  better known as <strong className="text-white font-medium">Fefi / Fefierys</strong>.
                </p>

                <p>
                  I’m a fantasy illustrator with
                  <strong className="text-white font-medium"> 8 years of experience </strong>
                  creating characters, magical worlds.
                </p>

                <p>
                  Since I was a child, drawing has been my greatest passion, deeply fueled by my love for
                  <strong className="text-white font-medium"> video games and fantasy films</strong>.
                  That’s where most of my inspiration comes from. I’ve always been fascinated by the worlds of
                  <strong className="text-white font-medium"> The Lord of the Rings</strong>,
                  <strong className="text-white font-medium"> Dungeons & Dragons</strong>,
                  and various <strong className="text-white font-medium">MMORPGs</strong>.
                </p>

                <p>
                  Over the past few years, I began collaborating with
                  <strong className="text-white font-medium"> indie authors</strong>,
                  and I completely fell in love with this side of illustration.
                  Helping someone bring a story, a character, or an entire world to life is what I enjoy the most.
                </p>

                <p className="text-xl text-white italic">
                  <strong>I’d be thrilled to work with you and help bring your world to life!</strong>
                </p>
              </div>

              <div className="mt-10">
                <a
                  href="/portfolio/semi-realism"
                  className="
                    inline-flex items-center gap-2
                    rounded-full border border-white/20
                    bg-white/10 px-6 py-3
                    text-sm uppercase tracking-[0.16em]
                    text-white transition duration-300
                    hover:bg-white hover:text-[#2f3558]
                  "
                >
                  Start a commission
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
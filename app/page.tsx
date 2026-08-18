import Hero from '@/components/Hero';
import ImageTextSection from '@/components/ImageTextSection';
import TestimonialsSection from '@/components/TestimonialsSection';

export default function Home() {
  return (
    <main className="relative">
      {/* HERO FIJO / STICKY */}
      <section className="sticky top-0 h-screen z-0">
        <Hero />
      </section>

      {/* CONTENIDO QUE SUBE Y CUBRE EL HERO */}
      <section
        className="
          relative
          z-10
          bg-[#55609b]/90
          rounded-[2rem]

          -mt-10
          landscape:-mt-10

          md:-mt-20

          desktop-landscape:-mt-10

          pt-4
          md:pt-6

          shadow-[0_-30px_80px_rgba(70,70,120,0.25)]
        "
      >
        {/* My illustrations */}
        <div className="mt-2 md:mt-6">
          <ImageTextSection
            image="/images/home/scroll/home-illustrations.webp"
            title="My illustrations"
            text={`My work focuses on creating characters and worlds that exist in our imagination.
            In my portfolio, you'll find three main collections: Semirealism, Stylized and Chibis & Emotes, along with their respective subcategories.`}
            className="whitespace-pre-line"
          />
        </div>

        {/* My creative process */}
        <div className="mt-2 md:mt-6 pb-20 md:pb-24">
          <ImageTextSection
            video="/videos/home/scroll/home-process.mp4"
            title="My creative process"
            text="
              Here you can see my step-by-step process from the beginning of the sketch to the final result.
            "
            reverse
          />
        </div>

        {/* Testimonials */}
        <TestimonialsSection />
      </section>
    </main>
  );
}
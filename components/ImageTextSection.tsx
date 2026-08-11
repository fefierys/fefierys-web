'use client';

import Image from 'next/image';

interface ImageTextSectionProps {
  image?: string;
  video?: string;
  title: string;
  text: string;
  reverse?: boolean;
}

export default function ImageTextSection({
  image,
  video,
  title,
  text,
  reverse = false,
}: ImageTextSectionProps) {
  return (
    <section className="px-4 py-6 md:py-12">
      <div className="glass-card px-8 py-12 md:px-12 md:py-16">
        <div
          className="
            mx-auto
            max-w-6xl
            grid
            gap-10
            md:grid-cols-2
            md:items-center
          "
        >
          {/* Media (imagen o video) */}
          <div
            className={`relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-black/20 ${
              reverse ? 'md:order-2' : 'md:order-1'
            }`}
          >
            {video ? (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              >
                <source src={video} type="video/mp4" />
              </video>
            ) : image ? (
              <Image
                src={image}
                alt={title}
                fill
                className="object-cover"
              />
            ) : null}
          </div>

          {/* Texto */}
          <div
            className={`text-white ${
              reverse ? 'md:order-1' : 'md:order-2'
            }`}
          >
            <h2 className="mb-6 text-3xl font-light md:text-5xl">
              {title}
            </h2>

            <p className="text-lg leading-relaxed text-white/80">
              {text}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
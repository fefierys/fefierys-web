'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

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
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    if (!video || !mediaRef.current) return;

    const element = mediaRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadVideo(true);
          observer.disconnect();
        }
      },
      {
        // Empieza a cargar el video un poco antes
        // de que la sección entre en pantalla.
        rootMargin: '700px 0px',
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [video]);

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
            ref={mediaRef}
            className={`relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-black/20 ${
              reverse ? 'md:order-2' : 'md:order-1'
            }`}
          >
            {video ? (
              shouldLoadVideo ? (
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                >
                  <source src={video} type="video/mp4" />
                </video>
              ) : (
                <div
                  className="
                    absolute
                    inset-0
                    bg-black/20
                  "
                  aria-hidden="true"
                />
              )
            ) : image ? (
              <Image
                src={image}
                alt={title}
                fill
                sizes="
                  (max-width: 767px) calc(100vw - 64px),
                  (max-width: 1151px) calc((100vw - 136px) / 2),
                  536px
                "
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

            <p className="text-lg leading-relaxed text-white">
              {text}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
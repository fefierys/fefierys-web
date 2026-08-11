"use client";

import Image from "next/image";

interface LightboxProps {
  image: string;
  title: string;
  onClose: () => void;
}

export default function Lightbox({
  image,
  title,
  onClose,
}: LightboxProps) {
  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/80
        p-6
      "
      onClick={onClose}
    >
      <div
        className="
          relative
          max-h-[90vh]
          max-w-[90vw]
        "
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={image}
          alt={title}
          width={2500}
          height={2500}
          className="
            max-h-[90vh]
            w-auto
            rounded-2xl
            object-contain
          "
        />

        <button
          onClick={onClose}
          className="
            absolute
            right-2
            top-2
            rounded-full
            bg-black/50
            px-4
            py-2
            text-white
          "
        >
          ✕
        </button>
      </div>
    </div>
  );
}
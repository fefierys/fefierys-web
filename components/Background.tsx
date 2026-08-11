export default function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">

      {/* Imagen de fondo */}
      <div
        className="
          absolute
          inset-[-20px]
          bg-cover
          bg-center
          bg-no-repeat
          scale-105
        "
        style={{
          backgroundImage: "url('/images/background/fondo-card.png')",
          filter: "blur(16px)",
        }}
      />

      {/* Overlay degradado de colores */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              90deg,
              rgba(102,217,203,0.35) 0%,
              rgba(102,217,203,0.25) 35%,
              rgba(62,87,176,0.25) 65%,
              rgba(62,87,176,0.35) 100%
            )
          `,
        }}
      />

      {/* Oscurecimiento */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(6.7,6.7,51.8,0.35)",
        }}
      />

    </div>
  );
}
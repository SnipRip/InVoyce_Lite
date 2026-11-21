import Image from "next/image";

// Intrinsic size of public/images/invoyce-lite-logo.svg (viewBox 248 × 60).
const LOGO_WIDTH = 248;
const LOGO_HEIGHT = 60;

export function BrandLogo({ height, priority = false }: { height: number; priority?: boolean }) {
  return (
    <Image
      src="/images/invoyce-lite-logo.svg"
      alt="InVoyce Lite"
      width={Math.round((height * LOGO_WIDTH) / LOGO_HEIGHT)}
      height={height}
      priority={priority}
    />
  );
}

import Image from "next/image";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex h-dvh w-dvw items-center justify-center bg-background">
      <Image
        src="/assets/images/logo-square.png"
        alt="Alaiy OS"
        width={64}
        height={64}
        priority
        className="animate-pulse"
      />
    </div>
  );
}

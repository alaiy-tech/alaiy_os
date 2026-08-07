import type { ReactNode } from "react";

import { Command } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";
import Image from "next/image";

export default function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <div className="relative order-1 hidden h-full rounded-3xl bg-primary lg:flex">
          <div className="absolute top-10 space-y-1 px-10 text-primary-foreground">
            <Image
              src="/assets/images/logo-hor.png"
              alt="Alaiy OS"
              className="brightness-0 -ml-4 invert"
              width={175}
              height={35}
            />
            <p className="text-md font-medium">
              The operating system for modern commerce
            </p>
          </div>

          <div className="absolute bottom-10 flex w-full justify-between px-10">
            <div className="flex-1 space-y-1 text-primary-foreground">
              <p className="text-sm">
                Your commerce operating system - inventory, catalog, orders and
                fulfilment, all in one place.
              </p>
            </div>
          </div>
        </div>
        <div className="relative order-1 flex h-full">{children}</div>
      </div>
    </main>
  );
}

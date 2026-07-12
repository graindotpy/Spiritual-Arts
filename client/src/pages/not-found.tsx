import { Compass, Home } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main className="wuxia-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="wuxia-orb wuxia-orb-right" aria-hidden="true" />
      <section className="wuxia-paper relative z-10 mx-auto max-w-xl overflow-hidden rounded-[1.5rem] px-7 py-10 text-center sm:px-12 sm:py-12 dark:rounded-sm">
        <span
          className="pointer-events-none absolute -right-2 -top-7 font-display text-[7rem] leading-none text-[#9c8765]/10 dark:text-[#d0ad70]/[0.07]"
          aria-hidden="true"
        >
          404
        </span>
        <span className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#8ea293]/45 bg-[#dfe8de]/70 text-[#3b6758] dark:rounded-sm dark:border-[#9c7d4f]/55 dark:bg-[#59472f]/35 dark:text-[#d0ad70]">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="wuxia-kicker relative">Lost among the pages</p>
        <h1 className="font-display relative mt-2 text-3xl text-[#253b33] sm:text-4xl dark:text-[#f0e3ca]">
          This path leads nowhere
        </h1>
        <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-[#6a6b63] sm:text-base dark:text-[#b9aa8c]">
          The page you were looking for may have moved, or the address may be incomplete.
        </p>
        <Button
          type="button"
          onClick={() => setLocation("/")}
          className="wuxia-primary-action relative mt-7 h-11 px-5"
        >
          <Home className="mr-2 h-4 w-4" />
          Return to the main menu
        </Button>
      </section>
    </main>
  );
}

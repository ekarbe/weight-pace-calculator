import Link from 'next/link';
import { WeightScaleIcon } from '@/components/icons/weight-scale-icon';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 glassmorphism">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center space-x-2 text-foreground"
        >
          <WeightScaleIcon
            className="h-7 w-7 text-primary"
            aria-hidden="true"
          />
          <span className="font-bold sm:inline-block tracking-tight text-lg">
            Weight Pace Calculator
          </span>
        </Link>
        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

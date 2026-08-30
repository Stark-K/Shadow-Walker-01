'use client';

import Link from 'next/link';
import { CloudSun, Github } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SiteHeader({ active }: { active?: 'home' | 'dashboard' }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30 transition-transform group-hover:scale-105">
            <CloudSun className="h-5 w-5 text-primary" />
            <span className="absolute inset-0 rounded-lg bg-primary/10 blur-md" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-semibold tracking-tight">
              ShadowWalker
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Heat-Aware Routing
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-foreground',
              active === 'home' || !active
                ? 'text-foreground'
                : 'text-muted-foreground'
            )}
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-foreground',
              active === 'dashboard' ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            Dashboard
          </Link>
          <a
            href="https://docs-api.fortyguard.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <Github className="h-4 w-4" />
            API Docs
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Built with OpenStreetMap &amp; FortyGuard Temperature API.
          </p>
          <p className="text-sm text-muted-foreground">
            Navigation that keeps you in the shade.
          </p>
        </div>
      </div>
    </footer>
  );
}

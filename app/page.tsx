'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import {
  ArrowRight,
  CloudSun,
  Route,
  Thermometer,
  ShieldCheck,
  Zap,
  MapPin,
  TrendingDown,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: Route,
    title: 'Dual-Route Comparison',
    desc: 'See the fastest and coolest routes side-by-side, with distance, time, and heat exposure broken down clearly.',
  },
  {
    icon: Thermometer,
    title: 'FortyGuard Temperature Engine',
    desc: 'Hyper-local, street-level temperature intelligence powers every route segment, not coarse weather-station averages.',
  },
  {
    icon: ShieldCheck,
    title: 'Heat Risk Scoring',
    desc: 'Each route gets a heat score and risk level so you know exactly when the cool detour is worth it.',
  },
  {
    icon: Zap,
    title: 'AI Explanation Panel',
    desc: 'A plain-language summary tells you the trade-off: how many extra minutes buy you how much less heat.',
  },
];

const stats = [
  { value: '47%', label: 'Avg. heat exposure reduced' },
  { value: '2m', label: 'Street-level temperature precision' },
  { value: '115x', label: 'More accurate than weather models' },
  { value: '32B', label: 'Data points processed daily' },
];

const steps = [
  {
    icon: MapPin,
    title: 'Enter start & destination',
    desc: 'Type any two addresses. We geocode them instantly via OpenStreetMap.',
  },
  {
    icon: CloudSun,
    title: 'Analyze the heat',
    desc: 'FortyGuard samples temperatures along every candidate path at street level.',
  },
  {
    icon: TrendingDown,
    title: 'Get the coolest route',
    desc: 'We rank routes by a blend of heat score and travel time, then recommend the safest option.',
  },
];

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader active="home" />

      {/* Hero */}
      <section ref={heroRef} className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-40" />
        <div
          className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-primary/10 via-transparent to-transparent"
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        />
        <div className="absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary animate-fade-in-up">
              <Sparkles className="h-3.5 w-3.5" />
              Powered by FortyGuard Temperature API
            </div>
            <h1 className="animate-fade-in-up text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Navigation that keeps you
              <br />
              <span className="text-primary text-glow">in the shade</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl animate-fade-in-up text-lg text-muted-foreground sm:text-xl">
              ShadowWalker doesn&apos;t just find the shortest path. It compares
              the fastest route with the coolest one, so you arrive safer during
              heat waves.
            </p>
            <div className="mt-10 flex animate-fade-in-up flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="group glow-primary">
                <Link href="/dashboard">
                  Try the Dashboard
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a
                  href="https://docs-api.fortyguard.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How it works
                </a>
              </Button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mx-auto mt-20 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-card/80 px-6 py-8 text-center backdrop-blur transition-colors hover:bg-card"
              >
                <div className="text-3xl font-bold text-primary sm:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="relative border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider text-red-400/80">
                The Problem
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Every navigation app optimizes for speed.
                <br />
                None of them feel the heat.
              </h2>
              <p className="mt-5 text-lg text-muted-foreground">
                During a heat wave, the fastest route can be the most dangerous.
                Open asphalt, sun-baked sidewalks, and heat-island corridors
                push body temperature to unsafe levels — and there&apos;s no
                warning until it&apos;s too late.
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <Thermometer className="h-6 w-6 shrink-0 text-red-400" />
                <p className="text-sm text-muted-foreground">
                  Heat is the deadliest weather hazard, causing more deaths than
                  hurricanes, floods, and tornadoes combined.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl" />
              <Card className="relative border-primary/20 bg-card/60 backdrop-blur">
                <CardContent className="p-8">
                  <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                    The Solution
                  </span>
                  <h3 className="mt-3 text-2xl font-bold">Two routes. One choice.</h3>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                        <Zap className="h-5 w-5 text-red-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-red-400">Fastest Route</div>
                        <div className="text-sm text-muted-foreground">
                          Optimized purely for time — shown in red.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/10 p-4 glow-primary">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-primary">Coolest Route</div>
                        <div className="text-sm text-muted-foreground">
                          Optimized to minimize heat exposure — shown in green.
                        </div>
                      </div>
                    </div>
                    <p className="pt-2 text-sm text-muted-foreground">
                      We recommend the safest option based on current conditions,
                      and tell you exactly what the trade-off costs.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to walk cooler
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A complete heat-aware routing stack, from geocoding to
              temperature intelligence to a recommendation you can trust.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Card
                key={f.title}
                className="group relative border-border/60 bg-card/50 backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/20">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps to a cooler walk
            </h2>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                  <s.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">
                  Step {i + 1}
                </div>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                {i < steps.length - 1 && (
                  <div className="absolute top-8 left-[58%] hidden h-px w-[80%] bg-gradient-to-r from-primary/40 to-transparent md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-t border-border/40 py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-10 text-center sm:p-16">
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
            <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to walk the cool path?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Enter your start and destination and see the heat-aware
              recommendation in seconds.
            </p>
            <div className="relative mt-8">
              <Button asChild size="lg" className="group glow-primary">
                <Link href="/dashboard">
                  Open the Dashboard
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

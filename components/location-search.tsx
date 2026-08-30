'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { GeocodeResult } from '@/lib/types';

interface LocationSearchProps {
  placeholder: string;
  value: string;
  onSelect: (result: GeocodeResult) => void;
  onClear?: () => void;
  icon?: React.ReactNode;
}

export function LocationSearch({
  placeholder,
  value,
  onSelect,
  onClear,
  icon,
}: LocationSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function runSearch(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as { results: GeocodeResult[] };
          setResults(data.results ?? []);
          setOpen(true);
          setHighlight(0);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  function choose(r: GeocodeResult) {
    setQuery(r.display_name);
    setOpen(false);
    onSelect(r);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter' && results[highlight]) {
              e.preventDefault();
              choose(results[highlight]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className={cn(icon && 'pl-10', onClear && query && 'pr-9')}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {!loading && onClear && query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              onClear();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}-${i}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(r)}
              className={cn(
                'flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                i === highlight ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="line-clamp-2 text-popover-foreground">
                {r.display_name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

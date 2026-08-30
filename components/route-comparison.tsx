'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RouteResult } from '@/lib/types';
import {
  formatDistance,
  formatDuration,
  formatTemp,
  heatScoreToRisk,
} from '@/lib/route-utils';
import {
  Route as RouteIcon,
  Clock,
  Thermometer,
  Flame,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';

interface RouteComparisonProps {
  fastest: RouteResult;
  coolest: RouteResult;
  heatReduction: number;
}

function MetricRow({
  icon,
  label,
  fastestVal,
  coolestVal,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  fastestVal: string;
  coolestVal: string;
  highlight?: 'fastest' | 'coolest';
}) {
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 py-2.5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'text-right text-sm font-medium tabular-nums',
          highlight === 'fastest' ? 'text-red-400' : 'text-foreground'
        )}
      >
        {fastestVal}
      </div>
      <div
        className={cn(
          'text-right text-sm font-semibold tabular-nums',
          highlight === 'coolest' ? 'text-primary' : 'text-foreground'
        )}
      >
        {coolestVal}
      </div>
    </div>
  );
}

export function RouteComparison({
  fastest,
  coolest,
  heatReduction,
}: RouteComparisonProps) {
  const fastRisk = heatScoreToRisk(fastest.metrics.heat_score);
  const coolRisk = heatScoreToRisk(coolest.metrics.heat_score);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-border pb-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span>Metric</span>
        <span className="text-right text-red-400">Fastest</span>
        <span className="text-right text-primary">Coolest</span>
      </div>

      <MetricRow
        icon={<RouteIcon className="h-4 w-4" />}
        label="Distance"
        fastestVal={formatDistance(fastest.metrics.distance_km)}
        coolestVal={formatDistance(coolest.metrics.distance_km)}
        highlight={fastest.metrics.distance_km <= coolest.metrics.distance_km ? 'fastest' : 'coolest'}
      />
      <MetricRow
        icon={<Clock className="h-4 w-4" />}
        label="Travel time"
        fastestVal={formatDuration(fastest.metrics.duration_min)}
        coolestVal={formatDuration(coolest.metrics.duration_min)}
        highlight={fastest.metrics.duration_min <= coolest.metrics.duration_min ? 'fastest' : 'coolest'}
      />
      <MetricRow
        icon={<Thermometer className="h-4 w-4" />}
        label="Avg. temp"
        fastestVal={formatTemp(fastest.metrics.avg_temperature_c)}
        coolestVal={formatTemp(coolest.metrics.avg_temperature_c)}
        highlight="coolest"
      />
      <MetricRow
        icon={<Flame className="h-4 w-4" />}
        label="Heat score"
        fastestVal={`${fastest.metrics.heat_score}/100`}
        coolestVal={`${coolest.metrics.heat_score}/100`}
        highlight="coolest"
      />

      {/* Heat score bars */}
      <div className="space-y-2 pt-1">
        <ScoreBar label="Fastest" score={fastest.metrics.heat_score} color="bg-red-500" risk={fastRisk.label} />
        <ScoreBar label="Coolest" score={coolest.metrics.heat_score} color="bg-primary" risk={coolRisk.label} />
      </div>

      {/* Heat reduction banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <TrendingDown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary tabular-nums">
              {heatReduction}% heat reduction
            </div>
            <div className="text-sm text-muted-foreground">
              by choosing the coolest route
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation */}
      <Card
        className={cn(
          'border',
          heatReduction >= 20
            ? 'border-primary/40 bg-primary/5'
            : 'border-border bg-card'
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ArrowRight className="h-4 w-4 text-primary" />
            Recommendation
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {heatReduction >= 40
              ? 'Take the coolest route. The heat reduction is significant and worth the extra time during these conditions.'
              : heatReduction >= 20
                ? 'The coolest route is recommended — it meaningfully reduces heat exposure for a small time cost.'
                : 'The fastest route is fine today. Heat exposure is similar on both paths.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  color,
  risk,
}: {
  label: string;
  score: number;
  color: string;
  risk: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{risk}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

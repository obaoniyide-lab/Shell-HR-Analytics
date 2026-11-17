import { useEffect, useRef } from 'react';
import {
  Chart,
  registerables,
  type ChartConfiguration,
  type ChartType,
} from 'chart.js';

Chart.register(...registerables);

interface ChartCanvasProps<TType extends ChartType = ChartType> {
  config: ChartConfiguration<TType>;
  darkMode: boolean;
  heightClass?: string;
  ariaLabel: string;
}

export function getChartThemeTokens(darkMode: boolean) {
  return {
    textColor: darkMode ? '#D4D4D8' : '#3F3F46',
    mutedTextColor: darkMode ? '#A1A1AA' : '#71717A',
    gridColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.07)',
    tooltipBg: darkMode ? '#18181B' : '#09090B',
    tooltipBorder: darkMode ? '#3F3F46' : '#27272A',
    tooltipText: '#FAFAFA',
    surfaceBorder: darkMode ? '#18181B' : '#FFFFFF',
    // Shell Brand Palette
    shellYellow: '#FFC800',
    shellOrange: '#F58220',
    shellBlack: darkMode ? '#F4F4F5' : '#18181B',
    shellSlate: darkMode ? '#71717A' : '#A1A1AA',
    shellCrimson: '#DC2626',
    shellTeal: '#0D9488',
  };
}

export function ChartCanvas<TType extends ChartType = ChartType>({
  config,
  darkMode,
  heightClass = 'h-72',
  ariaLabel,
}: ChartCanvasProps<TType>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<TType> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tokens = getChartThemeTokens(darkMode);

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const customPlugins = (config.options?.plugins ?? {}) as {
      legend?: Record<string, unknown> & { labels?: Record<string, unknown> };
      tooltip?: Record<string, unknown>;
    };

    const mergedOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion ? false : { duration: 240 },
      ...config.options,
      plugins: {
        ...customPlugins,
        legend: {
          ...customPlugins.legend,
          labels: {
            color: tokens.textColor,
            font: {
              family: "'DM Sans', system-ui, sans-serif",
              size: 12,
              weight: 500,
            },
            boxWidth: 12,
            boxHeight: 12,
            padding: 14,
            ...customPlugins.legend?.labels,
          },
        },
        tooltip: {
          backgroundColor: tokens.tooltipBg,
          borderColor: tokens.tooltipBorder,
          borderWidth: 1,
          titleColor: tokens.tooltipText,
          bodyColor: tokens.tooltipText,
          padding: 10,
          cornerRadius: 6,
          titleFont: {
            family: "'Plus Jakarta Sans', system-ui, sans-serif",
            size: 12,
            weight: 600,
          },
          bodyFont: {
            family: "'IBM Plex Mono', monospace",
            size: 12,
          },
          ...customPlugins.tooltip,
        },
      },
    } as ChartConfiguration<TType>['options'];

    chartRef.current = new Chart(canvas, {
      ...config,
      options: mergedOptions,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config, darkMode]);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} aria-label={ariaLabel} role="img" />
    </div>
  );
}

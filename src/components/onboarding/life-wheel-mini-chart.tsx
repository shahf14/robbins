'use client';

import {useRef, useState, type MouseEvent, type TouchEvent, type WheelEvent} from 'react';
import type {LifeDomain} from '@/lib/life-coach/types';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';
import {getLifeWheelBandColor} from '@/lib/life-wheel';
import {DOMAIN_ICONS} from '@/lib/onboarding-domain-icons';

function domainFromAngle(mx: number, my: number, cx: number, cy: number): LifeDomain {
  const angle = Math.atan2(my - cy, mx - cx);
  const total = LIFE_DOMAINS.length;
  const domainAngles = LIFE_DOMAINS.map((_, i) => -Math.PI / 2 + (i / total) * Math.PI * 2);
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < total; i++) {
    let diff = Math.abs(angle - domainAngles[i]);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return LIFE_DOMAINS[best];
}

export function LifeWheelMiniChart({
  scores,
  onScoreChange,
  focusDomain,
  selectedDomain,
  domainLabels,
}: {
  scores: Record<LifeDomain, number>;
  onScoreChange?: (domain: LifeDomain, score: number) => void;
  focusDomain?: LifeDomain | null;
  selectedDomain?: LifeDomain | null;
  domainLabels?: Record<LifeDomain, string>;
}) {
  const size = 264;
  const center = size / 2;
  const maxRadius = 96;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredDomain, setHoveredDomain] = useState<LifeDomain | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDomain = useRef<LifeDomain | null>(null);

  const points = LIFE_DOMAINS.map((domain, index) => {
    const angle = -Math.PI / 2 + (index / LIFE_DOMAINS.length) * Math.PI * 2;
    const radius = (scores[domain] / 10) * maxRadius;
    return {
      domain,
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      axisX: center + Math.cos(angle) * maxRadius,
      axisY: center + Math.sin(angle) * maxRadius,
      iconX: center + Math.cos(angle) * (maxRadius + 25),
      iconY: center + Math.sin(angle) * (maxRadius + 25),
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');
  const ringLabels = [
    {value: 2, r: (2 / 10) * maxRadius},
    {value: 5, r: (5 / 10) * maxRadius},
    {value: 8, r: (8 / 10) * maxRadius},
    {value: 10, r: maxRadius},
  ];

  function svgCoords(clientX: number, clientY: number): {x: number; y: number} | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    return {x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY};
  }

  function handleWheel(e: WheelEvent<SVGSVGElement>) {
    if (!onScoreChange) return;
    e.preventDefault();
    const coords = svgCoords(e.clientX, e.clientY);
    if (!coords) return;
    const domain = domainFromAngle(coords.x, coords.y, center, center);
    const delta = e.deltaY < 0 ? 1 : -1;
    const next = Math.min(10, Math.max(1, scores[domain] + delta));
    if (next !== scores[domain]) onScoreChange(domain, next);
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (!onScoreChange) return;
    const coords = svgCoords(e.clientX, e.clientY);
    if (!coords) return;
    setHoveredDomain(domainFromAngle(coords.x, coords.y, center, center));
  }

  function handleTouchStart(e: TouchEvent<SVGSVGElement>) {
    if (!onScoreChange) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY.current = touch.clientY;
    const coords = svgCoords(touch.clientX, touch.clientY);
    if (coords) touchDomain.current = domainFromAngle(coords.x, coords.y, center, center);
  }

  function handleTouchMove(e: TouchEvent<SVGSVGElement>) {
    if (!onScoreChange || touchStartY.current === null || !touchDomain.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const diff = touchStartY.current - touch.clientY;
    if (Math.abs(diff) < 12) return;
    const delta = diff > 0 ? 1 : -1;
    const domain = touchDomain.current;
    const next = Math.min(10, Math.max(1, scores[domain] + delta));
    if (next !== scores[domain]) onScoreChange(domain, next);
    touchStartY.current = touch.clientY;
  }

  function handleTouchEnd() {
    touchStartY.current = null;
    touchDomain.current = null;
  }

  const interactive = !!onScoreChange;

  return (
    <div className="mx-auto flex w-full justify-center">
      <svg
        ref={svgRef}
        className={`h-[220px] w-[220px] sm:h-[264px] sm:w-[264px] ${interactive ? 'touch-none' : ''}`}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        style={interactive ? {cursor: 'ns-resize'} : undefined}
        onWheel={interactive ? handleWheel : undefined}
        onMouseMove={interactive ? handleMouseMove : undefined}
        onMouseLeave={interactive ? () => setHoveredDomain(null) : undefined}
        onTouchStart={interactive ? handleTouchStart : undefined}
        onTouchMove={interactive ? handleTouchMove : undefined}
        onTouchEnd={interactive ? handleTouchEnd : undefined}
      >
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle
            key={scale}
            cx={center}
            cy={center}
            r={maxRadius * scale}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        {ringLabels.map((ring) => (
          <text
            key={ring.value}
            x={center + 5}
            y={center - ring.r + 10}
            fill="rgba(255,255,255,0.42)"
            fontSize="9"
            textAnchor="start"
          >
            {ring.value}
          </text>
        ))}
        {points.map((point) => (
          <line
            key={point.domain}
            x1={center}
            y1={center}
            x2={point.axisX}
            y2={point.axisY}
            stroke={hoveredDomain === point.domain ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.09)'}
            strokeWidth={hoveredDomain === point.domain ? 2 : 1}
          />
        ))}
        <polygon
          points={polygon}
          fill="rgba(26,109,255,0.18)"
          stroke="rgba(26,109,255,0.78)"
          strokeWidth="3"
        />
        {points.map((point) => {
          const isHovered = hoveredDomain === point.domain;
          const isFocus = point.domain === focusDomain;
          const isSelected = point.domain === selectedDomain;
          return (
            <g key={point.domain}>
              {(isHovered || isFocus || isSelected) && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? '14' : isFocus ? '13' : '12'}
                  fill={isSelected ? 'rgba(16,185,129,0.18)' : isFocus ? 'rgba(245,158,11,0.18)' : getLifeWheelBandColor(scores[point.domain])}
                  stroke={isSelected ? 'rgba(16,185,129,0.85)' : isFocus ? 'rgba(245,158,11,0.85)' : 'transparent'}
                  strokeWidth={isSelected || isFocus ? '2' : '0'}
                  opacity={isHovered ? '0.35' : '1'}
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered || isFocus || isSelected ? 7 : 5}
                fill={getLifeWheelBandColor(scores[point.domain])}
                style={{transition: 'r 0.12s'}}
              />
              <text
                x={point.iconX}
                y={point.iconY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isHovered ? '24' : '21'}
                style={{transition: 'font-size 0.12s'}}
              >
                {DOMAIN_ICONS[point.domain]}
              </text>
              {isHovered && interactive && (
                <text
                  x={point.iconX}
                  y={point.iconY - 18}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill={getLifeWheelBandColor(scores[point.domain])}
                >
                  {scores[point.domain]}/10
                </text>
              )}
            </g>
          );
        })}
        {hoveredDomain && interactive && (
          <g>
            <rect
              x={center - 58}
              y={center - 20}
              width="116"
              height="40"
              rx="14"
              fill="rgba(8,10,14,0.88)"
              stroke="rgba(255,255,255,0.12)"
            />
            <text
              x={center}
              y={center - 5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="800"
              fill="rgba(255,255,255,0.9)"
            >
              {domainLabels?.[hoveredDomain] ?? hoveredDomain}
            </text>
            <text
              x={center}
              y={center + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fontWeight="800"
              fill={getLifeWheelBandColor(scores[hoveredDomain])}
            >
              {scores[hoveredDomain]}/10
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

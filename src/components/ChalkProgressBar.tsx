/**
 * ChalkProgressBar Component
 *
 * A hand-drawn chalk-style loading bar with:
 * - 8 blocks that animate sequentially
 * - Imperfect rectangle outlines (corner jitter)
 * - Diagonal scribble fill pattern (randomized)
 *
 * Uses the SVG chalk filter defined in layout.tsx for rough edges.
 *
 * @module components/ChalkProgressBar
 */

'use client'

import { useMemo } from 'react'

interface ChalkProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number
  /** Width of the bar in pixels */
  width?: number
  /** Height of the bar in pixels */
  height?: number
}

// Configuration
const CONFIG = {
  blockCount: 8,
  blockGap: 6,
  blockPadding: 4,
  strokeColor: '#91AAF2', // periwinkle accent
  strokeWidth: 2.5,
  cornerJitter: 2,
  scribbleAngleRange: 20,
  scribbleSpacingMin: 4,
  scribbleSpacingMax: 6,
  scribbleWobbleMax: 2,
}

// Random helper that stays consistent during animation
const randomBetween = (min: number, max: number, seed: number) => {
  // Simple seeded random
  const x = Math.sin(seed * 9999) * 10000
  return min + (x - Math.floor(x)) * (max - min)
}

/**
 * Generates an imperfect rectangle path with jittered corners
 */
function generateBlockOutline(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
): string {
  const j = CONFIG.cornerJitter
  const tl = { x: x + randomBetween(-j, j, seed), y: y + randomBetween(-j, j, seed + 1) }
  const tr = { x: x + width + randomBetween(-j, j, seed + 2), y: y + randomBetween(-j, j, seed + 3) }
  const br = { x: x + width + randomBetween(-j, j, seed + 4), y: y + height + randomBetween(-j, j, seed + 5) }
  const bl = { x: x + randomBetween(-j, j, seed + 6), y: y + height + randomBetween(-j, j, seed + 7) }

  return `M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`
}

/**
 * Generates diagonal scribble lines for fill effect
 */
function generateScribbleLines(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
): string[] {
  const angle = 45 + randomBetween(-CONFIG.scribbleAngleRange, CONFIG.scribbleAngleRange, seed)
  const spacing = randomBetween(CONFIG.scribbleSpacingMin, CONFIG.scribbleSpacingMax, seed + 10)
  const wobble = CONFIG.scribbleWobbleMax

  const lines: string[] = []
  const radians = (angle * Math.PI) / 180

  // Generate diagonal lines across the block
  const diagonal = Math.sqrt(width * width + height * height)
  const numLines = Math.ceil(diagonal / spacing)

  for (let i = 0; i < numLines; i++) {
    const offset = i * spacing - diagonal / 2
    const lineSeed = seed + i * 100

    // Calculate line endpoints (simplified diagonal fill)
    const startWobble = randomBetween(-wobble, wobble, lineSeed)
    const endWobble = randomBetween(-wobble, wobble, lineSeed + 1)

    // Start and end points along the diagonal
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const centerX = x + width / 2
    const centerY = y + height / 2

    // Line perpendicular to angle, offset by spacing
    const perpCos = Math.cos(radians + Math.PI / 2)
    const perpSin = Math.sin(radians + Math.PI / 2)

    const px = centerX + perpCos * offset
    const py = centerY + perpSin * offset

    // Line along the angle
    const halfLen = diagonal / 2
    const x1 = px - cos * halfLen + startWobble
    const y1 = py - sin * halfLen + startWobble
    const x2 = px + cos * halfLen + endWobble
    const y2 = py + sin * halfLen + endWobble

    lines.push(`M ${x1} ${y1} L ${x2} ${y2}`)
  }

  return lines
}

/**
 * Chalk-style animated progress bar
 */
export function ChalkProgressBar({
  progress,
  width = 460,
  height = 30,
}: ChalkProgressBarProps) {
  // Generate block data once (with random imperfections)
  const blocks = useMemo(() => {
    const totalGaps = (CONFIG.blockCount - 1) * CONFIG.blockGap
    const totalPadding = CONFIG.blockPadding * 2
    const availableWidth = width - totalPadding - totalGaps
    const blockWidth = availableWidth / CONFIG.blockCount
    const blockHeight = height - totalPadding

    return Array.from({ length: CONFIG.blockCount }, (_, i) => {
      const blockX = CONFIG.blockPadding + i * (blockWidth + CONFIG.blockGap)
      const blockY = CONFIG.blockPadding
      const seed = i * 1000 // Unique seed per block

      return {
        x: blockX,
        y: blockY,
        width: blockWidth,
        height: blockHeight,
        outline: generateBlockOutline(blockX, blockY, blockWidth, blockHeight, seed),
        scribbles: generateScribbleLines(blockX, blockY, blockWidth, blockHeight, seed + 500),
        seed,
      }
    })
  }, [width, height])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      style={{ filter: 'url(#chalk)' }}
    >
      {/* Outer frame */}
      <rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        fill="none"
        stroke={CONFIG.strokeColor}
        strokeWidth={CONFIG.strokeWidth}
        strokeOpacity={0.3}
        rx={4}
      />

      {/* Blocks */}
      {blocks.map((block, i) => {
        // Each block fills at its threshold (e.g., block 0 at 0-12.5%, block 1 at 12.5-25%, etc.)
        const blockProgress = progress - (i / CONFIG.blockCount) * 100
        const normalizedProgress = Math.max(0, Math.min(1, blockProgress / (100 / CONFIG.blockCount)))

        // Block has two phases: outline (0-50%) then fill (50-100%)
        const outlineProgress = Math.min(1, normalizedProgress * 2)
        const fillProgress = Math.max(0, (normalizedProgress - 0.5) * 2)

        // Only render if block should be visible
        if (normalizedProgress <= 0) return null

        return (
          <g key={i}>
            {/* Block outline - animate stroke-dasharray */}
            <path
              d={block.outline}
              fill="none"
              stroke={CONFIG.strokeColor}
              strokeWidth={CONFIG.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 200,
                strokeDashoffset: 200 * (1 - outlineProgress),
                transition: 'stroke-dashoffset 0.3s ease-out',
              }}
            />

            {/* Scribble fill - clip to block bounds */}
            {fillProgress > 0 && (
              <g
                style={{
                  opacity: fillProgress,
                  transition: 'opacity 0.3s ease-out',
                }}
              >
                <clipPath id={`block-clip-${i}`}>
                  <rect
                    x={block.x}
                    y={block.y}
                    width={block.width}
                    height={block.height}
                  />
                </clipPath>
                <g clipPath={`url(#block-clip-${i})`}>
                  {block.scribbles.slice(0, Math.ceil(block.scribbles.length * fillProgress)).map((line, j) => (
                    <path
                      key={j}
                      d={line}
                      fill="none"
                      stroke={CONFIG.strokeColor}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeOpacity={0.7}
                    />
                  ))}
                </g>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

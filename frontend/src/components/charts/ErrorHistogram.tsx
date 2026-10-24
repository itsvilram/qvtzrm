import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import type { AccuracySummary, HistogramBin } from '../../api/types.ts'
import { axisLine, axisTick, barCursor, gigawattTick } from '../../lib/chartStyle.ts'
import { chartColors } from '../../lib/colors.ts'
import { formatPowerRange, formatSigned } from '../../lib/format.ts'
import {
  AreaKey,
  ChartCard,
  ChartLegend,
  LegendItem,
  TableView,
  TooltipBox,
  TooltipRow,
} from './ChartParts.tsx'
import styles from './charts.module.css'

interface Row {
  mid: number
  count: number
  bin: HistogramBin
  tooHigh: boolean
}

/** How often the forecast missed by how much, split by direction. */
export function ErrorHistogram({
  histogram,
  summary,
}: {
  histogram: HistogramBin[]
  summary: AccuracySummary
}) {
  const data: Row[] = histogram.map((bin) => ({
    mid: (bin.bin_start_mw + bin.bin_end_mw) / 2,
    count: bin.count,
    bin,
    tooHigh: bin.bin_start_mw >= 0,
  }))
  const first = histogram[0]?.bin_start_mw ?? 0
  const last = histogram.at(-1)?.bin_end_mw ?? 0
  const ticks = evenTicks(first, last, 2000)

  return (
    <ChartCard
      id="error-histogram"
      title="How big were the misses?"
      hint="Hours by forecast error (forecast − actual), in 500 MW steps. Dashed lines: 80% of hours fall between P10 and P90."
      legend={
        <ChartLegend>
          <LegendItem marker={<AreaKey color={chartColors.underForecast} opacity={1} />}>
            Forecast too low
          </LegendItem>
          <LegendItem marker={<AreaKey color={chartColors.overForecast} opacity={1} />}>
            Forecast too high
          </LegendItem>
        </ChartLegend>
      }
    >
      <BarChart
        className={styles.chart}
        responsive
        style={{ width: '100%', height: 280 }}
        data={data}
        barCategoryGap={2}
        margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
        role="img"
        aria-label={`Histogram of forecast errors over ${summary.n_hours} hours. 80% of errors were between ${formatSigned(summary.p10_mw)} and ${formatSigned(summary.p90_mw)}. Full values in the table below.`}
      >
        <CartesianGrid vertical={false} stroke={chartColors.grid} />
        <XAxis
          dataKey="mid"
          type="number"
          domain={[first, last]}
          ticks={ticks}
          tickFormatter={gigawattTick}
          tick={axisTick}
          tickLine={false}
          axisLine={axisLine}
        />
        <YAxis width={40} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={barCursor}
          content={({ active, payload }) => <BinTooltip active={active} payload={payload} />}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((row) => (
            <Cell
              key={row.mid}
              fill={row.tooHigh ? chartColors.overForecast : chartColors.underForecast}
            />
          ))}
        </Bar>
        <ReferenceLine x={0} stroke={chartColors.axis} />
        {summary.p10_mw !== null && (
          <ReferenceLine
            x={summary.p10_mw}
            stroke={chartColors.label}
            strokeDasharray="4 3"
            label={{ value: 'P10', position: 'top', fill: chartColors.label, fontSize: 12 }}
          />
        )}
        {summary.p90_mw !== null && (
          <ReferenceLine
            x={summary.p90_mw}
            stroke={chartColors.label}
            strokeDasharray="4 3"
            label={{ value: 'P90', position: 'top', fill: chartColors.label, fontSize: 12 }}
          />
        )}
      </BarChart>

      <TableView summary="Show table">
        <thead>
          <tr>
            <th scope="col">Forecast − actual</th>
            <th scope="col">Hours</th>
          </tr>
        </thead>
        <tbody>
          {histogram.map((bin) => (
            <tr key={bin.bin_start_mw}>
              <th scope="row">{formatPowerRange(bin.bin_start_mw, bin.bin_end_mw)}</th>
              <td>{bin.count}</td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </ChartCard>
  )
}

function BinTooltip({
  active,
  payload,
}: Pick<TooltipContentProps<number, string>, 'active' | 'payload'>) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  const { bin_start_mw: start, bin_end_mw: end } = row.bin
  // A bin of −1,000 to −500 MW means "too low by 500–1,000 MW".
  const size = row.tooHigh ? formatPowerRange(start, end) : formatPowerRange(-end, -start)
  return (
    <TooltipBox title={row.tooHigh ? 'Forecast too high' : 'Forecast too low'}>
      <TooltipRow
        marker={
          <AreaKey
            color={row.tooHigh ? chartColors.overForecast : chartColors.underForecast}
            opacity={1}
          />
        }
        value={`${row.count} hours`}
        label={`by ${size}`}
      />
    </TooltipBox>
  )
}

/** Multiples of `step` inside [from, to], always including 0 when it is in range. */
function evenTicks(from: number, to: number, step: number): number[] {
  const ticks: number[] = []
  for (let tick = Math.ceil(from / step) * step; tick <= to; tick += step) ticks.push(tick)
  return ticks
}

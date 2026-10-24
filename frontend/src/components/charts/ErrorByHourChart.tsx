import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import type { HourStats } from '../../api/types.ts'
import { axisLine, axisTick, barCursor, gigawattTick, MAX_BAR_PX } from '../../lib/chartStyle.ts'
import { chartColors } from '../../lib/colors.ts'
import { formatPower, formatPowerRange, formatSigned } from '../../lib/format.ts'
import {
  AreaKey,
  ChartCard,
  ChartLegend,
  DotKey,
  LegendItem,
  TableView,
  TooltipBox,
  TooltipRow,
} from './ChartParts.tsx'
import styles from './charts.module.css'

interface Row {
  hour: string
  /** [P10, P90]: Recharts draws a two-value Bar as a floating range. */
  range: [number, number]
  bias: number
  stats: HourStats
}

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

// The ranges are lighter than solid bars so the average-error dots stand out on top of them.
const RANGE_OPACITY = 0.35

/** For each hour of the day: where most errors fell, and the average error. */
export function ErrorByHourChart({ byHour }: { byHour: HourStats[] }) {
  const data: Row[] = byHour.map((stats) => ({
    hour: hourLabel(stats.hour),
    range: [stats.p10_mw, stats.p90_mw],
    bias: stats.bias_mw,
    stats,
  }))

  return (
    <ChartCard
      id="error-by-hour"
      title="Error by hour of day"
      hint="Forecast − actual, UK time. Above zero = forecast too high. Bars show the middle 80% of errors."
      legend={
        <ChartLegend>
          <LegendItem marker={<AreaKey color={chartColors.forecast} opacity={RANGE_OPACITY} />}>
            Middle 80% of errors (P10–P90)
          </LegendItem>
          <LegendItem marker={<DotKey color={chartColors.actual} />}>
            Average error (bias)
          </LegendItem>
        </ChartLegend>
      }
    >
      <ComposedChart
        className={styles.chart}
        responsive
        style={{ width: '100%', height: 280 }}
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        role="img"
        aria-label={`Forecast error by hour of day. ${summarise(byHour)} Full values in the table below.`}
      >
        <CartesianGrid vertical={false} stroke={chartColors.grid} />
        <XAxis dataKey="hour" interval={2} tick={axisTick} tickLine={false} axisLine={axisLine} />
        <YAxis
          width={56}
          tickFormatter={gigawattTick}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={0} stroke={chartColors.axis} />
        <Tooltip
          cursor={barCursor}
          content={({ active, payload }) => <HourTooltip active={active} payload={payload} />}
        />
        <Bar
          dataKey="range"
          fill={chartColors.forecast}
          fillOpacity={RANGE_OPACITY}
          maxBarSize={MAX_BAR_PX}
          radius={2}
          isAnimationActive={false}
        />
        <Line
          dataKey="bias"
          stroke="none"
          dot={{ r: 4, fill: chartColors.actual, stroke: 'var(--surface)', strokeWidth: 2 }}
          activeDot={false}
          isAnimationActive={false}
        />
      </ComposedChart>

      <TableView summary="Show table">
        <thead>
          <tr>
            <th scope="col">Hour (UK)</th>
            <th scope="col">P10</th>
            <th scope="col">Average error</th>
            <th scope="col">P90</th>
            <th scope="col">Average miss</th>
            <th scope="col">Hours</th>
          </tr>
        </thead>
        <tbody>
          {byHour.map((stats) => (
            <tr key={stats.hour}>
              <th scope="row">{hourLabel(stats.hour)}</th>
              <td>{formatSigned(stats.p10_mw, 'MW')}</td>
              <td>{formatSigned(stats.bias_mw, 'MW')}</td>
              <td>{formatSigned(stats.p90_mw, 'MW')}</td>
              <td>{formatPower(stats.mae_mw, 'MW')}</td>
              <td>{stats.n}</td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </ChartCard>
  )
}

function HourTooltip({
  active,
  payload,
}: Pick<TooltipContentProps<number, string>, 'active' | 'payload'>) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  const { stats } = row
  return (
    <TooltipBox title={`${row.hour} (UK time)`}>
      <TooltipRow
        marker={<AreaKey color={chartColors.forecast} opacity={RANGE_OPACITY} />}
        value={formatPowerRange(stats.p10_mw, stats.p90_mw)}
        label="Middle 80% of errors"
      />
      <TooltipRow
        marker={<DotKey color={chartColors.actual} />}
        value={formatSigned(stats.bias_mw)}
        label="Average error"
      />
      <TooltipRow value={formatPower(stats.mae_mw)} label="Average miss (MAE)" />
      <p className={styles.tooltipNote}>{stats.n} hours</p>
    </TooltipBox>
  )
}

function summarise(byHour: HourStats[]): string {
  if (byHour.length === 0) return 'No data.'
  const worst = byHour.reduce((a, b) => (b.mae_mw > a.mae_mw ? b : a))
  const best = byHour.reduce((a, b) => (b.mae_mw < a.mae_mw ? b : a))
  return `Largest average miss at ${hourLabel(worst.hour)} (${formatPower(worst.mae_mw)}), smallest at ${hourLabel(best.hour)} (${formatPower(best.mae_mw)}).`
}

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import type { DayAheadPoint } from '../../api/types.ts'
import { axisLine, axisTick, gigawattTick } from '../../lib/chartStyle.ts'
import { AREA_OPACITY, chartColors } from '../../lib/colors.ts'
import {
  formatHoursAhead,
  formatPower,
  formatPowerRange,
  formatSigned,
  formatUkDate,
  formatUkDateTime,
  formatUkTime,
} from '../../lib/format.ts'
import {
  AreaKey,
  ChartLegend,
  LegendItem,
  LineKey,
  TableView,
  TooltipBox,
  TooltipRow,
} from './ChartParts.tsx'
import styles from './charts.module.css'

interface ChartPoint {
  hour: string
  point: DayAheadPoint
  forecast: number
  actual: number | null
  /** [P10-based low, P90-based high]; Recharts draws a two-value Area as a range. */
  band: [number, number] | null
}

function toChartPoint(point: DayAheadPoint): ChartPoint {
  const { band_low_mw: low, band_high_mw: high } = point
  return {
    hour: formatUkTime(point.start_time),
    point,
    forecast: point.forecast_mw,
    actual: point.actual_mw,
    band: low !== null && high !== null ? [low, high] : null,
  }
}

interface Props {
  points: DayAheadPoint[]
  showActuals: boolean
  /** One-sentence description of the chart for screen readers. */
  summary: string
}

export function ForecastChart({ points, showActuals, summary }: Props) {
  const data = points.map(toChartPoint)

  return (
    <figure className={styles.figure}>
      <ChartLegend>
        <LegendItem marker={<LineKey color={chartColors.forecast} />}>Forecast</LegendItem>
        <LegendItem marker={<AreaKey color={chartColors.forecast} />}>
          Typical range (P10–P90 of past errors)
        </LegendItem>
        {showActuals && (
          <LegendItem marker={<LineKey color={chartColors.actual} dashed />}>Actual</LegendItem>
        )}
      </ChartLegend>

      <ComposedChart
        className={styles.chart}
        responsive
        style={{ width: '100%', height: 340 }}
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        role="img"
        aria-label={summary}
      >
        <CartesianGrid vertical={false} stroke={chartColors.grid} />
        <XAxis dataKey="hour" interval={2} tick={axisTick} tickLine={false} axisLine={axisLine} />
        <YAxis
          width={52}
          domain={[0, 'auto']}
          tickFormatter={gigawattTick}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: chartColors.axis, strokeWidth: 1 }}
          content={({ active, payload }) => (
            <ForecastTooltip active={active} payload={payload} showActuals={showActuals} />
          )}
        />
        <Area
          dataKey="band"
          stroke="none"
          fill={chartColors.forecast}
          fillOpacity={AREA_OPACITY}
          activeDot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="forecast"
          stroke={chartColors.forecast}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          isAnimationActive={false}
        />
        {showActuals && (
          <Line
            dataKey="actual"
            stroke={chartColors.actual}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>

      <HourlyTable points={points} showActuals={showActuals} />
    </figure>
  )
}

type TooltipProps = Pick<TooltipContentProps<number, string>, 'active' | 'payload'> & {
  showActuals: boolean
}

function ForecastTooltip({ active, payload, showActuals }: TooltipProps) {
  const chartPoint = payload?.[0]?.payload as ChartPoint | undefined
  if (!active || !chartPoint) return null
  const { point, band } = chartPoint

  return (
    <TooltipBox title={`${formatUkDate(point.start_time)} ${chartPoint.hour}`}>
      <TooltipRow
        marker={<LineKey color={chartColors.forecast} />}
        value={formatPower(point.forecast_mw)}
        label="Forecast"
      />
      {showActuals && (
        <>
          <TooltipRow
            marker={<LineKey color={chartColors.actual} dashed />}
            value={formatPower(point.actual_mw)}
            label="Actual"
          />
          <TooltipRow value={formatSigned(point.error_mw)} label="Error (forecast − actual)" />
        </>
      )}
      {band && (
        <TooltipRow
          marker={<AreaKey color={chartColors.forecast} />}
          value={formatPowerRange(band[0], band[1])}
          label="Typical range"
        />
      )}
      <p className={styles.tooltipNote}>
        Published {formatUkDateTime(point.publish_time)} · {formatHoursAhead(point.horizon_h)} ahead
      </p>
    </TooltipBox>
  )
}

function HourlyTable({ points, showActuals }: { points: DayAheadPoint[]; showActuals: boolean }) {
  return (
    <TableView summary="Show hourly table">
      <thead>
        <tr>
          <th scope="col">Hour (UK)</th>
          <th scope="col">Forecast</th>
          {showActuals && <th scope="col">Actual</th>}
          {showActuals && <th scope="col">Error</th>}
          <th scope="col">Typical range</th>
          <th scope="col">Hours ahead</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.start_time}>
            <th scope="row">{formatUkTime(point.start_time)}</th>
            <td>{formatPower(point.forecast_mw, 'MW')}</td>
            {showActuals && <td>{formatPower(point.actual_mw, 'MW')}</td>}
            {showActuals && <td>{formatSigned(point.error_mw, 'MW')}</td>}
            <td>
              {point.band_low_mw === null || point.band_high_mw === null
                ? '—'
                : `${formatPower(point.band_low_mw, 'MW')} – ${formatPower(point.band_high_mw, 'MW')}`}
            </td>
            <td>{formatHoursAhead(point.horizon_h)}</td>
          </tr>
        ))}
      </tbody>
    </TableView>
  )
}

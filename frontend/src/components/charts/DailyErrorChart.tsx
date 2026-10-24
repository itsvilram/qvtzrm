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
import type { DailyStats } from '../../api/types.ts'
import { axisLine, axisTick, barCursor, gigawattTick, MAX_BAR_PX } from '../../lib/chartStyle.ts'
import { chartColors } from '../../lib/colors.ts'
import {
  formatDayMonth,
  formatEnergy,
  formatPower,
  formatSigned,
  formatUkDate,
} from '../../lib/format.ts'
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
  day: string
  bias: number
  stats: DailyStats
}

interface Props {
  daily: DailyStats[]
  /** Called with the delivery date when a day is chosen (bar click or table button). */
  onSelectDay: (deliveryDate: string) => void
}

/** Average error for each delivery day; choosing a day opens it in the day-ahead view. */
export function DailyErrorChart({ daily, onSelectDay }: Props) {
  const data: Row[] = daily.map((stats) => ({
    day: formatDayMonth(stats.delivery_date),
    bias: stats.bias_mw,
    stats,
  }))
  const worst = daily.reduce<DailyStats | null>(
    (a, b) => (a === null || Math.abs(b.bias_mw) > Math.abs(a.bias_mw) ? b : a),
    null,
  )

  return (
    <ChartCard
      id="daily-error"
      title="Average error per delivery day"
      hint="Forecast − actual, averaged over each day. Click a day to open it in the day-ahead view."
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
        className={`${styles.chart} ${styles.clickable}`}
        responsive
        style={{ width: '100%', height: 280 }}
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        role="img"
        aria-label={`Average forecast error for each of ${daily.length} delivery days.${worst ? ` Largest on ${formatUkDate(worst.delivery_date)}: ${formatSigned(worst.bias_mw)}.` : ''} Full values, with buttons to open each day, in the table below.`}
      >
        <CartesianGrid vertical={false} stroke={chartColors.grid} />
        <XAxis
          dataKey="day"
          interval="preserveStartEnd"
          minTickGap={16}
          tick={axisTick}
          tickLine={false}
          axisLine={axisLine}
        />
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
          content={({ active, payload }) => <DayTooltip active={active} payload={payload} />}
        />
        <Bar
          dataKey="bias"
          maxBarSize={MAX_BAR_PX}
          radius={2}
          isAnimationActive={false}
          onClick={(entry) => onSelectDay((entry.payload as Row).stats.delivery_date)}
        >
          {data.map((row) => (
            <Cell
              key={row.stats.delivery_date}
              fill={row.bias >= 0 ? chartColors.overForecast : chartColors.underForecast}
            />
          ))}
        </Bar>
      </BarChart>

      <TableView summary="Show table">
        <thead>
          <tr>
            <th scope="col">Delivery day</th>
            <th scope="col">Average error</th>
            <th scope="col">Average miss</th>
            <th scope="col">Forecast</th>
            <th scope="col">Actual</th>
            <th scope="col">
              <span className="visually-hidden">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {daily.map((stats) => (
            <tr key={stats.delivery_date}>
              <th scope="row">{formatUkDate(stats.delivery_date)}</th>
              <td>{formatSigned(stats.bias_mw, 'MW')}</td>
              <td>{formatPower(stats.mae_mw, 'MW')}</td>
              <td>{formatEnergy(stats.forecast_energy_mwh)}</td>
              <td>{formatEnergy(stats.actual_energy_mwh)}</td>
              <td>
                <button
                  type="button"
                  className={styles.openButton}
                  aria-label={`Open ${formatUkDate(stats.delivery_date)} in the day-ahead view`}
                  onClick={() => onSelectDay(stats.delivery_date)}
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </ChartCard>
  )
}

function DayTooltip({
  active,
  payload,
}: Pick<TooltipContentProps<number, string>, 'active' | 'payload'>) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  const { stats } = row
  return (
    <TooltipBox title={formatUkDate(stats.delivery_date)}>
      <TooltipRow
        marker={
          <AreaKey
            color={stats.bias_mw >= 0 ? chartColors.overForecast : chartColors.underForecast}
            opacity={1}
          />
        }
        value={formatSigned(stats.bias_mw)}
        label="Average error"
      />
      <TooltipRow value={formatPower(stats.mae_mw)} label="Average miss (MAE)" />
      <TooltipRow value={formatEnergy(stats.forecast_energy_mwh)} label="Forecast energy" />
      <TooltipRow value={formatEnergy(stats.actual_energy_mwh)} label="Actual energy" />
      <p className={styles.tooltipNote}>Click to open this day</p>
    </TooltipBox>
  )
}

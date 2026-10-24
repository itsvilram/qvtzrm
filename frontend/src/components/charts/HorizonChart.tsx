import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import type { HorizonStats } from '../../api/types.ts'
import {
  axisLine,
  axisTick,
  barCursor,
  gigawattTick,
  MAX_BAR_PX,
  MIN_RELIABLE_HOURS,
} from '../../lib/chartStyle.ts'
import { chartColors } from '../../lib/colors.ts'
import { formatPower, formatSigned } from '../../lib/format.ts'
import { ChartCard, TableView, TooltipBox, TooltipRow } from './ChartParts.tsx'
import styles from './charts.module.css'

interface Row {
  bucket: string
  mae: number
  stats: HorizonStats
}

const bucketLabel = (bucket: string) => bucket.replace('-', '–').replace('h', ' h')

/** Average miss by lead time, over every forecast: does waiting for a later forecast help? */
export function HorizonChart({ byHorizon }: { byHorizon: HorizonStats[] }) {
  const data: Row[] = byHorizon.map((stats) => ({
    bucket: bucketLabel(stats.bucket),
    mae: stats.mae_mw,
    stats,
  }))
  const reliable = byHorizon.filter((stats) => stats.n >= MIN_RELIABLE_HOURS)
  const nearest = reliable[0]
  const furthest = reliable.at(-1)

  return (
    <ChartCard
      id="horizon"
      title="Does the forecast improve closer to delivery?"
      hint={`Average miss by hours between publication and delivery, across all forecasts (so it doesn't change with the cutoff). Faded bars: fewer than ${MIN_RELIABLE_HOURS} hours.`}
    >
      <BarChart
        className={styles.chart}
        responsive
        style={{ width: '100%', height: 280 }}
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        role="img"
        aria-label={`Average miss by hours ahead.${nearest && furthest ? ` ${formatPower(nearest.mae_mw)} at ${bucketLabel(nearest.bucket)} ahead, ${formatPower(furthest.mae_mw)} at ${bucketLabel(furthest.bucket)} ahead.` : ''} Full values in the table below.`}
      >
        <CartesianGrid vertical={false} stroke={chartColors.grid} />
        <XAxis dataKey="bucket" interval={1} tick={axisTick} tickLine={false} axisLine={axisLine} />
        <YAxis
          width={56}
          domain={[0, 'auto']}
          tickFormatter={gigawattTick}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={barCursor}
          content={({ active, payload }) => <HorizonTooltip active={active} payload={payload} />}
        />
        <Bar
          dataKey="mae"
          fill={chartColors.forecast}
          maxBarSize={MAX_BAR_PX}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        >
          {data.map((row) => (
            <Cell key={row.bucket} fillOpacity={row.stats.n >= MIN_RELIABLE_HOURS ? 1 : 0.35} />
          ))}
        </Bar>
      </BarChart>

      <TableView summary="Show table">
        <thead>
          <tr>
            <th scope="col">Hours ahead</th>
            <th scope="col">Average miss</th>
            <th scope="col">Average error</th>
            <th scope="col">Forecast-hours</th>
          </tr>
        </thead>
        <tbody>
          {byHorizon.map((stats) => (
            <tr key={stats.bucket}>
              <th scope="row">{bucketLabel(stats.bucket)}</th>
              <td>{formatPower(stats.mae_mw, 'MW')}</td>
              <td>{formatSigned(stats.bias_mw, 'MW')}</td>
              <td>{stats.n.toLocaleString('en-GB')}</td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </ChartCard>
  )
}

function HorizonTooltip({
  active,
  payload,
}: Pick<TooltipContentProps<number, string>, 'active' | 'payload'>) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  const { stats } = row
  return (
    <TooltipBox title={`${row.bucket} ahead`}>
      <TooltipRow value={formatPower(stats.mae_mw)} label="Average miss (MAE)" />
      <TooltipRow value={formatSigned(stats.bias_mw)} label="Average error" />
      <p className={styles.tooltipNote}>
        {stats.n.toLocaleString('en-GB')} forecast-hours
        {stats.n < MIN_RELIABLE_HOURS ? ' · too few to rely on' : ''}
      </p>
    </TooltipBox>
  )
}

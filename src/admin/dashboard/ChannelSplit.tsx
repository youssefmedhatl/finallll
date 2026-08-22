import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatMoney, num } from '@/lib/money'
import { useLocale, useT } from '@/lib/i18n'
import type { Views } from '@/lib/supabase'

interface ChartTooltipEntry {
  name?: string
  value?: number
  color?: string
  dataKey?: string | number
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipEntry[]
  label?: string | number
}

interface ChannelSplitProps {
  data: Views<'v_daily_sales'>[]
  loading?: boolean
}

export function ChannelSplit({ data, loading = false }: ChannelSplitProps) {
  const { locale } = useLocale()
  const t = useT()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.channelSplit')}</CardTitle>
        </CardHeader>
        <CardBody>
          <Skeleton className="h-80 w-full" />
        </CardBody>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.channelSplit')}</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-moss text-center py-8">{t('common.loading')}</p>
        </CardBody>
      </Card>
    )
  }

  // Aggregate revenue by channel
  const channelData = data.reduce(
    (acc, row) => {
      if (row.channel === 'pos') {
        acc[0].value += num(row.net_revenue)
      } else if (row.channel === 'online') {
        acc[1].value += num(row.net_revenue)
      }
      return acc
    },
    [
      { name: t('dashboard.pos'), value: 0 },
      { name: t('dashboard.online'), value: 0 },
    ]
  )

  const COLORS = ['#7A6A55', '#3F2E22']

  const CustomTooltip = ({ active, payload }: ChartTooltipProps) => {
    if (active && payload && payload[0]) {
      return (
        <div className="rounded-lg border border-sand bg-white p-3 shadow-lg">
          <p className="text-sm font-medium text-ink">{payload[0].name}</p>
          <p className="text-sm text-moss">
            {formatMoney(payload[0].value, locale)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.channelSplit')}</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex h-64 items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={channelData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {channelData.map((_entry: ChartTooltipEntry, idx: number) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

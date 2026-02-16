'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TimeSeriesDataPoint } from '@/lib/types';

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Over Time</CardTitle>
        <CardDescription>Daily spend, purchases, and ROAS</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
              formatter={(value: number) => value.toFixed(2)}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="spend"
              stroke="#8884d8"
              name="Spend ($)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="purchases"
              stroke="#82ca9d"
              name="Purchases"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="roas"
              stroke="#ffc658"
              name="ROAS"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

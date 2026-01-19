'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface InvoiceStatusChartProps {
  data: Array<{ status: string; count: number }>;
}

export function InvoiceStatusChart({ data }: InvoiceStatusChartProps) {
  const chartData = data.map((item) => ({
    status: item.status,
    count: item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis
          dataKey="status"
          stroke="#737373"
          style={{ fontSize: '12px' }}
          tick={{ fill: '#737373' }}
        />
        <YAxis
          stroke="#737373"
          style={{ fontSize: '12px' }}
          tick={{ fill: '#737373' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: '6px',
          }}
        />
        <Bar dataKey="count" fill="#171717" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

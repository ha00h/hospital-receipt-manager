"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type MonthlyPoint = { label: string; hospital: number; pharmacy: number };

function compact(v: number) {
  if (v >= 10000) return `${Math.round(v / 10000)}만`;
  return v.toLocaleString("ko-KR");
}

export default function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} fontSize={11} width={44} />
          <Tooltip
            formatter={(v) => `₩${Number(v).toLocaleString("ko-KR")}`}
            cursor={{ fill: "#f1f5f9" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="hospital" name="병원비" stackId="a" fill="#0d9488" />
          <Bar dataKey="pharmacy" name="약제비" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Commit } from "@/lib/types";
export default function ActivityChart({ commits }: { commits: Commit[] }) {
  const grouped = new Map<
    string,
    { date: string; additions: number; deletions: number }
  >();
  for (const c of commits) {
    const date = c.committed_at.slice(0, 10);
    const point = grouped.get(date) || { date, additions: 0, deletions: 0 };
    for (const f of c.files || []) {
      point.additions += f.additions;
      point.deletions += f.deletions;
    }
    grouped.set(date, point);
  }
  const data = [...grouped.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return (
    <div
      style={{ height: 210, width: "100%" }}
      role="img"
      aria-label="Added and removed lines per day for loaded commits"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 15, right: 8, left: -25, bottom: 0 }}
        >
          <defs>
            <linearGradient id="purpleArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9675fa" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#9675fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#222433" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#777d94", fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#777d94", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "#151622",
              border: "1px solid #33354a",
              borderRadius: 8,
            }}
          />
          <Area
            type="monotone"
            dataKey="additions"
            stroke="#75bba7"
            fill="transparent"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="deletions"
            stroke="#a88afe"
            fill="url(#purpleArea)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

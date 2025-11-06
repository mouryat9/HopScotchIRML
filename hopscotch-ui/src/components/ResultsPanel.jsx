import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#4e79a7", "#59a14f", "#af7aa1", "#f28e2b", "#edc948"];

export default function ResultsPanel({ sessionId }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5173/step1/score?session_id=${sessionId}`)
      .then(res => res.json())
      .then(data => setResults(data))
      .catch(err => console.error("Error loading results:", err));
  }, [sessionId]);

  if (!results) return null;

  const data = Object.entries(results.by_worldview).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1).replace("_", " "),
    value,
  }));

  return (
    <div className="results-panel border rounded-xl p-5 shadow-md bg-white mt-4">
      <h3 className="text-lg font-semibold mb-1">
        🎉 All questions answered
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Below is your breakdown by worldview category.
      </p>

      <div className="flex flex-wrap items-center justify-between">
        <div className="w-56 h-56">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-[120px] left-[90px] text-xl font-bold text-gray-800">
            {results.total}
          </div>
        </div>

        <div className="ml-6">
          <p className="font-semibold text-md mb-2">
            Top Match: <span className="text-indigo-600 capitalize">{results.top}</span>
          </p>
          {data.map((d, i) => (
            <div key={i} className="flex justify-between text-sm mb-1">
              <span style={{ color: COLORS[i % COLORS.length] }}>{d.name}:</span>
              <span className="font-semibold ml-2">{d.value}</span>
            </div>
          ))}
          <p className="text-sm text-gray-500 mt-2">
            Total: {results.total}
          </p>
        </div>
      </div>
    </div>
  );
}

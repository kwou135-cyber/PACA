import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { DataRow } from '../types';

interface WaveformChartProps {
  data: DataRow[];
  timeKey: string;
  voltageKey: string;
  currentKey: string;
  id?: string;
}

export function WaveformChart({ data, timeKey, voltageKey, currentKey, id }: WaveformChartProps) {
  // Sub-sample data if it's too large for responsive rendering in the browser
  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const MAX_POINTS = 2000;
    if (data.length <= MAX_POINTS) return data;
    
    const step = Math.ceil(data.length / MAX_POINTS);
    return data.filter((_, i) => i % step === 0);
  }, [data]);

  const formatTime = (tick: number) => {
    // Format to ms for readability if small
    return (tick * 1000).toFixed(2) + ' ms';
  };

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <span className="text-gray-500">데이터 부족 (Insufficient Data)</span>
      </div>
    );
  }

  return (
    <div id={id} className="w-full h-[400px] bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">V/I Waveform</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={displayData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey={timeKey} 
            tickFormatter={formatTime} 
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickCount={8}
            label={{ value: 'Time', position: 'bottom', fill: '#6B7280' }}
          />
          <YAxis 
            yAxisId="left" 
            tick={{ fontSize: 12, fill: '#2563EB' }} // Blue for voltage
            label={{ value: 'Voltage (V)', angle: -90, position: 'insideLeft', fill: '#2563EB' }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            tick={{ fontSize: 12, fill: '#DC2626' }} // Red for current
            label={{ value: 'Current (A)', angle: 90, position: 'insideRight', fill: '#DC2626' }}
          />
          <Tooltip 
            labelFormatter={formatTime}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey={voltageKey} 
            stroke="#2563EB" 
            name="Voltage" 
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey={currentKey} 
            stroke="#DC2626" 
            name="Current" 
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

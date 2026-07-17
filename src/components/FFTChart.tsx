import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Label
} from 'recharts';
import { FFTResult } from '../utils/analysis';

interface FFTChartProps {
  data: FFTResult[];
  minFreq: number;
  maxFreq: number;
  id?: string;
}

export function FFTChart({ data, minFreq, maxFreq, id }: FFTChartProps) {
  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Filter by frequency range
    const filtered = data.filter(d => d.frequency >= minFreq && d.frequency <= maxFreq);
    
    // Subsample if too dense to render reasonably
    if (filtered.length > 5000) {
      const step = Math.ceil(filtered.length / 5000);
      return filtered.filter((_, i) => i % step === 0 || filtered[i].isPeak);
    }
    return filtered;
  }, [data, minFreq, maxFreq]);

  const peaks = useMemo(() => {
    return displayData.filter(d => d.isPeak && d.magnitudeDB > -40); // Only label prominent peaks
  }, [displayData]);

  const formatFreq = (tick: number) => {
    if (tick >= 1e9) return (tick / 1e9).toFixed(1) + 'G';
    if (tick >= 1e6) return (tick / 1e6).toFixed(1) + 'M';
    if (tick >= 1e3) return (tick / 1e3).toFixed(1) + 'k';
    return tick.toString();
  };

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <span className="text-gray-500">데이터 부족 (Insufficient Data for FFT)</span>
      </div>
    );
  }

  return (
    <div id={id} className="w-full h-[400px] bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">FFT Analysis (Relative dB)</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={displayData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="frequency" 
            type="number"
            scale="log"
            domain={[minFreq, maxFreq]}
            tickFormatter={formatFreq}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: 'Frequency (Hz)', position: 'bottom', fill: '#6B7280' }}
            allowDataOverflow
          />
          <YAxis 
            dataKey="magnitudeDB" 
            type="number"
            domain={[-100, 10]}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: 'Magnitude (dB)', angle: -90, position: 'insideLeft', fill: '#6B7280' }}
          />
          <Tooltip 
            labelFormatter={(label) => `${formatFreq(Number(label))}Hz`}
            formatter={(value: number) => [`${value.toFixed(2)} dB`, 'Magnitude']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <Line 
            type="monotone" 
            dataKey="magnitudeDB" 
            stroke="#4F46E5" 
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          
          {peaks.map((peak, idx) => (
             <ReferenceDot 
                key={`peak-${idx}`} 
                x={peak.frequency} 
                y={peak.magnitudeDB} 
                r={4} 
                fill="#EF4444" 
                stroke="white"
              >
                <Label value={formatFreq(peak.frequency)} position="top" fill="#EF4444" fontSize={11} />
              </ReferenceDot>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

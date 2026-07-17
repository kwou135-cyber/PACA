import React from 'react';
import { cn } from '../utils/cn';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  className?: string;
}

export function MetricCard({ title, value, subtitle, className }: MetricCardProps) {
  return (
    <div className={cn("p-6 bg-white border border-gray-200 rounded-xl shadow-sm", className)}>
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
      {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}
    </div>
  );
}

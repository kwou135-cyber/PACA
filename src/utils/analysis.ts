import FFT from 'fft.js';
import { DataRow, ColumnMapping } from '../types';

export function getTimeStep(data: DataRow[], timeCol: string): number {
  if (data.length < 2) return 1e-6;
  return data[1][timeCol] - data[0][timeCol];
}

export function extractLastNCycles(
  data: DataRow[],
  timeCol: string,
  fundamentalFreq: number,
  nCycles: number
): DataRow[] {
  if (data.length === 0 || fundamentalFreq <= 0) return data;
  
  const cycleDuration = 1 / fundamentalFreq;
  const totalDuration = nCycles * cycleDuration;
  
  const lastTime = data[data.length - 1][timeCol];
  const startTime = lastTime - totalDuration;
  
  return data.filter(row => row[timeCol] >= startTime);
}

export function calculateEfficiency(
  data: DataRow[],
  mapping: ColumnMapping
): { efficiency: number; pIn: number; pOut: number } {
  if (data.length === 0) return { efficiency: 0, pIn: 0, pOut: 0 };

  let totalPin = 0;
  let totalPout = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const pIn = row[mapping.vIn] * row[mapping.iIn];
    const pOut = row[mapping.vOut] * row[mapping.iOut];
    totalPin += pIn;
    totalPout += pOut;
  }

  const avgPin = totalPin / data.length;
  const avgPout = totalPout / data.length;
  
  const efficiency = avgPin !== 0 ? (avgPout / avgPin) * 100 : 0;
  
  return {
    efficiency: Math.max(0, Math.min(100, efficiency)),
    pIn: avgPin,
    pOut: avgPout
  };
}

export function calculateRipple(
  data: DataRow[],
  col: string
): { peakToPeak: number; ripplePercent: number; max: number; min: number; avg: number } {
  if (data.length === 0) return { peakToPeak: 0, ripplePercent: 0, max: 0, min: 0, avg: 0 };

  let max = -Infinity;
  let min = Infinity;
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    const val = data[i][col];
    if (val > max) max = val;
    if (val < min) min = val;
    sum += val;
  }

  const avg = sum / data.length;
  const peakToPeak = max - min;
  const ripplePercent = avg !== 0 ? Math.abs((peakToPeak / avg) * 100) : 0;

  return { peakToPeak, ripplePercent, max, min, avg };
}

export interface FFTResult {
  frequency: number;
  magnitudeDB: number;
  isPeak: boolean;
}

export function computeFFT(
  data: DataRow[],
  timeCol: string,
  targetCol: string
): FFTResult[] {
  if (data.length < 4) return [];

  const dt = getTimeStep(data, timeCol);
  const fs = 1 / dt;
  
  // Find next power of 2 for FFT size
  const n = data.length;
  let size = 1;
  while (size < n) size *= 2;
  // If size is much larger, maybe we just use the previous power of 2 and truncate to avoid zero padding artifacts too much,
  // or we pad with the average value. Let's just use the largest power of 2 that fits in the data.
  size = size / 2;
  if (size < 4) return [];

  const f = new FFT(size);
  const input = f.createComplexArray();
  
  const startIdx = data.length - size;
  
  // Remove DC component for better visibility of AC peaks, or keep it.
  // We'll keep it but typically the 0Hz bin is skipped in log plots.
  for (let i = 0; i < size; i++) {
    input[2 * i] = data[startIdx + i][targetCol]; // Real
    input[2 * i + 1] = 0; // Imaginary
  }

  const output = f.createComplexArray();
  f.transform(output, input);

  const results: FFTResult[] = [];
  const halfSize = size / 2;
  
  // Calculate magnitudes
  let maxMag = 0;
  const magnitudes = new Float64Array(halfSize);
  
  for (let i = 1; i < halfSize; i++) { // Skip DC (i=0)
    const re = output[2 * i];
    const im = output[2 * i + 1];
    const mag = Math.sqrt(re * re + im * im) / size;
    magnitudes[i] = mag;
    if (mag > maxMag) {
      maxMag = mag;
    }
  }

  // Convert to dB relative to fundamental (max peak)
  // 20 * log10(V_harmonic / V_fundamental)
  const thresholdDB = -100; // Ignore very small noise
  
  for (let i = 1; i < halfSize; i++) {
    const freq = (i * fs) / size;
    const mag = magnitudes[i];
    
    let magDB = thresholdDB;
    if (mag > 0 && maxMag > 0) {
      magDB = 20 * Math.log10(mag / maxMag);
    }
    
    // Simple peak detection (local maxima)
    let isPeak = false;
    if (i > 1 && i < halfSize - 1) {
       if (magDB > -60 && magnitudes[i] > magnitudes[i-1] && magnitudes[i] > magnitudes[i+1]) {
           isPeak = true;
       }
    } else if (magDB === 0) {
       isPeak = true; // The fundamental is a peak
    }
    
    results.push({
      frequency: freq,
      magnitudeDB: Math.max(magDB, thresholdDB),
      isPeak
    });
  }

  return results;
}

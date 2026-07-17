import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { UploadCloud, Download, Settings, BarChart2, Activity } from 'lucide-react';
import { AppState, DataRow, ColumnMapping } from './types';
import { calculateEfficiency, calculateRipple, computeFFT, extractLastNCycles, FFTResult } from './utils/analysis';
import { exportToImage } from './utils/export';
import { WaveformChart } from './components/WaveformChart';
import { FFTChart } from './components/FFTChart';
import { MetricCard } from './components/MetricCard';

const INITIAL_STATE: AppState = {
  rawCsvData: [],
  parsedData: [],
  headers: [],
  mapping: {
    time: '',
    vIn: '',
    iIn: '',
    vOut: '',
    iOut: ''
  },
  isMapped: false,
  cyclesToAnalyze: 10,
  fundamentalFreq: 100000, // 100 kHz default
  freqRangeMin: 1,
  freqRangeMax: 10000000000, // 10GHz default
};

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('CSV Parsing Error: ' + results.errors[0].message);
          return;
        }

        const data = results.data as DataRow[];
        const headers = results.meta.fields || [];
        
        if (data.length === 0) {
          setError('Uploaded CSV is empty.');
          return;
        }

        // Auto-guess mapping based on common names
        const guessCol = (keywords: string[]) => {
          return headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) || '';
        };

        const newMapping = {
          time: guessCol(['time', 't']),
          vIn: guessCol(['vin', 'v_in', 'voltage_in']),
          iIn: guessCol(['iin', 'i_in', 'current_in']),
          vOut: guessCol(['vout', 'v_out', 'voltage_out']),
          iOut: guessCol(['iout', 'i_out', 'current_out'])
        };

        setState(prev => ({
          ...prev,
          rawCsvData: results.data,
          parsedData: data,
          headers,
          mapping: newMapping,
          isMapped: Object.values(newMapping).every(val => val !== ''),
          error: null
        }));
      },
      error: (err) => setError('File Read Error: ' + err.message)
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleMappingChange = (key: keyof ColumnMapping, value: string) => {
    setState(prev => {
      const newMapping = { ...prev.mapping, [key]: value };
      const isMapped = Object.values(newMapping).every(v => v !== '');
      return { ...prev, mapping: newMapping, isMapped };
    });
  };

  // Memoized derived data
  const { analyzedData, rippleData, efficiencyResult, fftData } = useMemo(() => {
    if (!state.isMapped || state.parsedData.length === 0) {
      return { analyzedData: [], rippleData: null, efficiencyResult: null, fftData: [] };
    }

    // Sort by time just in case
    const sortedData = [...state.parsedData].sort((a, b) => a[state.mapping.time] - b[state.mapping.time]);

    // Extract N cycles for efficiency and ripple
    const cycleData = extractLastNCycles(
      sortedData, 
      state.mapping.time, 
      state.fundamentalFreq, 
      state.cyclesToAnalyze
    );

    const eff = calculateEfficiency(cycleData, state.mapping);
    const ripple = calculateRipple(cycleData, state.mapping.vOut);
    
    // For FFT, typically use the steady state (last 10 cycles as per PRD for detailed view, but FFT uses all or a large window).
    // The PRD mentions FFT analysis over the data. Let's use the whole dataset or last part.
    // FFT needs 2^N samples. computeFFT handles it.
    const fft = computeFFT(sortedData, state.mapping.time, state.mapping.vOut);

    return {
      analyzedData: cycleData,
      rippleData: ripple,
      efficiencyResult: eff,
      fftData: fft
    };
  }, [state.parsedData, state.mapping, state.isMapped, state.cyclesToAnalyze, state.fundamentalFreq]);

  // Export handlers
  const handleExportAll = async () => {
    await exportToImage('waveform-chart', 'PACA_Waveform');
    await exportToImage('fft-chart', 'PACA_FFT');
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center gap-3">
          <Activity className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Power-Viz (PACA)</h1>
        </div>
        
        <div className="p-6 flex-1 flex flex-col gap-8">
          {/* File Upload Area */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">1. Data Ingestion</h2>
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }`}
              onClick={() => document.getElementById('csv-upload')?.click()}
            >
              <UploadCloud className={`w-8 h-8 mb-3 ${isDragging ? 'text-indigo-600' : 'text-gray-400'}`} />
              <p className="text-sm text-gray-600 font-medium">Drag & Drop CSV here</p>
              <p className="text-xs text-gray-500 mt-1">or click to browse</p>
              <input 
                id="csv-upload" 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
              />
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            {state.parsedData.length > 0 && (
              <p className="text-xs text-green-600 font-medium">Loaded {state.parsedData.length} rows</p>
            )}
          </div>

          {/* Column Mapping */}
          {state.parsedData.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">2. Column Mapping</h2>
              <div className="space-y-3">
                {Object.keys(INITIAL_STATE.mapping).map((key) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <select
                      value={state.mapping[key as keyof ColumnMapping]}
                      onChange={(e) => handleMappingChange(key as keyof ColumnMapping, e.target.value)}
                      className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="">Select column...</option>
                      {state.headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">3. Analysis Settings</h2>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">Fundamental Freq (Hz)</label>
                <input 
                  type="number"
                  value={state.fundamentalFreq}
                  onChange={(e) => setState(p => ({ ...p, fundamentalFreq: Number(e.target.value) }))}
                  className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">Cycles to Analyze (Steady-state)</label>
                <input 
                  type="number"
                  value={state.cyclesToAnalyze}
                  onChange={(e) => setState(p => ({ ...p, cyclesToAnalyze: Number(e.target.value) }))}
                  className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">FFT Freq Range (Min Hz)</label>
                <input 
                  type="number"
                  value={state.freqRangeMin}
                  onChange={(e) => setState(p => ({ ...p, freqRangeMin: Number(e.target.value) }))}
                  className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">FFT Freq Range (Max Hz)</label>
                <input 
                  type="number"
                  value={state.freqRangeMax}
                  onChange={(e) => setState(p => ({ ...p, freqRangeMax: Number(e.target.value) }))}
                  className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col h-full bg-gray-50 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
            <p className="text-sm text-gray-500">Automated Converter Analysis Results</p>
          </div>
          <button 
            onClick={handleExportAll}
            disabled={!state.isMapped || analyzedData.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Reports
          </button>
        </header>

        <div className="p-8 flex-1 max-w-7xl mx-auto w-full space-y-6">
          {!state.isMapped ? (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-white text-gray-500">
              <BarChart2 className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-900">No Data Mapped</p>
              <p className="text-sm">Please upload a CSV and complete column mapping in the sidebar.</p>
            </div>
          ) : (
            <>
              {/* Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard 
                  title="System Efficiency" 
                  value={efficiencyResult ? `${efficiencyResult.efficiency.toFixed(2)}%` : '0.00%'}
                  subtitle={efficiencyResult ? `Pin: ${efficiencyResult.pIn.toFixed(2)}W | Pout: ${efficiencyResult.pOut.toFixed(2)}W` : ''}
                />
                <MetricCard 
                  title="Output Voltage Ripple (Vout)" 
                  value={rippleData ? `${rippleData.ripplePercent.toFixed(2)}%` : '0.00%'}
                  subtitle={rippleData ? `Peak-to-Peak: ${rippleData.peakToPeak.toFixed(3)}V` : ''}
                />
                <MetricCard 
                  title="Steady-State Average (Vout)" 
                  value={rippleData ? `${rippleData.avg.toFixed(3)} V` : '0.00 V'}
                  subtitle={`Over last ${state.cyclesToAnalyze} cycles`}
                />
              </div>

              {/* Charts */}
              <div className="space-y-6">
                <WaveformChart 
                  id="waveform-chart"
                  data={analyzedData}
                  timeKey={state.mapping.time}
                  voltageKey={state.mapping.vOut}
                  currentKey={state.mapping.iOut}
                />
                
                <FFTChart 
                  id="fft-chart"
                  data={fftData}
                  minFreq={state.freqRangeMin}
                  maxFreq={state.freqRangeMax}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

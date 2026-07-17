export interface DataRow {
  [key: string]: number;
}

export interface ColumnMapping {
  time: string;
  vIn: string;
  iIn: string;
  vOut: string;
  iOut: string;
}

export interface AppState {
  rawCsvData: any[];
  parsedData: DataRow[];
  headers: string[];
  mapping: ColumnMapping;
  isMapped: boolean;
  cyclesToAnalyze: number;
  fundamentalFreq: number;
  freqRangeMin: number;
  freqRangeMax: number;
}

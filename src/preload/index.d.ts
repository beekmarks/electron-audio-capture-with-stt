import { ElectronAPI } from '@electron-toolkit/preload'

// Import the TranscriptionResult interface
interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration: number;
  [key: string]: any; // For any additional fields returned by the service
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    nodeAPI: {
      bufferAlloc: (size: number) => Buffer;
      writeFile: (path: string, data: Uint8Array) => Promise<void>;
      transcribeAudio: (audioData: Uint8Array) => Promise<TranscriptionResult>;
    }
  }
}

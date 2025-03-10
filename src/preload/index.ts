import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { transcribeAudio } from '../stt-transcription'

// Custom APIs for renderer

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('nodeAPI', {
      bufferAlloc: (size: number) => Buffer.alloc(size),
      writeFile: (path: string, data: Uint8Array) => {
        return electronAPI.ipcRenderer.invoke('writeFile', path, data)
      },
      transcribeAudio: async (audioData: Uint8Array) => {
        // Convert Uint8Array to Buffer for the transcription function
        const buffer = Buffer.from(audioData);
        try {
          const result = await transcribeAudio(buffer);
          return result;
        } catch (error) {
          console.error('Transcription error:', error);
          throw error;
        }
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

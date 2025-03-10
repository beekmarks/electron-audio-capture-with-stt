import { audio_stream } from './audio_capture'
import { buffer, firstValueFrom, fromEvent, map, ObservableInput } from 'rxjs'
import { renderWavFile } from './wav'

async function record_wav(stop_event: ObservableInput<any>): Promise<void> {
  const data = await firstValueFrom(
    audio_stream().pipe(
      buffer(stop_event),
      map((chunks) => {
        const numFrames = chunks.reduce((acc, chunk) => acc.concat(chunk), [])
        return new Float32Array(numFrames)
      }),
      map((data) =>
        renderWavFile(data, { isFloat: false, numChannels: 1, sampleRate: 44100 })
      )
    )
  )
  console.log('Writing file')
  await window.nodeAPI.writeFile('out.wav', data)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function init(): void {
  window.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton')
    const stopButton = document.getElementById('stopButton')
    if (!startButton || !stopButton) {
      console.error('Missing startButton or stopButton')
      return
    }

    startButton.addEventListener('click', record_wav.bind(null, fromEvent(stopButton, 'click')))

    // connectServer(import.meta.env.VITE_WS_URL)
  })
}

init()

// function connectServer(url: string): void {
//   const socket = new WebSocket(url)

//   socket.addEventListener('open', (_event) => {
//     socket.send('Hello Server!')
//   })

//   socket.addEventListener('message', (event) => {
//     console.log('Message from server ', event.data)
//   })
// }

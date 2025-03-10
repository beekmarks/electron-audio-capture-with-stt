import { Observable } from 'rxjs'

export class Capturer {
  private recording_stream?: MediaStream
  private audio_context?: AudioContext

  private async mic(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })
  }

  private async audio(): Promise<MediaStream> {
    return navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        width: 320,
        height: 240,
        frameRate: 30
      }
    })
  }

  mergeAudioStreams(
    audio_context: AudioContext,
    desktopStream: MediaStream,
    voiceStream: MediaStream
  ): MediaStreamTrack[] {
    // Create a couple of sources
    const source1 = audio_context.createMediaStreamSource(desktopStream)
    const source2 = audio_context.createMediaStreamSource(voiceStream)
    const destination = audio_context.createMediaStreamDestination()

    const gain = audio_context.createGain()
    gain.channelCountMode = 'explicit'
    gain.channelCount = 2

    source1.connect(gain)
    source2.connect(gain)
    gain.connect(destination)

    // const desktopGain = audio_context.createGain();
    // const voiceGain = audio_context.createGain();

    // desktopGain.gain.value = 0.7;
    // voiceGain.gain.value = 0.7;

    // source1.connect(desktopGain).connect(destination);
    // source2.connect(voiceGain).connect(destination);

    return destination.stream.getAudioTracks()
  }

  private sampleRate(stream: MediaStream): number | undefined {
    return stream.getAudioTracks()[0].getSettings().sampleRate
  }

  startRecording = async (cb: (buffer: number[]) => void): Promise<void> => {
    if (this.recording_stream) {
      return
    }

    this.audio_context = new AudioContext({ sampleRate: 44100 })
    this.recording_stream = new MediaStream(
      this.mergeAudioStreams(this.audio_context, await this.audio(), await this.mic())
    )
    const audioSource = this.audio_context.createMediaStreamSource(this.recording_stream)

    await this.audio_context.audioWorklet.addModule(new URL('wave-loopback.js', import.meta.url))
    const waveLoopbackNode = new AudioWorkletNode(this.audio_context, 'wave-loopback')
    waveLoopbackNode.port.onmessage = (event): void => {
      const inputFrame = event.data
      // console.log(inputFrame)
      cb(inputFrame)
    }

    audioSource.connect(waveLoopbackNode)
    waveLoopbackNode.connect(this.audio_context.destination)

    console.log('Recording started')
  }

  stopRecording = async (): Promise<void> => {
    if (!this.recording_stream) {
      return
    }

    this.recording_stream.getTracks().forEach((track) => track.stop())
    this.recording_stream = undefined

    if (this.audio_context) {
      this.audio_context.close()
      this.audio_context = undefined
    }

    console.log('Recording stopped')
  }
}

export function audio_stream(): Observable<number[]> {
    const capturer = new Capturer()
    return new Observable<number[]>((subscriber) => {
      capturer.startRecording((buffer) => {
        subscriber.next(buffer)
      })
  
      return (): void => {
        capturer.stopRecording()
        subscriber.complete()
      }}
    )    
}
/* eslint-disable prettier/prettier */
class WaveLoopback extends AudioWorkletProcessor {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  process(inputs, _outputs, _parameters) {
    this.pushData(inputs[0][0])

    this.port.postMessage(this.buffer)
    this.buffer = []

    return true
  }

  pushData(samples) {
    for (var i = 0; i < samples.length; i++) {
      this.buffer.push(samples[i])
    }
  }

  constructor() {
    super()
    this.buffer = []
  }
}

registerProcessor('wave-loopback', WaveLoopback)

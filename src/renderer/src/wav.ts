type WavOptions = {
  isFloat: boolean
  numChannels?: number
  sampleRate?: number
}

export function renderWavFile(buffer: Float32Array, options: WavOptions): Uint8Array {
  // adapted from https://gist.github.com/also/900023
  // returns Uint8Array of WAV header bytes
  function getWavHeader(options: WavOptions, numFrames: number): Uint8Array {
    // const numFrames = options.numFrames
    const numChannels = options.numChannels || 2;
    const sampleRate = options.sampleRate || 44100;
    const bytesPerSample = options.isFloat ? 4 : 2;
    const format = options.isFloat ? 3 : 1;

    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numFrames * blockAlign;

    const buffer = new ArrayBuffer(44);
    const dv = new DataView(buffer);

    let p = 0;

    function writeString(s: string): void {
      for (let i = 0; i < s.length; i++) {
        dv.setUint8(p + i, s.charCodeAt(i));
      }
      p += s.length;
    }

    function writeUint32(d: number): void {
      dv.setUint32(p, d, true);
      p += 4;
    }

    function writeUint16(d: number): void {
      dv.setUint16(p, d, true);
      p += 2;
    }

    writeString('RIFF'); // ChunkID
    writeUint32(dataSize + 36); // ChunkSize
    writeString('WAVE'); // Format
    writeString('fmt '); // Subchunk1ID
    writeUint32(16); // Subchunk1Size
    writeUint16(format); // AudioFormat https://i.sstatic.net/BuSmb.png
    writeUint16(numChannels); // NumChannels
    writeUint32(sampleRate); // SampleRate
    writeUint32(byteRate); // ByteRate
    writeUint16(blockAlign); // BlockAlign
    writeUint16(bytesPerSample * 8); // BitsPerSample
    writeString('data'); // Subchunk2ID
    writeUint32(dataSize); // Subchunk2Size

    return new Uint8Array(buffer);
  }

  // Convert Float32Array to PCM Int16Array if not using float format
  let audioData: Float32Array | Int16Array = buffer;
  if (!options.isFloat) {
    // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
    const pcmData = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      // Scale to int16 range and clamp
      const s = Math.max(-1, Math.min(1, buffer[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    audioData = pcmData;
  }

  const type = options.isFloat ? Float32Array : Int16Array;
  const numFrames = audioData.length;

  const headerBytes = getWavHeader(options, numFrames);
  const wavBytes = new Uint8Array(headerBytes.length + audioData.byteLength);

  // prepend header, then add pcmBytes
  wavBytes.set(headerBytes, 0);
  wavBytes.set(new Uint8Array(audioData.buffer), headerBytes.length);

  return wavBytes;
}

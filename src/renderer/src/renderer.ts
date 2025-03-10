import { audio_stream } from './audio_capture'
import { buffer, interval, Subject, Subscription, takeUntil } from 'rxjs'
import { renderWavFile } from './wav'

// Define the TranscriptionResult interface locally to avoid import issues
interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration: number;
  [key: string]: any; // For any additional fields returned by the service
}

// Constants
const INTERVAL_SECONDS = 30;
const TARGET_SAMPLE_RATE = 8000; // Target sample rate for the SageMaker endpoint
const DEVICE_SAMPLE_RATE = 44100; // Typical device sample rate

// State variables
let isRecording = false;
let recordingSubscription: Subscription | null = null;
let transcriptionResults: TranscriptionResult[] = [];

/**
 * Simple audio resampling function to convert from one sample rate to another
 * @param audioData The original audio data
 * @param originalSampleRate The original sample rate of the audio data
 * @param targetSampleRate The target sample rate to convert to
 * @returns Resampled audio data as Float32Array
 */
function resampleAudio(audioData: Float32Array, originalSampleRate: number, targetSampleRate: number): Float32Array {
  if (originalSampleRate === targetSampleRate) {
    return audioData;
  }
  
  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  
  // Simple linear interpolation resampling
  // Note: For production use, consider using a more sophisticated algorithm
  for (let i = 0; i < newLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    
    if (index >= audioData.length - 1) {
      result[i] = audioData[audioData.length - 1];
    } else {
      result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
    }
  }
  
  return result;
}

/**
 * Renders audio data as a WAV file with the required format specifications:
 * - PCM encoding (16-bit)
 * - 8000 Hz sample rate
 * - Mono (1 channel)
 */
async function renderAudioToWav(audioData: Float32Array): Promise<Uint8Array> {
  return renderWavFile(audioData, { 
    isFloat: false, // PCM format (not floating point) - this will use 16-bit depth
    numChannels: 1, // Mono
    sampleRate: TARGET_SAMPLE_RATE // 8000 Hz
  });
}

/**
 * Processes a chunk of audio data by converting it to WAV and sending for transcription
 * Ensures the audio format matches the required specifications:
 * - PCM encoding (16-bit)
 * - 8000 Hz sample rate
 * - Mono (1 channel)
 */
async function processAudioChunk(chunks: number[][]): Promise<TranscriptionResult | null> {
  try {
    // Convert chunks to a single Float32Array
    const numFrames = chunks.reduce((acc, chunk) => acc.concat(chunk), []);
    const originalAudioData = new Float32Array(numFrames);
    
    // Resample the audio from device sample rate to target sample rate (8000 Hz)
    console.log(`Resampling audio from ${DEVICE_SAMPLE_RATE}Hz to ${TARGET_SAMPLE_RATE}Hz`);
    const resampledAudioData = resampleAudio(originalAudioData, DEVICE_SAMPLE_RATE, TARGET_SAMPLE_RATE);
    
    // Render as WAV file using the resampled audio data
    const wavData = await renderAudioToWav(resampledAudioData);
    
    // Save the WAV file (for debugging/reference)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chunk-${timestamp}.wav`;
    await window.nodeAPI.writeFile(filename, wavData);
    
    console.log(`Saved audio chunk to ${filename}, sending for transcription...`);
    
    // Send for transcription
    const result = await window.nodeAPI.transcribeAudio(wavData);
    console.log('Transcription result:', result);
    
    // Add to results array
    transcriptionResults.push(result);
    
    // Update UI with transcription result
    updateTranscriptionUI(result);
    
    return result;
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    return null;
  }
}

/**
 * Updates the UI with transcription results
 */
function updateTranscriptionUI(result: TranscriptionResult): void {
  const resultsContainer = document.getElementById('transcriptionResults');
  if (!resultsContainer) return;
  
  console.log('Updating UI with transcription result:', JSON.stringify(result, null, 2));
  
  const resultElement = document.createElement('div');
  resultElement.className = 'transcription-result';
  
  const timestamp = document.createElement('div');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();
  
  const text = document.createElement('div');
  text.className = 'text';
  
  // Extract the text from the result object based on the structure
  let transcribedText = '(No transcription)';
  
  try {
    if (result.text) {
      // Handle case where text is an array of objects with text property
      if (Array.isArray(result.text) && result.text.length > 0) {
        const textItems = result.text.map(item => {
          if (typeof item === 'object' && item !== null && 'text' in item) {
            return item.text;
          }
          return String(item);
        });
        transcribedText = textItems.join(' ');
      } 
      // Handle case where text is a string directly
      else if (typeof result.text === 'string') {
        transcribedText = result.text;
      }
      // Handle any other format by converting to string
      else {
        transcribedText = JSON.stringify(result.text);
      }
    }
  } catch (error) {
    console.error('Error parsing transcription result:', error);
    transcribedText = `Error parsing result: ${error instanceof Error ? error.message : String(error)}`;
  }
  
  text.textContent = transcribedText;
  
  resultElement.appendChild(timestamp);
  resultElement.appendChild(text);
  
  // Add to the top of the list
  resultsContainer.insertBefore(resultElement, resultsContainer.firstChild);
}

/**
 * Starts recording audio in 30-second intervals
 */
function startIntervalRecording(): void {
  if (isRecording) return;
  isRecording = true;
  
  // Clear previous results
  transcriptionResults = [];
  const resultsContainer = document.getElementById('transcriptionResults');
  if (resultsContainer) {
    resultsContainer.innerHTML = '';
  }
  
  console.log(`Starting interval recording (${INTERVAL_SECONDS} second intervals)`);
  
  // Create a subject that will emit when recording should stop
  const stopSubject = new Subject<void>();
  
  // Create an interval observable that emits every INTERVAL_SECONDS
  const intervalObservable = interval(INTERVAL_SECONDS * 1000);
  
  // Start the audio stream
  const audioObservable = audio_stream();
  
  // Subscribe to the audio stream and process chunks at intervals
  recordingSubscription = audioObservable.pipe(
    // Buffer the audio data until the interval emits
    buffer(intervalObservable),
    // Stop when the stop subject emits
    takeUntil(stopSubject)
  ).subscribe({
    next: async (chunks) => {
      if (chunks.length === 0) return;
      
      console.log(`Processing ${chunks.length} audio chunks after ${INTERVAL_SECONDS} seconds`);
      await processAudioChunk(chunks);
    },
    error: (err) => {
      console.error('Error in audio recording:', err);
      stopIntervalRecording();
    },
    complete: () => {
      console.log('Interval recording completed');
    }
  });
  
  // Store the stop subject so we can trigger it later
  (window as any).stopRecordingSubject = stopSubject;
}

/**
 * Stops the interval recording
 */
function stopIntervalRecording(): void {
  if (!isRecording) return;
  
  console.log('Stopping interval recording');
  
  // Trigger the stop subject
  const stopSubject = (window as any).stopRecordingSubject;
  if (stopSubject) {
    stopSubject.next();
    stopSubject.complete();
    (window as any).stopRecordingSubject = null;
  }
  
  // Unsubscribe from the recording subscription
  if (recordingSubscription) {
    recordingSubscription.unsubscribe();
    recordingSubscription = null;
  }
  
  isRecording = false;
  
  console.log('Recording stopped, transcription results:', transcriptionResults);
}

// Legacy function removed to fix TypeScript warnings

/**
 * Initialize the application
 */
function init(): void {
  window.addEventListener('DOMContentLoaded', () => {
    // Get UI elements
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    
    if (!startButton || !stopButton) {
      console.error('Missing startButton or stopButton');
      return;
    }
    
    // Create transcription results container if it doesn't exist
    if (!document.getElementById('transcriptionResults')) {
      const container = document.createElement('div');
      container.id = 'transcriptionResults';
      container.className = 'transcription-results';
      document.body.appendChild(container);
      
      // Add some basic styling
      const style = document.createElement('style');
      style.textContent = `
        .transcription-results {
          margin-top: 20px;
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #ccc;
          padding: 10px;
        }
        .transcription-result {
          margin-bottom: 10px;
          padding: 8px;
          background-color: #f5f5f5;
          border-radius: 4px;
        }
        .timestamp {
          font-size: 0.8em;
          color: #666;
        }
        .text {
          margin-top: 5px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set up event listeners
    startButton.addEventListener('click', startIntervalRecording);
    stopButton.addEventListener('click', stopIntervalRecording);
  });
}

init();


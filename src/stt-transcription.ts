import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import { Agent } from 'https';
import { NodeHttpHandler } from "@smithy/node-http-handler";

// Default endpoint name
const DEFAULT_ENDPOINT_NAME = 'dlsg-ds-asr-real-time-djl-2-endpoint';

// Define content type and accept type
const CONTENT_TYPE = 'audio/wav';
const ACCEPT_TYPE = 'application/json';

/**
 * Configuration options for the transcription service
 */
export interface TranscriptionOptions {
  region?: string;
  profile?: string;
  endpointName?: string;
}

/**
 * Transcription result interface
 */
export interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration: number;
  [key: string]: any; // For any additional fields returned by the service
}

/**
 * Creates a SageMaker client with the given options
 */
function createClient(options: TranscriptionOptions = {}) {
  return new SageMakerRuntimeClient({
    region: options.region || 'us-east-1',
    credentials: fromIni({ profile: options.profile || 'default' }),
    requestHandler: new NodeHttpHandler({
      httpsAgent: new Agent({
        rejectUnauthorized: false
      })
    })
  });
}

/**
 * Transcribes audio data using AWS SageMaker
 * @param audioData The audio data as a Buffer or Uint8Array
 * @param options Configuration options
 * @returns Promise resolving to the transcription result
 */
export async function transcribeAudio(
  audioData: Buffer | Uint8Array,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const client = createClient(options);
  const endpointName = options.endpointName || DEFAULT_ENDPOINT_NAME;
  
  const params = {
    EndpointName: endpointName,
    Body: audioData,
    ContentType: CONTENT_TYPE,
    Accept: ACCEPT_TYPE,
  };
  
  const command = new InvokeEndpointCommand(params);
  
  const startTime = Date.now();
  console.log(`Transcription request started at: ${new Date(startTime).toISOString()}`);
  
  try {
    const data = await client.send(command);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Transcription request completed in ${duration} ms`);
    
    if (!data.Body) {
      throw new Error('No response body received from SageMaker endpoint');
    }
    
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(data.Body);
    const jsonObject = JSON.parse(jsonString);
    
    return {
      ...jsonObject,
      duration
    };
  } catch (error) {
    const endTime = Date.now();
    console.error(`Transcription failed after ${endTime - startTime} ms:`, error);
    throw error;
  }
}
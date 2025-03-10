import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";
import * as fs from 'fs';
import { fromIni } from "@aws-sdk/credential-providers";
import { Agent } from 'https';
 
// Define the local WAV file path
const localWavFilePath = 'out.wav';
const endpointName = 'dlsg-ds-asr-real-time-djl-2-endpoint';
 
// Read the WAV file from the local file system
const testData = fs.readFileSync(localWavFilePath);
 
// Define content type and accept type
const contentType = 'audio/wav';
const acceptType = 'application/json';
 
// Set up AWS credentials and region using the default credential provider chain
const client = new SageMakerRuntimeClient({
  region: 'us-east-1', // Replace with your region
  credentials: fromIni({ profile: 'default' }),
  requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent({
      rejectUnauthorized: false
    })
  })
});
 
const params = {
  EndpointName: endpointName,
  Body: testData,
  ContentType: contentType,
  Accept: acceptType,
};
 
const command = new InvokeEndpointCommand(params);
 
const startTime = Date.now();
console.log(`Request started at: ${new Date(startTime).toISOString()}`);
 
client.send(command).then(
  (data) => {
    const endTime = Date.now();
    console.log(`Request ended at: ${new Date(endTime).toISOString()}`);
    console.log(`Duration: ${endTime - startTime} ms`);
 
    const output = data.Body;
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(output);
    const jsonObject = JSON.parse(jsonString);
    console.log(jsonObject);
  },
  (error) => {
    const endTime = Date.now();
    console.log(`Request ended at: ${new Date(endTime).toISOString()}`);
    console.log(`Duration: ${endTime - startTime} ms`);
    console.error(error);
  }
);
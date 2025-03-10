"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const clientSagemakerRuntime = require("@aws-sdk/client-sagemaker-runtime");
const credentialProviders = require("@aws-sdk/credential-providers");
const https = require("https");
const nodeHttpHandler = require("@smithy/node-http-handler");
const DEFAULT_ENDPOINT_NAME = "dlsg-ds-asr-real-time-djl-2-endpoint";
const CONTENT_TYPE = "audio/wav";
const ACCEPT_TYPE = "application/json";
function createClient(options = {}) {
  return new clientSagemakerRuntime.SageMakerRuntimeClient({
    region: options.region || "us-east-1",
    credentials: credentialProviders.fromIni({ profile: options.profile || "default" }),
    requestHandler: new nodeHttpHandler.NodeHttpHandler({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    })
  });
}
async function transcribeAudio(audioData, options = {}) {
  const client = createClient(options);
  const endpointName = options.endpointName || DEFAULT_ENDPOINT_NAME;
  const params = {
    EndpointName: endpointName,
    Body: audioData,
    ContentType: CONTENT_TYPE,
    Accept: ACCEPT_TYPE
  };
  const command = new clientSagemakerRuntime.InvokeEndpointCommand(params);
  const startTime = Date.now();
  console.log(`Transcription request started at: ${new Date(startTime).toISOString()}`);
  try {
    const data = await client.send(command);
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`Transcription request completed in ${duration} ms`);
    if (!data.Body) {
      throw new Error("No response body received from SageMaker endpoint");
    }
    const decoder = new TextDecoder("utf-8");
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
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("nodeAPI", {
      bufferAlloc: (size) => Buffer.alloc(size),
      writeFile: (path, data) => {
        return preload.electronAPI.ipcRenderer.invoke("writeFile", path, data);
      },
      transcribeAudio: async (audioData) => {
        const buffer = Buffer.from(audioData);
        try {
          const result = await transcribeAudio(buffer);
          return result;
        } catch (error) {
          console.error("Transcription error:", error);
          throw error;
        }
      }
    });
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}

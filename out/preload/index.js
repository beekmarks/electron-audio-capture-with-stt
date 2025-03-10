"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("nodeAPI", {
      bufferAlloc: (size) => Buffer.alloc(size),
      writeFile: (path, data) => {
        return preload.electronAPI.ipcRenderer.invoke("writeFile", path, data);
      }
    });
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}

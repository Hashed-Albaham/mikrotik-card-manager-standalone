const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cardManagerRuntime", {
  capabilities: () => ipcRenderer.invoke("runtime:capabilities"),
  sendBatch: input => ipcRenderer.invoke("mikrotik:send-batch", input)
});

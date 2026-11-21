"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  openFile: () => ipcRenderer.invoke("dialog:open"),
  saveFile: (defaultName, content) => ipcRenderer.invoke("dialog:save", { defaultName, content }),
  getKey: (provider) => ipcRenderer.invoke("keys:get", provider),
  setKey: (provider, key) => ipcRenderer.invoke("keys:set", { provider, key }),
  llmExtract: (provider, key, model, conv) => ipcRenderer.invoke("llm:extract", { provider, key, model, conv }),
  historyList: () => ipcRenderer.invoke("history:list"),
  historyAdd: (entry) => ipcRenderer.invoke("history:add", entry),
  historyClear: () => ipcRenderer.invoke("history:clear"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (obj) => ipcRenderer.invoke("settings:set", obj),
  openExternal: (url) => ipcRenderer.invoke("open:external", url)
});

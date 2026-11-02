// electron-builder afterPack hook: drops Electron files the app never uses,
// to keep the download and the portable exe's unpack on every start smaller.
const { rmSync } = require('node:fs');
const path = require('node:path');

// DirectX shader compiler, only loaded for WebGPU.
const UNUSED_FILES = ['dxcompiler.dll', 'dxil.dll'];

exports.default = async function afterPack({ appOutDir }) {
  for (const file of UNUSED_FILES) {
    rmSync(path.join(appOutDir, file), { force: true });
  }
};

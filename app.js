// ==========================================
// 1. HTML ELEMENT CONNECTIONS & STATE
// ==========================================
const romUpload = document.getElementById('rom-upload');
const romName = document.getElementById('rom-name');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const canvas = document.getElementById('emulator-screen');
const ctx = canvas.getContext('2d');

const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');
const stateUpload = document.getElementById('state-upload');

let romBuffer = null;
let isPlaying = false;
let animationFrameId = null;
let currentSystem = null; // 'NES', 'GB', or 'GBA'

let nes = null; 
let gba = null; 

// ==========================================
// 2. DYNAMIC CORE LOADER
// ==========================================
function injectCoreScript(url) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load engine from ${url}`));
        document.head.appendChild(script);
    });
}

// ==========================================
// 3. AUDIO ENGINE SETUP
// ==========================================
let audioCtx = null;
let scriptProcessor = null;
let audioBufferQueue = [];

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    scriptProcessor = audioCtx.createScriptProcessor(2048, 0, 2);
    
    scriptProcessor.onaudioprocess = function(e) {
        const outputLeft = e.outputBuffer.getChannelData(0);
        const outputRight = e.outputBuffer.getChannelData(1);
        for (let i = 0; i < 2048; i++) {
            if (audioBufferQueue.length > 0) {
                const sample = audioBufferQueue.shift();
                outputLeft[i] = sample.left;
                outputRight[i] = sample.right;
            } else {
                outputLeft[i] = 0;
                outputRight[i] = 0;
            }
        }
    };
    scriptProcessor.connect(audioCtx.destination);
}

function playAudioSample(left, right) {
    if (!audioCtx || !isPlaying) return;
    if (audioBufferQueue.length > 4096) audioBufferQueue = []; 
    audioBufferQueue.push({ left: left, right: right });
}

// ==========================================
// 4. ROM FILE LOADER & AUTOMATIC ENGINE SWITCHER
// ==========================================
romUpload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    romName.textContent = `Loading core for: ${file.name}...`;
    
    try {
        if (extension === 'nes') {
            currentSystem = 'NES';
            canvas.width = 256;
            canvas.height = 240;
            canvas.style.aspectRatio = "256 / 240";
            
            await injectCoreScript('https://cdnjs.cloudflare.com/ajax/libs/jsnes/1.2.1/jsnes.min.js');
            
            if (!nes) {
                nes = new jsnes.NES({
                    sampleRate: 44100,
                    emulateSound: true,
                    onFrame: function(buffer) {
                        const imageData = ctx.getImageData(0, 0, 256, 240);
                        const data = imageData.data;
                        for (let i = 0; i < 256 * 240; i++) {
                            const pixel = buffer[i];
                            const index = i * 4;
                            data[index]     = (pixel >> 16) & 0xff;   
                            data[index + 1] = (pixel >> 8) & 0xff;   
                            data[index + 2] = pixel & 0xff;   
                            data[index + 3] = 0xff;
                        }
                        ctx.putImageData(imageData, 0, 0);
                    },
                    onAudioSample: playAudioSample
                });
            }
        } else if (extension === 'gb' || extension === 'gbc') {
            currentSystem = 'GB';
            canvas.width = 160;
            canvas.height = 144;
            canvas.style.aspectRatio = "160 / 144";
            
            await injectCoreScript('https://unpkg.com/wasmboy@0.5.1/dist/wasmboy.wasm.js');
            
            if (window.WasmBoy) {
                WasmBoy.config({ autostart: false, isAudioEnabled: true, enableDynamicSpeed: true });
            }
        } else if (extension === 'gba') {
            currentSystem = 'GBA';
            canvas.width = 240;
            canvas.height = 160;
            canvas.style.aspectRatio = "240 / 160";
            
            // Loading a verified full-production standalone single script bundle
            await injectCoreScript('https://cdnjs.cloudflare.com/ajax/libs/iodinegba/0.1.0/IodineGBA.min.js');
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            romBuffer = e.target.result;
            romName.textContent = `Ready to Play: ${file.name}`;
            
            btnPlay.disabled = false;
            btnPause.disabled = false;
            btnReset.disabled = false;
            btnSave.disabled = (currentSystem === 'GBA'); 
            btnLoad.disabled = (currentSystem === 'GBA');
        };
        reader.readAsArrayBuffer(file);

    } catch (error) {
        alert(`EMULATOR ENGINE ERROR:\n${error.message}`);
        romName.textContent = "Failed to load core.";
    }
});

// ==========================================
// 5. DYNAMIC CONTROLLER MAPPING LOGIC
// ==========================================
const controllerState = { Up: 0, Down: 0, Left: 0, Right: 0, A: 0, B: 0, Start: 0, Select: 0 };
let keyMap = {
    'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
    'z': 'A', 'Z': 'A', 'x': 'B', 'X': 'B', 'Enter': 'Start', 'Shift': 'Select'
};

const btnMap = document.getElementById('btn-map');
const mappingModal = document.getElementById('mapping-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const mappingList = document.getElementById('mapping-list');
let activeRemapButton = null;

btnMap.addEventListener('click', () => {
    mappingList.innerHTML = ''; 
    Object.keys(controllerState).forEach(gameButton => {
        const row = document.createElement('div');
        row.className = 'map-row';
        const currentKey = Object.keys(keyMap).find(key => keyMap[key] === gameButton) || 'None';
        row.innerHTML = `<span><strong>${gameButton}:</strong></span><button data-button="${gameButton}">${currentKey.replace('Arrow', '')}</button>`;
        mappingList.appendChild(row);
    });
    mappingModal.classList.remove('hidden');
});

mappingList.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        document.querySelectorAll('.map-row button').forEach(b => b.classList.remove('listening'));
        activeRemapButton = e.target;
        activeRemapButton.classList.add('listening');
        activeRemapButton.textContent = 'Press any key...';
    }
});

btnCloseModal.addEventListener('click', () => { mappingModal.classList.add('hidden'); activeRemapButton = null; });

function passInputToGBA(buttonName, isPressed) {
    if (!gba) return;
    const keys = { 'A': 0, 'B': 1, 'Select': 2, 'Start': 3, 'Right': 4, 'Left': 5, 'Up': 6, 'Down': 7 };
    const keyId = keys[buttonName];
    if (keyId !== undefined) {
        if (isPressed) gba.keyDown(keyId);
        else gba.keyUp(keyId);
    }
}

window.addEventListener('keydown', (event) => {
    if (activeRemapButton) {
        event.preventDefault();
        const gameButtonToAssign = activeRemapButton.getAttribute('data-button');
        const newPressedKey = event.key;
        Object.keys(keyMap).forEach(key => { if (keyMap[key] === gameButtonToAssign) delete keyMap[key]; });
        keyMap[newPressedKey] = gameButtonToAssign;
        if(newPressedKey.length === 1) keyMap[newPressedKey.toUpperCase()] = gameButtonToAssign;
        activeRemapButton.textContent = newPressedKey.replace('Arrow', '');
        activeRemapButton.classList.remove('listening');
        activeRemapButton.blur();
        activeRemapButton = null;
        return;
    }
    if (keyMap[event.key] !== undefined) {
        controllerState[keyMap[event.key]] = 1;
        event.preventDefault(); 
        if (currentSystem === 'GBA') passInputToGBA(keyMap[event.key], true);
    }
});

window.addEventListener('keyup', (event) => { 
    if (keyMap[event.key] !== undefined) {
        controllerState[keyMap[event.key]] = 0;
        if (currentSystem === 'GBA') passInputToGBA(keyMap[event.key], false);
    }
});

// ==========================================
// 6. HEARTBEAT FRAME LOOP (NES & GB ONLY)
// ==========================================
function emulateFrame() {
    if (!isPlaying) return;

    if (currentSystem === 'NES' && nes) {
        nes.controllers[1].state[jsnes.Controller.BUTTON_UP] = controllerState.Up;
        nes.controllers[1].state[jsnes.Controller.BUTTON_DOWN] = controllerState.Down;
        nes.controllers[1].state[jsnes.Controller.BUTTON_LEFT] = controllerState.Left;
        nes.controllers[1].state[jsnes.Controller.BUTTON_RIGHT] = controllerState.Right;
        nes.controllers[1].state[jsnes.Controller.BUTTON_A] = controllerState.A;
        nes.controllers[1].state[jsnes.Controller.BUTTON_B] = controllerState.B;
        nes.controllers[1].state[jsnes.Controller.BUTTON_START] = controllerState.Start;
        nes.controllers[1].state[jsnes.Controller.BUTTON_SELECT] = controllerState.Select;
        nes.frame();
    } else if (currentSystem === 'GB' && window.WasmBoy) {
        WasmBoy.setJoypadState({
            up: !!controllerState.Up, down: !!controllerState.Down,
            left: !!controllerState.Left, right: !!controllerState.Right,
            a: !!controllerState.A, b: !!controllerState.B,
            start: !!controllerState.Start, select: !!controllerState.Select
        });
    }

    if (currentSystem !== 'GBA') {
        animationFrameId = requestAnimationFrame(emulateFrame);
    }
}

// ==========================================
// 7. MAIN INTERFACE ACTION REGISTRATIONS
// ==========================================
btnPlay.addEventListener('click', async () => {
    if (!romBuffer) return;
    initAudio(); 

    if (!isPlaying) {
        isPlaying = true;
        
        if (currentSystem === 'NES' && nes) {
            if (!nes.rom) {
                const bytes = new Uint8Array(romBuffer);
                let romString = "";
                for (let i = 0; i < bytes.length; i++) romString += String.fromCharCode(bytes[i]);
                nes.loadROM(romString);
            }
            emulateFrame();
        } else if (currentSystem === 'GB' && window.WasmBoy) {
            await WasmBoy.loadROM(romBuffer);
            WasmBoy.play();
            WasmBoy.setCanvas(canvas);
            emulateFrame();
        } else if (currentSystem === 'GBA' && window.IodineGBA) {
            try {
                if (!gba) {
                    romName.textContent = "Booting Game Core...";
                    gba = new window.IodineGBA();
                    
                    // Route drawing context frames
                    gba.onVBlank = function(buffer) {
                        const imageData = ctx.createImageData(240, 160);
                        const data = imageData.data;
                        for (let i = 0; i < 240 * 160; i++) {
                            const pixel = buffer[i];
                            const index = i * 4;
                            data[index]     = (pixel >> 16) & 0xff;
                            data[index + 1] = (pixel >> 8) & 0xff;
                            data[index + 2] = pixel & 0xff;
                            data[index + 3] = 0xff;
                        }
                        ctx.putImageData(imageData, 0, 0);
                    };
                    
                    gba.setRom(new Uint8Array(romBuffer));
                }
                gba.play();
                romName.textContent = "GBA Game Running!";
            } catch (err) {
                isPlaying = false;
                alert(`GBA Boot Error: ${err.message}`);
            }
        }
        console.log(`${currentSystem} core active.`);
    }
});

btnPause.addEventListener('click', () => {
    isPlaying = false;
    if (currentSystem === 'GBA' && gba) {
        gba.pause();
    } else {
        cancelAnimationFrame(animationFrameId);
        if (currentSystem === 'GB' && window.WasmBoy) WasmBoy.pause();
    }
    console.log("Execution paused.");
});

btnReset.addEventListener('click', () => {
    if (currentSystem === 'NES' && nes && nes.rom) nes.reloadROM();
    if (currentSystem === 'GB' && window.WasmBoy) WasmBoy.reset();
    if (currentSystem === 'GBA' && gba) gba.restart();
});

// ==========================================
// 8. SAVE STATE EXPORTERS
// ==========================================
btnSave.addEventListener('click', async () => {
    if (!romBuffer) return;
    let stateString = "";
    
    if (currentSystem === 'NES' && nes) {
        stateString = JSON.stringify(nes.toJSON());
    } else if (currentSystem === 'GB' && window.WasmBoy) {
        const state = await WasmBoy.saveState();
        stateString = JSON.stringify(state);
    }

    const blob = new Blob([stateString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${romName.textContent.replace('Ready to Play: ', '').split('.')[0]}_${currentSystem}.sav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

btnLoad.addEventListener('click', () => { stateUpload.click(); });

stateUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const stateObject = JSON.parse(e.target.result);
            if (currentSystem === 'NES' && nes) nes.fromJSON(stateObject);
            if (currentSystem === 'GB' && window.WasmBoy) await WasmBoy.loadState(stateObject);
            if (!isPlaying) btnPlay.click();
        } catch (err) {
            alert("Invalid save state file.");
        }
    };
    reader.readAsText(file);
    stateUpload.value = '';
});

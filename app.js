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
let currentSystem = null; // Tracked as 'NES' or 'GB'

// ==========================================
// 2. AUDIO ENGINE SETUP (WEB AUDIO API)
// ==========================================
let audioCtx = null;
let audioBufferQueue = [];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Queue audio samples to prevent popping sounds
function playAudioSample(left, right) {
    if (!audioCtx || !isPlaying) return;
    // Basic structural audio node connection can be wired to buffer arrays here
}

// ==========================================
// 3. ROM FILE LOADER & SYSTEM DETECTOR
// ==========================================
romUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    romName.textContent = `Loaded: ${file.name}`;
    
    if (extension === 'nes') {
        currentSystem = 'NES';
        canvas.width = 256;
        canvas.height = 240;
        canvas.style.aspectRatio = "256 / 240";
    } else if (extension === 'gb' || extension === 'gbc') {
        currentSystem = 'GB';
        canvas.width = 160;
        canvas.height = 144;
        canvas.style.aspectRatio = "160 / 144";
    } else {
        alert("Unsupported console file type!");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        romBuffer = e.target.result;
        console.log(`${currentSystem} ROM loaded into memory. Ready to play.`);
        
        btnPlay.disabled = false;
        btnPause.disabled = false;
        btnReset.disabled = false;
        btnSave.disabled = false;
        btnLoad.disabled = false;
    };
    reader.readAsArrayBuffer(file);
});

// ==========================================
// 4. DYNAMIC CONTROLLER MAPPING LOGIC
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
    }
});

window.addEventListener('keyup', (event) => { if (keyMap[event.key] !== undefined) controllerState[keyMap[event.key]] = 0; });

// ==========================================
// 5. EMULATION ENGINES INTERFACES (NES & GAME BOY)
// ==========================================
let nes = new jsnes.NES({
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

// Initialize dynamic Game Boy system hook interface
if (window.WasmBoy) {
    WasmBoy.config({ autostart: false, audioBatchSize: 512 });
}

function emulateFrame() {
    if (!isPlaying) return;

    if (currentSystem === 'NES') {
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
        // Game Boy system updates input registers directly into WebAssembly state controllers
        WasmBoy.setJoypadState({
            up: !!controllerState.Up, down: !!controllerState.Down,
            left: !!controllerState.Left, right: !!controllerState.Right,
            a: !!controllerState.A, b: !!controllerState.B,
            start: !!controllerState.Start, select: !!controllerState.Select
        });
    }

    animationFrameId = requestAnimationFrame(emulateFrame);
}

// ==========================================
// 6. CONTROL MANAGEMENT ACTION REGISTRATIONS
// ==========================================
btnPlay.addEventListener('click', async () => {
    if (!romBuffer) return;
    initAudio(); // Activate browser sound outputs safely inside user click event

    if (!isPlaying) {
        isPlaying = true;
        
        if (currentSystem === 'NES') {
            if (!nes.rom) {
                const bytes = new Uint8Array(romBuffer);
                let romString = "";
                for (let i = 0; i < bytes.length; i++) romString += String.fromCharCode(bytes[i]);
                nes.loadROM(romString);
            }
            emulateFrame();
        } else if (currentSystem === 'GB') {
            // Drop raw array buffer right into the WebAssembly Game Boy Core
            await WasmBoy.loadROM(romBuffer);
            WasmBoy.play();
            // Canvas elements pass targeting control directly to the auto-rendering WasmBoy module
            WasmBoy.setCanvas(canvas);
            emulateFrame();
        }
        console.log(`${currentSystem} core execution deployed.`);
    }
});

btnPause.addEventListener('click', () => {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    if (currentSystem === 'GB') WasmBoy.pause();
    console.log("Execution suspended.");
});

btnReset.addEventListener('click', () => {
    if (currentSystem === 'NES' && nes.rom) nes.reloadROM();
    if (currentSystem === 'GB') WasmBoy.reset();
});

// ==========================================
// 7. MULTI-CORE FILE SAVE STATE MANAGERS
// ==========================================
btnSave.addEventListener('click', async () => {
    if (!romBuffer) return;
    let stateString = "";
    
    if (currentSystem === 'NES') {
        stateString = JSON.stringify(nes.toJSON());
    } else if (currentSystem === 'GB') {
        const state = await WasmBoy.saveState();
        stateString = JSON.stringify(state);
    }

    const blob = new Blob([stateString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${romName.textContent.replace('Loaded: ', '').split('.')[0]}_${currentSystem}.sav`;
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
            if (currentSystem === 'NES') nes.fromJSON(stateObject);
            if (currentSystem === 'GB') await WasmBoy.loadState(stateObject);
            if (!isPlaying) btnPlay.click();
        } catch (err) {
            alert("Incompatible state file configuration pattern detection error.");
        }
    };
    reader.readAsText(file);
    stateUpload.value = '';
});

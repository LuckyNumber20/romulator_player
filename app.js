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

// ==========================================
// 2. ROM FILE LOADER LOGIC
// ==========================================
romUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    romName.textContent = `Loaded: ${file.name}`;
    
    // Read the file as binary data
    const reader = new FileReader();
    reader.onload = function(e) {
        romBuffer = e.target.result; // Raw binary buffer
        console.log("ROM loaded successfully. Byte length:", romBuffer.byteLength);
        
        // Unlock user interface buttons now that a game is loaded
        btnPlay.disabled = false;
        btnPause.disabled = false;
        btnReset.disabled = false;
        btnSave.disabled = false;
        btnLoad.disabled = false;
    };
    
    reader.readAsArrayBuffer(file);
});

// ==========================================
// 3. DYNAMIC CONTROLLER MAPPING LOGIC
// ==========================================
const controllerState = { Up: 0, Down: 0, Left: 0, Right: 0, A: 0, B: 0, Start: 0, Select: 0 };

// Mapped keyboard keys (can be changed dynamically by user)
let keyMap = {
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'z': 'A', 'Z': 'A',
    'x': 'B', 'X': 'B',
    'Enter': 'Start',
    'Shift': 'Select'
};

// UI Elements for key mapping interface
const btnMap = document.getElementById('btn-map');
const mappingModal = document.getElementById('mapping-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const mappingList = document.getElementById('mapping-list');

let activeRemapButton = null; // Tracks which arcade button is currently listening for a rebind

// Open modal and render current configurations
btnMap.addEventListener('click', () => {
    mappingList.innerHTML = ''; 
    
    Object.keys(controllerState).forEach(gameButton => {
        const row = document.createElement('div');
        row.className = 'map-row';
        
        const currentKey = Object.keys(keyMap).find(key => keyMap[key] === gameButton) || 'None';
        
        row.innerHTML = `
            <span><strong>${gameButton}:</strong></span>
            <button data-button="${gameButton}">${currentKey.replace('Arrow', '')}</button>
        `;
        
        mappingList.appendChild(row);
    });
    
    mappingModal.classList.remove('hidden');
});

// Handle choosing a layout button inside the popup modal
mappingList.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        document.querySelectorAll('.map-row button').forEach(b => b.classList.remove('listening'));
        activeRemapButton = e.target;
        activeRemapButton.classList.add('listening');
        activeRemapButton.textContent = 'Press any key...';
    }
});

// Save and close configuration modal
btnCloseModal.addEventListener('click', () => {
    mappingModal.classList.add('hidden');
    activeRemapButton = null;
});

// ==========================================
// 4. KEYBOARD INTERCEPTORS (GAMEPLAY & REMAPPING)
// ==========================================
window.addEventListener('keydown', (event) => {
    // Check if user is actively setting up a custom shortcut key
    if (activeRemapButton) {
        event.preventDefault();
        const gameButtonToAssign = activeRemapButton.getAttribute('data-button');
        const newPressedKey = event.key;
        
        // Remove old structural entries mapping to this virtual execution action
        Object.keys(keyMap).forEach(key => {
            if (keyMap[key] === gameButtonToAssign) delete keyMap[key];
        });
        
        // Bind key layout
        keyMap[newPressedKey] = gameButtonToAssign;
        if(newPressedKey.length === 1) {
            keyMap[newPressedKey.toUpperCase()] = gameButtonToAssign;
        }
        
        activeRemapButton.textContent = newPressedKey.replace('Arrow', '');
        activeRemapButton.classList.remove('listening');
        activeRemapButton.blur();
        activeRemapButton = null;
        return;
    }

    // Capture standard in-game inputs
    if (keyMap[event.key] !== undefined) {
        const button = keyMap[event.key];
        controllerState[button] = 1;
        event.preventDefault(); 
    }
});

window.addEventListener('keyup', (event) => {
    if (keyMap[event.key] !== undefined) {
        const button = keyMap[event.key];
        controllerState[button] = 0;
    }
});

// ==========================================
// 5. NES EMULATOR ENGINE INTEGRATION (JSNES)
// ==========================================
let nes = new jsnes.NES({
    onFrame: function(buffer) {
        const imageData = ctx.getImageData(0, 0, 256, 240);
        const data = imageData.data;

        // Transform native NES video system output into browser engine graphics data (RGBA format)
        for (let i = 0; i < 256 * 240; i++) {
            const pixel = buffer[i];
            const r = (pixel >> 16) & 0xff;
            const g = (pixel >> 8) & 0xff;
            const b = pixel & 0xff;
            
            const index = i * 4;
            data[index]     = r;   
            data[index + 1] = g;   
            data[index + 2] = b;   
            data[index + 3] = 0xff; // Opacity 100%
        }
        ctx.putImageData(imageData, 0, 0);
    },
    onAudioSample: function(left, right) {
        // Audio hook interface room left blank for scaling upgrades
    }
});

// Heartbeat execution loop driving the canvas context animations
function emulateFrame() {
    if (!isPlaying) return;

    // Direct registration link maps control arrays right into the runtime memory buffer engine
    nes.controllers[1].state[jsnes.Controller.BUTTON_UP] = controllerState.Up;
    nes.controllers[1].state[jsnes.Controller.BUTTON_DOWN] = controllerState.Down;
    nes.controllers[1].state[jsnes.Controller.BUTTON_LEFT] = controllerState.Left;
    nes.controllers[1].state[jsnes.Controller.BUTTON_RIGHT] = controllerState.Right;
    nes.controllers[1].state[jsnes.Controller.BUTTON_A] = controllerState.A;
    nes.controllers[1].state[jsnes.Controller.BUTTON_B] = controllerState.B;
    nes.controllers[1].state[jsnes.Controller.BUTTON_START] = controllerState.Start;
    nes.controllers[1].state[jsnes.Controller.BUTTON_SELECT] = controllerState.Select;

    // Advance framework by 1 frame slice
    nes.frame();

    // Loop cycle request hook
    animationFrameId = requestAnimationFrame(emulateFrame);
}

// ==========================================
// 6. ACTION CONTROLS BUTTON REGISTRATION
// ==========================================
btnPlay.addEventListener('click', () => {
    if (!romBuffer) return;

    if (!isPlaying) {
        isPlaying = true;
        
        // Convert binary object array to raw string chunking patterns if starting clean
        if (!nes.rom) {
            const bytes = new Uint8Array(romBuffer);
            let romString = "";
            for (let i = 0; i < bytes.length; i++) {
                romString += String.fromCharCode(bytes[i]);
            }
            nes.loadROM(romString);
        }

        emulateFrame();
        console.log("NES Emulation engine running.");
    }
});

btnPause.addEventListener('click', () => {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    console.log("Emulation paused.");
});

btnReset.addEventListener('click', () => {
    if (nes.rom) {
        nes.reloadROM();
        console.log("NES System state refreshed.");
    }
});
// ==========================================
// 7. SAVE & LOAD STATE MANAGEMENT
// ==========================================

// Handle Exporting a Save State File (.sav)
btnSave.addEventListener('click', () => {
    if (!nes.rom) return;

    // 1. Get the current mathematical state of the NES emulator as a JSON object
    const stateObject = nes.toJSON();
    const stateString = JSON.stringify(stateObject);

    // 2. Convert the string into a downloadable blob file
    const blob = new Blob([stateString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // 3. Create a temporary invisible link to trigger a browser file download
    const a = document.createElement('a');
    a.href = url;
    a.download = `${romName.textContent.replace('Loaded: ', '').split('.')[0]}_save.sav`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up memory
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Save state exported successfully!");
});

// Trigger the hidden file input when clicking the visible "Load State" button
btnLoad.addEventListener('click', () => {
    stateUpload.click();
});

// Handle Importing a Save State File
stateUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // 1. Parse the text file back into a JSON structure
            const stateObject = JSON.parse(e.target.result);
            
            // 2. Inject the loaded memory structure back into the living NES engine
            nes.fromJSON(stateObject);
            console.log("Save state injected successfully! Resuming progress...");
            
            // 3. If paused, automatically resume execution
            if (!isPlaying) {
                btnPlay.click();
            }
        } catch (err) {
            alert("Failed to load save state. Make sure it's the correct file for this game!");
            console.error(err);
        }
    };
    reader.readAsText(file);
    
    // Clear value so the same file can be uploaded again if needed
    stateUpload.value = '';
});

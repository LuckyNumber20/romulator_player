// Grab HTML elements
const romUpload = document.getElementById('rom-upload');
const romName = document.getElementById('rom-name');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const canvas = document.getElementById('emulator-screen');
const ctx = canvas.getContext('2d');

let romBuffer = null;

// Handle file uploading
romUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    romName.textContent = `Loaded: ${file.name}`;
    
    // Read the file as binary data
    const reader = new FileReader();
    reader.onload = function(e) {
        romBuffer = e.target.result; // This is the raw ROM binary
        console.log("ROM loaded successfully into memory. Byte length:", romBuffer.byteLength);
        
        // Enable UI buttons since a game is loaded
        btnPlay.disabled = false;
        btnPause.disabled = false;
        btnReset.disabled = false;
    };
    
    reader.readAsArrayBuffer(file);
});

// Button Click Event Listeners
btnPlay.addEventListener('click', () => {
    console.log("Starting execution... (We will hook WebAssembly here next!)");
});

btnPause.addEventListener('click', () => {
    console.log("Game paused.");
});

btnReset.addEventListener('click', () => {
    console.log("Resetting system state.");
});
// --- CONTROLLER MAPPING LOGIC ---

// This object holds the live state of our virtual controller (0 = released, 1 = pressed)
// --- DYNAMIC CONTROLLER MAPPING LOGIC ---

const controllerState = { Up: 0, Down: 0, Left: 0, Right: 0, A: 0, B: 0, Start: 0, Select: 0 };

// We change this to 'let' so we can modify it when remapping keys
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

// UI Elements for mapping
const btnMap = document.getElementById('btn-map');
const mappingModal = document.getElementById('mapping-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const mappingList = document.getElementById('mapping-list');

let activeRemapButton = null; // Tracks which arcade button we are currently remapping

// Open and build the mapping list
btnMap.addEventListener('click', () => {
    mappingList.innerHTML = ''; // Clear previous entries
    
    // Create a row for each button in our controllerState
    Object.keys(controllerState).forEach(gameButton => {
        const row = document.createElement('div');
        row.className = 'map-row';
        
        // Find which keyboard key currently triggers this action
        const currentKey = Object.keys(keyMap).find(key => keyMap[key] === gameButton) || 'None';
        
        row.innerHTML = `
            <span><strong>${gameButton}:</strong></span>
            <button data-button="${gameButton}">${currentKey.replace('Arrow', '')}</button>
        `;
        
        mappingList.appendChild(row);
    });
    
    mappingModal.classList.remove('hidden');
});

// Handle clicking an assignment button inside the modal
mappingList.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        // Reset any other button that was listening
        document.querySelectorAll('.map-row button').forEach(b => b.classList.remove('listening'));
        
        activeRemapButton = e.target;
        activeRemapButton.classList.add('listening');
        activeRemapButton.textContent = 'Press any key...';
    }
});

// Close modal
btnCloseModal.addEventListener('click', () => {
    mappingModal.classList.add('hidden');
    activeRemapButton = null;
});

// Modify the window keydown listener to ALSO handle remapping keys
window.addEventListener('keydown', (event) => {
    // IF we are actively listening to remap a key:
    if (activeRemapButton) {
        event.preventDefault();
        const gameButtonToAssign = activeRemapButton.getAttribute('data-button');
        const newPressedKey = event.key;
        
        // Remove old key bindings that pointed to this game button
        Object.keys(keyMap).forEach(key => {
            if (keyMap[key] === gameButtonToAssign) delete keyMap[key];
        });
        
        // Map the new key to our game action
        keyMap[newPressedKey] = gameButtonToAssign;
        // Also support uppercase for letters automatically
        if(newPressedKey.length === 1) {
            keyMap[newPressedKey.toUpperCase()] = gameButtonToAssign;
        }
        
        // Update UI button text
        activeRemapButton.textContent = newPressedKey.replace('Arrow', '');
        activeRemapButton.classList.remove('listening');
        activeRemapButton.blur(); // Unfocus button
        activeRemapButton = null;
        return;
    }

    // NORMAL GAMEPLAY: Track active button presses
    if (keyMap[event.key] !== undefined) {
        const button = keyMap[event.key];
        controllerState[button] = 1;
        event.preventDefault(); 
        console.log(`Pressed: ${button}`, controllerState);
    }
});

window.addEventListener('keyup', (event) => {
    if (keyMap[event.key] !== undefined) {
        const button = keyMap[event.key];
        controllerState[button] = 0;
        console.log(`Released: ${button}`);
    }
});

// Map keyboard keys to our virtual controller buttons
const keyMap = {
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'z': 'A',
    'Z': 'A', // Handle caps lock
    'x': 'B',
    'X': 'B',
    'Enter': 'Start',
    'Shift': 'Select'
};

// Listen for when a key is pressed down
window.addEventListener('keydown', (event) => {
    if (keyMap[event.key] !== undefined) {
        const button = keyMap[event.key];
        controllerState[button] = 1; // Mark button as pressed
        
        // Prevent the browser from scrolling down when pressing the Arrow Keys or Space
        event.preventDefault(); 
        
        console.log(`Pressed: ${button}`, controllerState);
    }
});

// Listen for when a key is released
window.addEventListener('keyup', (event) => {
    if (keyMap[event.key] !== undefined) {
        const button = keyMap[event.key];
        controllerState[button] = 0; // Mark button as released
        
        console.log(`Released: ${button}`);
    }
});

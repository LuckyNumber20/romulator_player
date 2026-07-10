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
const controllerState = {
    Up: 0,
    Down: 0,
    Left: 0,
    Right: 0,
    A: 0,
    B: 0,
    Start: 0,
    Select: 0
};

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

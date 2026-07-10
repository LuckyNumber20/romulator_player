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

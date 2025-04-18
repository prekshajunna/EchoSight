let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let model;
let isDetecting = false;
let lastSpokenObject = ""; // Track last announced object
let alertSound = new Audio('nuclear-alarm-14008.mp3'); // Add an alert sound file

// Load AI Model
async function loadModel() {
    model = await cocoSsd.load();
    console.log("COCO-SSD Model Loaded!");
}

// Access Rear Camera
async function setupCamera() {
    try {
        let stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" } } // Rear camera
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing camera: ", err);
        alert("Camera access denied or not available.");
    }
}

// Estimate Distance
function estimateDistance(bboxWidth) {
    let referenceWidth = 200; // Adjust based on calibration
    let knownDistance = 2; // 2 meters for reference width

    let estimatedDistance = (referenceWidth / bboxWidth) * knownDistance;
    return estimatedDistance.toFixed(2);
}

// Object Detection
async function detectObjects() {
    if (!isDetecting) return; // Stop detection when paused

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    let predictions = await model.detect(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (predictions.length === 0) {
        lastSpokenObject = ""; // Reset if no objects detected
        return;
    }

    let detectedObject = predictions[0].class; // Get first detected object
    let [x, y, width, height] = predictions[0].bbox;
    let distance = estimateDistance(width);

    // Draw bounding box
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'red';
    ctx.fillText(`${detectedObject} (${distance}m)`, x, y - 5);

    // Determine object direction
    let position = x + width / 2;
    let screenCenter = canvas.width / 2;
    let direction = position < screenCenter ? "on your left" : "on your right";

    // Speak only if object changes
    if (detectedObject !== lastSpokenObject) {
        window.speechSynthesis.cancel(); // Stop previous speech
        speak(`${detectedObject} is ${direction} and about ${distance} meters away`);
        lastSpokenObject = detectedObject;
    }

    // Vibration Alert if the object is too close (< 1 meter)
    if (distance < 1) {
        if (navigator.vibrate) {
            navigator.vibrate([300, 100, 300]); // Vibrate pattern
        }
    }

    // Sound Alert if object is very close (< 0.5 meters)
    if (distance < 1) {
        alertSound.play();
    }

    requestAnimationFrame(detectObjects);
}

// Speak Object, Distance, and Direction
function speak(text) {
    let speech = new SpeechSynthesisUtterance(text);
    speech.rate = 1;
    speech.pitch = 1;
    window.speechSynthesis.speak(speech);
}

// Voice Commands (Start/Stop Detection)
function startVoiceRecognition() {
    let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.lang = "en-US";

    recognition.onresult = function (event) {
        let command = event.results[event.results.length - 1][0].transcript.toLowerCase();
        console.log("Voice Command: ", command);

        if (command.includes("start")) {
            isDetecting = true;
            detectObjects();
            speak("Starting object detection");
        } else if (command.includes("stop")) {
            isDetecting = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            window.speechSynthesis.cancel();
            speak("Stopping object detection");
        }
    };

    recognition.start();
}

// Start Detection
document.getElementById('startBtn').addEventListener('click', () => {
    isDetecting = true;
    detectObjects();
});

// Stop Detection
document.getElementById('stopBtn').addEventListener('click', () => {
    isDetecting = false;
    lastSpokenObject = ""; // Reset when stopping
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    window.speechSynthesis.cancel(); // Stop speech
});

// Initialize App
setupCamera();
loadModel();
startVoiceRecognition();
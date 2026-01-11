const { spawn } = require('child_process');

function startNgrok() {
    console.log("Starting ngrok...");

    const ngrokPath = "C:\\Users\\ardak\\AppData\\Roaming\\npm\\node_modules\\ngrok\\bin\\ngrok.exe";

    const ngrok = spawn(ngrokPath, [
        "http",
        "8080",
        "--domain=crack-aware-stud.ngrok-free.app"
    ]);

    ngrok.stdout.on("data", data => console.log("[NGROK]", data.toString()));
    ngrok.stderr.on("data", data => console.log("[NGROK ERROR]", data.toString()));
    ngrok.on("close", code => console.log("[NGROK CLOSED]", code));
}

module.exports = startNgrok;

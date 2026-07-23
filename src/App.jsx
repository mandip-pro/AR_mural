import React, { useState } from "react";
import "./App.css";
import MindARViewer from "./mindar-viewer.jsx";

function App() {
  const [started, setStarted] = useState(null);
  const stopCamera = () => {
    setStarted(null);
  };

  return (
    <main className="App">
      {started === null ? (
        <section className="start-screen" aria-labelledby="app-title">
          <div className="start-content">
            <p className="eyebrow">AR Mural</p>
            <h1 id="app-title">Open the camera and point at the mural.</h1>
            <p className="start-copy">
              Keep the target inside the frame to play the video.
            </p>
            <button
              className="primary-action"
              onClick={() => {
                setStarted("aframe");
              }}
            >
              Start Camera
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="container">
            <MindARViewer />
          </div>
          <div className="camera-controls">
            <button
              className="stop-button"
              onClick={stopCamera}
              onTouchEnd={(event) => {
                event.preventDefault();
                stopCamera();
              }}
              aria-label="Stop camera"
            >
              Stop
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default App;

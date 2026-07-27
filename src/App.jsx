import React, { useEffect, useState } from "react";
import "./App.css";
import { fallbackData, fetchARProject } from "./api.js";
import MindARViewer from "./mindar-viewer.jsx";

function App() {
  const [started, setStarted] = useState(null);
  const [arData, setArData] = useState(fallbackData);
  const [dataStatus, setDataStatus] = useState("loading");

  useEffect(() => {
    let ignore = false;

    fetchARProject()
      .then((projectData) => {
        if (!ignore) {
          setArData(projectData);
          setDataStatus("ready");
        }
      })
      .catch((error) => {
        console.warn("Using local AR data fallback:", error);
        if (!ignore) {
          setArData(fallbackData);
          setDataStatus("fallback");
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

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
            {dataStatus === "loading" && (
              <p className="data-status">Loading mural data...</p>
            )}
            {dataStatus === "fallback" && (
              <p className="data-status">Using saved demo data.</p>
            )}
            <button
              className="primary-action"
              onClick={() => {
                setStarted("aframe");
              }}
              disabled={dataStatus === "loading"}
            >
              Start Camera
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="container">
            <MindARViewer data={arData} />
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

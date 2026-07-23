import React, { useState } from "react";
import "./App.css";
import MindARViewer from "./mindar-viewer.jsx";
import MindARThreeViewer from "./mindar-three-viewer.jsx";

function App() {
  const [started, setStarted] = useState(null);

  return (
    <div className="App">
      <div className="control-buttons">
        {started === null && (
          <button
            onClick={() => {
              setStarted("aframe");
            }}
          >
            Start AFRAME version
          </button>
        )}
        {/* {started === null && (
          <button
            onClick={() => {
              setStarted("three");
            }}
          >
            Start ThreeJS version
          </button>
        )} */}
        {started !== null && (
          <button
            onClick={() => {
              setStarted(null);
            }}
          >
            Stop
          </button>
        )}
      </div>

      {started === "aframe" && (
        <div className="container">
          <MindARViewer />
        </div>
      )}

      {/* {started === "three" && (
        <div className="container">
          <MindARThreeViewer />
        </div>
      )} */}
    </div>
  );
}

export default App;

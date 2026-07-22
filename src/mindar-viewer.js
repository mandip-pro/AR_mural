// import React, { useEffect, useRef } from "react";
// import "aframe";
// import "mind-ar/dist/mindar-image-aframe.prod.js";

// const MindARViewer = () => {
//   const sceneRef = useRef(null);

//   useEffect(() => {
//     const sceneEl = sceneRef.current;
//     const arSystem = sceneEl.systems["mindar-image-system"];
//     sceneEl.addEventListener("renderstart", () => {
//       arSystem.start(); // start AR
//     });
//     return () => {
//       arSystem.stop();
//     };
//   }, []);

//   return (
//     <a-scene
//       ref={sceneRef}
//       mindar-image="imageTargetSrc: /targets.mind; autoStart: false; uiLoading: no; uiError: no; uiScanning: no;"
//       color-space="sRGB"
//       embedded
//       renderer="colorManagement: true, physicallyCorrectLights"
//       vr-mode-ui="enabled: false"
//       device-orientation-permission-ui="enabled: false"
//     >
//       <a-assets>
//         {/* <img id="card" src="/model.png" alt="card" />
//          */}
//         <video
//           id="card"
//           src="/demo_video.mp4"
//           preload="auto"
//           controls
//           playsinline
//           webkit-playsinline
//           crossorigin="anonymous"
//         ></video>

//         {/* <a-asset-item
//           id="avatarModel"
//           src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.0/examples/image-tracking/assets/card-example/softmind/scene.gltf"
//         ></a-asset-item> */}
//       </a-assets>

//       <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

//       <a-entity mindar-image-target="targetIndex: 0">
//         <a-plane
//           src="#card"
//           position="0 0 0"
//           height="0.552"
//           width="1"
//           rotation="0 0 0"
//         ></a-plane>
//         <a-gltf-model
//           rotation="0 0 0 "
//           position="0 0 0.1"
//           scale="0.005 0.005 0.005"
//           src="#avatarModel"
//           animation="property: position; to: 0 0.1 0.1; dur: 1000; easing: easeInOutQuad; loop: true; dir: alternate"
//         ></a-gltf-model>
//       </a-entity>
//     </a-scene>
//   );
// };
// export default MindARViewer;

import React, { useEffect, useRef } from "react";
import "aframe";
import "mind-ar/dist/mindar-image-aframe.prod.js";

export default function MindARViewer() {
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    let arStarted = false;

    const onRenderStart = () => {
      const arSystem = scene?.systems["mindar-image-system"];
      if (!arSystem) return;

      arStarted = true;
      arSystem.start();

      const video = document.querySelector("#video");
      const target = document.querySelector("#target");

      // Prevent autoplay
      if (video) {
        video.pause();
        video.currentTime = 0;
      }

      target?.addEventListener("targetFound", async () => {
        try {
          if (video) {
            video.currentTime = 0;
            await video.play();
          }
        } catch (e) {
          console.error(e);
        }
      });

      target?.addEventListener("targetLost", () => {
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
      });
    };

    scene?.addEventListener("renderstart", onRenderStart);

    return () => {
      scene?.removeEventListener("renderstart", onRenderStart);
      if (arStarted && scene) {
        try {
          scene.systems["mindar-image-system"]?.stop();
        } catch (e) {
          console.warn("MindAR AFRAME stop error (safe to ignore):", e);
        }
      }
    };
  }, []);

  return (
    <a-scene
      ref={sceneRef}
      embedded
      color-space="sRGB"
      renderer="colorManagement: true; physicallyCorrectLights: true"
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
      mindar-image="
        imageTargetSrc: /targets.mind;
        autoStart: false;
        uiLoading: yes;
        uiScanning: yes;
        uiError: yes;
        filterMinCF: 0.0001;
        filterBeta: 0.01;
      "
    >
      <a-assets>
        <video
          id="video"
          src="/demo_video.mp4"
          preload="auto"
          // muted
          playsInline
          webkit-playsinline="true"
          crossorigin="anonymous"
        />
      </a-assets>

      <a-camera position="0 0 0" look-controls="enabled:false" />

      <a-entity id="target" mindar-image-target="targetIndex: 0">
        <a-video src="#video" width="1" height="0.5625" position="0 0 0.02" />
      </a-entity>
    </a-scene>
  );
}

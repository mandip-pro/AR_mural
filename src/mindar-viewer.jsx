import { useEffect, useRef } from "react";
import "aframe";
import "mind-ar/dist/mindar-image-aframe.prod.js";

import dummyData from "./Constants/data.js";

const MindARViewer = () => {
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    let arStarted = false;

    const onRenderStart = () => {
      const arSystem = scene?.systems["mindar-image-system"];
      if (!arSystem) return;

      arStarted = true;
      arSystem.start();

      // Set up per-target event listeners
      dummyData.targets.forEach((target) => {
        const targetEl = document.querySelector(
          `#target-${target.targetIndex}`,
        );
        const video = document.querySelector(`#video-${target.targetIndex}`);

        // Prevent autoplay
        if (video) {
          video.pause();
          video.currentTime = 0;
        }

        targetEl?.addEventListener("targetFound", async () => {
          try {
            if (video) {
              video.currentTime = 0;
              await video.play();
            }
          } catch (e) {
            console.error(e);
          }
        });

        targetEl?.addEventListener("targetLost", () => {
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
        });
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
      document.querySelectorAll(".mindar-ui-overlay").forEach((overlay) => {
        overlay.remove();
      });
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
      mindar-image={`
        imageTargetSrc: ${dummyData.mindFile};
        autoStart: false;
        uiLoading: yes;
        uiScanning: yes;
        uiError: yes;
        filterMinCF: 0.0001;
        filterBeta: 0.01;
      `}
    >
      <a-assets>
        {dummyData.targets.map((target) => (
          <video
            key={target.targetIndex}
            id={`video-${target.targetIndex}`}
            src={target.video}
            preload="auto"
            // muted
            playsInline
            webkit-playsinline="true"
            crossorigin="anonymous"
          />
        ))}

        {/* <a-asset-item id="avatarModel" src="/goal.glb" /> */}
      </a-assets>

      <a-camera position="0 0 0" look-controls="enabled:false" />

      {dummyData.targets.map((target) => (
        <a-entity
          key={target.targetIndex}
          id={`target-${target.targetIndex}`}
          mindar-image-target={`targetIndex: ${target.targetIndex}`}
        >
          <a-video
            src={`#video-${target.targetIndex}`}
            width="1"
            height="0.5625"
            position="0 0 0.02"
          />
          {/* <a-gltf-model
          rotation="0 0 0 "
          position="0 0 0.3"
          scale="0.5 0.5 0.5"
          src="#avatarModel"
          //   animation="property: position; to: 0 0.1 0.1; dur: 1000; easing: easeInOutQuad; loop: true; dir: alternate"
        ></a-gltf-model> */}
        </a-entity>
      ))}
    </a-scene>
  );
};
export default MindARViewer;

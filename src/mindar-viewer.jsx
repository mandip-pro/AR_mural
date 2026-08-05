import { useEffect, useRef, useState, useCallback } from "react";
import "aframe";
import "mind-ar/dist/mindar-image-aframe.prod.js";

import dummyData from "./Constants/data.js";
import rewind from "./assets/icons/rewind.svg";
import cancel from "./assets/icons/cancel.svg";
import play from "./assets/icons/play.svg";
import pause from "./assets/icons/pause.svg";

const MindARViewer = () => {
  const sceneRef = useRef(null);
  const arSystemRef = useRef(null);
  const videoEntityRefs = useRef({});
  const videoElRefs = useRef({});

  const zoomWrapperRef = useRef(null);

  const [activeTarget, setActiveTarget] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const getBaseGeometry = (target) => {
    const arWidth = target.arWidth || 1;
    const arHeight =
      target.arHeight ||
      (target.imageWidth && target.imageHeight
        ? arWidth * (target.imageHeight / target.imageWidth)
        : arWidth * 0.5625);
    return { arWidth, arHeight };
  };

  // ---- AR setup ----
  useEffect(() => {
    const scene = sceneRef.current;
    let arStarted = false;

    const onRenderStart = () => {
      const arSystem = scene?.systems["mindar-image-system"];
      if (!arSystem) return;
      arSystemRef.current = arSystem;

      arStarted = true;
      arSystem.start();

      dummyData.targets.forEach((target) => {
        const targetEl = document.querySelector(
          `#target-${target.targetIndex}`,
        );
        const video = document.querySelector(`#video-${target.targetIndex}`);
        const videoEntity = document.querySelector(
          `#video-entity-${target.targetIndex}`,
        );

        videoElRefs.current[target.targetIndex] = video;
        videoEntityRefs.current[target.targetIndex] = videoEntity;

        if (video) {
          video.pause();
          video.currentTime = 0;
        }
        // Hidden until found, so no stray frame is visible beforehand
        videoEntity?.setAttribute("visible", "false");

        targetEl?.addEventListener("targetFound", async () => {
          setActiveTarget(target.targetIndex);
          setZoom(1);
          setPan({ x: 0, y: 0 });

          videoEntity?.setAttribute("visible", "true");

          try {
            if (video) {
              video.currentTime = 0;
              await video.play();
              setIsPlaying(true);
            }
          } catch (e) {
            console.error(e);
          }
          try {
            arSystemRef.current?.pause(true);
          } catch (e) {
            console.warn("MindAR pause error:", e);
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
      document
        .querySelectorAll(".mindar-ui-overlay")
        .forEach((overlay) => overlay.remove());
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (activeTarget === null) return;
    const video = videoElRefs.current[activeTarget];
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [activeTarget]);

  const skip = useCallback(
    async (seconds) => {
      if (activeTarget === null) return;
      const video = videoElRefs.current[activeTarget];
      if (!video || !video.duration || !isFinite(video.duration)) return;

      const shouldResume = !video.paused && !video.ended;
      video.currentTime = Math.min(
        Math.max(video.currentTime + seconds, 0),
        video.duration,
      );

      if (shouldResume) {
        try {
          await video.play();
          setIsPlaying(true);
        } catch (e) {
          console.error(e);
          setIsPlaying(false);
        }
      }
    },
    [activeTarget],
  );

  const clampPan = useCallback((x, y, currentZoom) => {
    const el = zoomWrapperRef.current;
    const width = el?.clientWidth || window.innerWidth;
    const height = el?.clientHeight || window.innerHeight;
    const maxX = (width * (currentZoom - 1)) / 2;
    const maxY = (height * (currentZoom - 1)) / 2;
    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY),
    };
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const next = Math.min(z + 0.25, 3);
      setPan((p) => clampPan(p.x, p.y, next));
      return next;
    });
  }, [clampPan]);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(z - 0.25, 1);
      setPan((p) => clampPan(p.x, p.y, next));
      return next;
    });
  }, [clampPan]);

  const handlePointerDown = useCallback(
    (e) => {
      if (zoom <= 1 || activeTarget === null) return;
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...pan };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [zoom, pan, activeTarget],
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const next = clampPan(
        panStartRef.current.x + dx,
        panStartRef.current.y + dy,
        zoom,
      );
      setPan(next);
    },
    [clampPan, zoom],
  );

  const handlePointerUp = useCallback((e) => {
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  // ---- Close ----
  const handleClose = useCallback(() => {
    if (activeTarget !== null) {
      const video = videoElRefs.current[activeTarget];
      const entity = videoEntityRefs.current[activeTarget];
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      entity?.setAttribute("visible", "false"); // hide so no stuck frame shows
    }

    setActiveTarget(null);
    setIsPlaying(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    // Resume camera + tracking so a new target can be found
    try {
      arSystemRef.current?.unpause();
    } catch (e) {
      console.warn("MindAR unpause error:", e);
    }
  }, [activeTarget]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={zoomWrapperRef}
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
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
                playsInline
                webkit-playsinline="true"
                crossorigin="anonymous"
              />
            ))}
          </a-assets>

          <a-camera position="0 0 0" look-controls="enabled:false" />

          {dummyData.targets.map((target) => {
            const { arWidth, arHeight } = getBaseGeometry(target);
            return (
              <a-entity
                key={target.targetIndex}
                id={`target-${target.targetIndex}`}
                mindar-image-target={`targetIndex: ${target.targetIndex}`}
              >
                <a-video
                  id={`video-entity-${target.targetIndex}`}
                  src={`#video-${target.targetIndex}`}
                  width={arWidth}
                  height={arHeight}
                  position="0 0 0.02"
                  visible="false"
                />
              </a-entity>
            );
          })}
        </a-scene>
      </div>

      {activeTarget !== null && (
        <>
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              touchAction: "none",
              cursor: zoom > 1 ? "grab" : "default",
              background: "transparent",
            }}
          />

          <div
            style={{
              position: "fixed",
              left: "50%",
              bottom: 24,
              transform: "translateX(-50%)",
              zIndex: 101,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(4px)",
            }}
          >
            <button
              onClick={() => skip(-10)}
              style={btnStyle}
              aria-label="Rewind 10s"
            >
              <img
                src={rewind}
                alt="Rewind 10s"
                style={{ width: 16, height: 16 }}
              />
            </button>
            <button
              onClick={togglePlay}
              style={btnStyle}
              aria-label="Play/Pause"
            >
              {isPlaying ? "+" : "▶️"}
            </button>
            <button
              onClick={() => skip(10)}
              style={btnStyle}
              aria-label="Forward 10s"
            >
              <img
                src={rewind}
                alt="Forward 10s"
                style={{ width: 16, height: 16, transform: "rotate(180deg)" }}
              />
            </button>
            <button onClick={zoomOut} style={btnStyle} aria-label="Zoom out">
              −
            </button>
            <button onClick={zoomIn} style={btnStyle} aria-label="Zoom in">
              +
            </button>
            <button
              onClick={handleClose}
              style={{ ...btnStyle, background: "rgba(255,80,80,0.85)" }}
              aria-label="Close"
            >
              <img src={cancel} alt="Close" style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const btnStyle = {
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 14,
};

export default MindARViewer;

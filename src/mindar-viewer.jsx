import { useEffect, useRef, useState, useCallback } from "react";
import "aframe";
import "mind-ar/dist/mindar-image-aframe.prod.js";
import Hls from "hls.js";

import muralData from "./Constants/data.js";
import rewind from "./assets/icons/rewind.svg";
import cancel from "./assets/icons/cancel.svg";
import play from "./assets/icons/play.svg";
import pause from "./assets/icons/pause.svg";

const MindARViewer = () => {
  const sceneRef = useRef(null);
  const arSystemRef = useRef(null);
  const videoEntityRefs = useRef({});
  const videoElRefs = useRef({});

  const transformsRef = useRef({});

  const focusedTargetRef = useRef(null);
  const trackedTargetsRef = useRef(new Set());

  const [focusedTarget, setFocusedTarget] = useState(null);
  const [trackedTargets, setTrackedTargets] = useState(() => new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const isFocusedTracked =
    focusedTarget !== null && trackedTargets.has(focusedTarget);

  const isDetached = focusedTarget !== null && !isFocusedTracked;

  useEffect(() => {
    const players = [];
    const hlsVideos = [];

    muralData.targets.forEach((target) => {
      if (!target.video.endsWith(".m3u8")) return;
      const video = videoElRefs.current[target.targetIndex];
      if (!video) return;
      hlsVideos.push(video);

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = target.video;
      } else if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(target.video);
        hls.attachMedia(video);
        players.push(hls);
      } else {
        console.error("HLS playback is not supported by this browser.");
      }
    });

    return () => {
      players.forEach((hls) => hls.destroy());
      hlsVideos.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
    };
  }, []);

  useEffect(() => {
    focusedTargetRef.current = focusedTarget;
  }, [focusedTarget]);

  useEffect(() => {
    trackedTargetsRef.current = trackedTargets;
  }, [trackedTargets]);

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

  const resetEntityTransform = (targetIndex, z, p) => {
    const entity = videoEntityRefs.current[targetIndex];
    if (!entity) return;
    entity.setAttribute("scale", `${z} ${z} 1`);
    entity.setAttribute("position", `${p.x} ${p.y} 0.02`);
  };

  //AR setup
  useEffect(() => {
    const scene = sceneRef.current;
    let arStarted = false;

    const onRenderStart = () => {
      const arSystem = scene?.systems["mindar-image-system"];
      if (!arSystem) return;
      arSystemRef.current = arSystem;

      arStarted = true;
      arSystem.start();

      muralData.targets.forEach((target) => {
        const idx = target.targetIndex;
        const targetEl = document.querySelector(`#target-${idx}`);
        const videoEntity = document.querySelector(`#video-entity-${idx}`);
        const video = videoElRefs.current[idx];

        videoEntityRefs.current[idx] = videoEntity;
        videoEntity?.setAttribute("visible", "false");

        video?.addEventListener("play", () => {
          if (focusedTargetRef.current === idx) setIsPlaying(true);
        });
        video?.addEventListener("pause", () => {
          if (focusedTargetRef.current === idx) setIsPlaying(false);
        });
        video?.addEventListener("ended", () => {
          if (focusedTargetRef.current === idx) setIsPlaying(false);
        });

        targetEl?.addEventListener("targetFound", async () => {
          setTrackedTargets((prev) => new Set(prev).add(idx));
          videoEntity?.setAttribute("visible", "true");

          if (focusedTargetRef.current !== idx) {
            transformsRef.current[idx] = { zoom: 1, pan: { x: 0, y: 0 } };
            setFocusedTarget(idx);
            setZoom(1);
            setPan({ x: 0, y: 0 });
            resetEntityTransform(idx, 1, { x: 0, y: 0 });
          } else {
            const saved = transformsRef.current[idx] || {
              zoom: 1,
              pan: { x: 0, y: 0 },
            };
            setZoom(saved.zoom);
            setPan(saved.pan);
            resetEntityTransform(idx, saved.zoom, saved.pan);
          }

          const el = videoElRefs.current[idx];
          if (el && el.paused) {
            try {
              await el.play();
            } catch (e) {
              console.error(e);
            }
          }

          if (el) {
            setIsPlaying(!el.paused && !el.ended);
          }
        });

        targetEl?.addEventListener("targetLost", () => {
          setTrackedTargets((prev) => {
            const next = new Set(prev);
            next.delete(idx);
            return next;
          });

          videoEntity?.setAttribute("visible", "false");
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
    if (focusedTarget === null) return;
    const video = videoElRefs.current[focusedTarget];
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, [focusedTarget]);

  const skip = useCallback(
    async (seconds) => {
      if (focusedTarget === null) return;
      const video = videoElRefs.current[focusedTarget];
      if (!video || !video.duration || !isFinite(video.duration)) return;

      const shouldResume = !video.paused && !video.ended;
      video.currentTime = Math.min(
        Math.max(video.currentTime + seconds, 0),
        video.duration,
      );

      if (shouldResume) {
        try {
          await video.play();
        } catch (e) {
          console.error(e);
        }
      }
    },
    [focusedTarget],
  );

  const clampPan = useCallback(
    (x, y, currentZoom) => {
      if (focusedTarget === null) return { x: 0, y: 0 };
      const target = muralData.targets.find(
        (t) => t.targetIndex === focusedTarget,
      );
      if (!target) return { x: 0, y: 0 };
      const { arWidth, arHeight } = getBaseGeometry(target);
      const maxX = (arWidth * (currentZoom - 1)) / 2;
      const maxY = (arHeight * (currentZoom - 1)) / 2;
      return {
        x: Math.min(Math.max(x, -maxX), maxX),
        y: Math.min(Math.max(y, -maxY), maxY),
      };
    },
    [focusedTarget],
  );

  const applyAndRemember = useCallback(
    (z, p) => {
      if (focusedTarget === null) return;
      transformsRef.current[focusedTarget] = { zoom: z, pan: p };
      resetEntityTransform(focusedTarget, z, p);
    },
    [focusedTarget],
  );

  const zoomIn = useCallback(() => {
    if (!isFocusedTracked) return;
    setZoom((z) => {
      const next = Math.min(z + 0.25, 3);
      setPan((p) => {
        const clamped = clampPan(p.x, p.y, next);
        applyAndRemember(next, clamped);
        return clamped;
      });
      return next;
    });
  }, [clampPan, applyAndRemember, isFocusedTracked]);

  const zoomOut = useCallback(() => {
    if (!isFocusedTracked) return;
    setZoom((z) => {
      const next = Math.max(z - 0.25, 1);
      setPan((p) => {
        const clamped = clampPan(p.x, p.y, next);
        applyAndRemember(next, clamped);
        return clamped;
      });
      return next;
    });
  }, [clampPan, applyAndRemember, isFocusedTracked]);

  const DRAG_TO_WORLD = 0.003;

  const handlePointerDown = useCallback(
    (e) => {
      if (zoom <= 1 || !isFocusedTracked) return;
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...pan };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [zoom, pan, isFocusedTracked],
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDraggingRef.current) return;
      const dx = (e.clientX - dragStartRef.current.x) * DRAG_TO_WORLD;
      const dy = -(e.clientY - dragStartRef.current.y) * DRAG_TO_WORLD;
      const next = clampPan(
        panStartRef.current.x + dx,
        panStartRef.current.y + dy,
        zoom,
      );
      setPan(next);
      applyAndRemember(zoom, next);
    },
    [clampPan, applyAndRemember, zoom],
  );

  const handlePointerUp = useCallback((e) => {
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  // ---- Close ----
  const handleClose = useCallback(() => {
    if (focusedTarget !== null) {
      const video = videoElRefs.current[focusedTarget];
      const entity = videoEntityRefs.current[focusedTarget];
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      entity?.setAttribute("visible", "false");
      delete transformsRef.current[focusedTarget];
    }

    focusedTargetRef.current = null;
    setFocusedTarget(null);
    setIsPlaying(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [focusedTarget]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <a-scene
        ref={sceneRef}
        embedded
        color-space="sRGB"
        renderer="colorManagement: true; physicallyCorrectLights: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        mindar-image={`
          imageTargetSrc: ${muralData.mindFile};
          autoStart: false;
          uiLoading: yes;
          uiScanning: no;
          uiError: yes;
          filterMinCF: 0.0001;
          filterBeta: 0.01;
        `}
      >
        <a-camera position="0 0 0" look-controls="enabled:false" />

        {muralData.targets.map((target) => {
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

      {muralData.targets.map((target) => {
        const idx = target.targetIndex;
        const isThisDetachedOverlay = focusedTarget === idx && isDetached;
        const video = videoElRefs.current[idx];
        const { arWidth, arHeight } = getBaseGeometry(target);
        const aspectRatio =
          video?.videoWidth && video?.videoHeight
            ? video.videoWidth / video.videoHeight
            : arWidth / arHeight;

        return (
          <video
            key={idx}
            id={`video-${idx}`}
            ref={(el) => {
              videoElRefs.current[idx] = el;
            }}
            src={target.video.endsWith(".m3u8") ? undefined : target.video}
            muted={target.video.endsWith(".m3u8")}
            preload="auto"
            playsInline
            webkit-playsinline="true"
            crossOrigin="anonymous"
            onClick={isThisDetachedOverlay ? togglePlay : undefined}
            className={isThisDetachedOverlay ? "detached-video" : undefined}
            style={
              isThisDetachedOverlay
                ? {
                    "--video-aspect": aspectRatio,
                    aspectRatio,
                  }
                : {
                    position: "fixed",
                    top: -9999,
                    left: -9999,
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none",
                  }
            }
          />
        );
      })}

      {isFocusedTracked && zoom > 1 && (
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
            cursor: "grab",
            background: "transparent",
          }}
        />
      )}

      {focusedTarget !== null && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            zIndex: 1000,
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
          <button onClick={togglePlay} style={btnStyle} aria-label="Play/Pause">
            {isPlaying ? (
              <img src={pause} style={{ width: 16, height: 16 }} />
            ) : (
              <img src={play} style={{ width: 16, height: 16 }} />
            )}
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
          <button
            onClick={zoomOut}
            style={{
              ...btnStyle,
              opacity: isFocusedTracked ? 1 : 0.4,
              cursor: isFocusedTracked ? "pointer" : "not-allowed",
            }}
            disabled={!isFocusedTracked}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={zoomIn}
            style={{
              ...btnStyle,
              opacity: isFocusedTracked ? 1 : 0.4,
              cursor: isFocusedTracked ? "pointer" : "not-allowed",
            }}
            disabled={!isFocusedTracked}
            aria-label="Zoom in"
          >
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

import { useEffect, useRef, useState, useCallback } from "react";
import "aframe";
import "mind-ar/dist/mindar-image-aframe.prod.js";

import dummyData from "./Constants/data.js";
import rewind from "./assets/icons/rewind.svg";

const MindARViewer = () => {
  const sceneRef = useRef(null);
  const arSystemRef = useRef(null);
  const videoEntityRefs = useRef({}); // targetIndex -> <a-video> DOM element
  const videoElRefs = useRef({}); // targetIndex -> underlying <video> DOM element

  const [activeTarget, setActiveTarget] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // ---- Orientation tracking ----
  // We track the actual screen rotation angle (0/90/180/270) rather than
  // just a portrait/landscape boolean, because the sign/axis-swap needed
  // for drag->pan mapping depends on *which* landscape orientation the
  // device is in (rotated left vs rotated right), and that differs between
  // "landscape-primary" and "landscape-secondary".
  const getOrientationAngle = () => {
    if (typeof window === "undefined") return 0;
    // Prefer the modern Screen Orientation API (best support: Android/Chrome,
    // desktop browsers). iOS Safari has partial/inconsistent support for
    // screen.orientation, so we fall back to the deprecated
    // window.orientation, and finally to a size-based guess.
    if (window.screen && window.screen.orientation) {
      const angle = window.screen.orientation.angle;
      if (typeof angle === "number") return angle;
    }
    if (typeof window.orientation === "number") {
      // window.orientation uses the same 0/90/-90/180 convention on iOS.
      return ((window.orientation % 360) + 360) % 360;
    }
    return window.innerWidth > window.innerHeight ? 90 : 0;
  };

  const [orientationAngle, setOrientationAngle] = useState(getOrientationAngle);
  const isLandscape = orientationAngle === 90 || orientationAngle === 270;

  useEffect(() => {
    const updateOrientation = () => setOrientationAngle(getOrientationAngle());

    // Cover all the ways a rotation can be reported across Android/iPhone
    // browsers: the Screen Orientation API's change event, the legacy
    // window 'orientationchange' event, and a plain 'resize' fallback for
    // browsers/webviews that don't fire either of the above reliably.
    let cleanupFns = [];

    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener("change", updateOrientation);
      cleanupFns.push(() =>
        window.screen.orientation.removeEventListener(
          "change",
          updateOrientation,
        ),
      );
    }

    window.addEventListener("orientationchange", updateOrientation);
    cleanupFns.push(() =>
      window.removeEventListener("orientationchange", updateOrientation),
    );

    window.addEventListener("resize", updateOrientation);
    cleanupFns.push(() =>
      window.removeEventListener("resize", updateOrientation),
    );

    // Run once on mount in case orientation changed between initial state
    // calculation and listener attachment.
    updateOrientation();

    return () => cleanupFns.forEach((fn) => fn());
  }, []);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // World-unit base size/position for the a-video plane, per target.
  // arWidth/arHeight should match the target image's aspect ratio.
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
          resetEntityTransform(target, 1, { x: 0, y: 0 });

          try {
            if (video) {
              video.currentTime = 0;
              await video.play();
              setIsPlaying(true);
            }
          } catch (e) {
            console.error(e);
          }

          // Freeze BOTH tracking and the camera feed — the whole screen
          // (background + anchored video) locks in place together.
          try {
            arSystemRef.current?.pause(true);
          } catch (e) {
            console.warn("MindAR pause error:", e);
          }
        });

        // targetLost won't fire once paused(true) — expected.
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

  // ---- Apply zoom/pan to the actual a-video entity in AR space ----
  const resetEntityTransform = (target, z, p) => {
    const entity = videoEntityRefs.current[target.targetIndex];
    if (!entity) return;
    entity.setAttribute("scale", `${z} ${z} 1`);
    entity.setAttribute("position", `${p.x} ${p.y} 0.02`);
  };

  const applyTransform = useCallback(
    (z, p) => {
      if (activeTarget === null) return;
      const target = dummyData.targets.find(
        (t) => t.targetIndex === activeTarget,
      );
      if (!target) return;
      resetEntityTransform(target, z, p);
    },
    [activeTarget],
  );

  // Max pan (world units) so the zoomed plane never reveals empty space
  // beyond its own edges.
  const clampPan = useCallback(
    (x, y, currentZoom) => {
      if (activeTarget === null) return { x: 0, y: 0 };
      const target = dummyData.targets.find(
        (t) => t.targetIndex === activeTarget,
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
    [activeTarget],
  );

  // ---- Playback controls (operate on the underlying <video> element) ----
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

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const next = Math.min(z + 0.25, 3);
      setPan((p) => {
        const clamped = clampPan(p.x, p.y, next);
        applyTransform(next, clamped);
        return clamped;
      });
      return next;
    });
  }, [clampPan, applyTransform]);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(z - 0.25, 1);
      setPan((p) => {
        const clamped = clampPan(p.x, p.y, next);
        applyTransform(next, clamped);
        return clamped;
      });
      return next;
    });
  }, [clampPan, applyTransform]);

  // ---- Drag / pan handlers on a full-screen invisible layer ----
  // (Camera is frozen, so we drag over the whole screen rather than
  // trying to pointer-track a moving 3D plane.)
  const DRAG_TO_WORLD = 0.003; // tune this: screen px -> AR world units

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

  // Convert a raw screen-space pointer delta into AR world-space pan units,
  // accounting for device rotation. In AR world space, +X is always
  // "visual right" and +Y is always "visual up" from the user's point of
  // view, but the raw clientX/clientY delta is only aligned with that when
  // the device is in its natural (0deg) orientation. When rotated, we
  // rotate the raw delta vector back into that natural frame first.
  //
  // NOTE: The Screen Orientation API's "angle" is fairly consistent across
  // Android and desktop browsers, but iOS Safari's rotation reporting can
  // be inconsistent between models/versions. If dragging feels reversed on
  // a specific device in landscape, flip the sign of `rotated` for that
  // branch below — the rotation math is intentionally isolated here so
  // that's a one-line fix.
  const screenDeltaToWorldPan = (rawDx, rawDy, angle) => {
    let rotated;
    switch (angle) {
      case 90:
        // Landscape, rotated 90deg clockwise from natural orientation.
        rotated = { x: rawDy, y: rawDx };
        break;
      case 270:
      case -90:
        // Landscape, rotated 90deg counter-clockwise from natural orientation.
        rotated = { x: -rawDy, y: -rawDx };
        break;
      case 180:
        rotated = { x: -rawDx, y: -rawDy };
        break;
      default:
        rotated = { x: rawDx, y: rawDy };
    }
    // Flip Y because screen-space Y grows downward while AR world-space Y
    // grows upward.
    return { x: rotated.x * DRAG_TO_WORLD, y: -rotated.y * DRAG_TO_WORLD };
  };

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDraggingRef.current) return;
      const rawDx = e.clientX - dragStartRef.current.x;
      const rawDy = e.clientY - dragStartRef.current.y;
      const { x: dx, y: dy } = screenDeltaToWorldPan(
        rawDx,
        rawDy,
        orientationAngle,
      );
      const next = clampPan(
        panStartRef.current.x + dx,
        panStartRef.current.y + dy,
        zoom,
      );
      setPan(next);
      applyTransform(zoom, next);
    },
    [clampPan, applyTransform, zoom, orientationAngle],
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

  // ---- Control bar layout (orientation-aware) ----
  const controlBarStyle = isLandscape
    ? {
        position: "fixed",
        top: "50%",
        right: 24,
        transform: "translateY(-50%)",
        zIndex: 101,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "14px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
      }
    : {
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 101,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
      };

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

      {/* Full-screen drag layer for panning + fixed control bar.
          Only active once a target has been found; camera is frozen
          underneath so this is safe to lay over the whole viewport.
          Control bar switches between bottom-horizontal (portrait) and
          right-vertical (landscape) based on live orientation. */}
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

          <div style={controlBarStyle}>
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
              {isPlaying ? "⏸" : "▶️"}
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
              ✕
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

import React, { useEffect, useRef } from "react";
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
import * as THREE from "three";

const MindARThreeViewer = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let mindarThree = null;

    const startAR = async () => {
      mindarThree = new MindARThree({
        container: containerRef.current,
        imageTargetSrc: "./targets.mind",
      });

      const { renderer, scene, camera } = mindarThree;
      const anchor = mindarThree.addAnchor(0);
      const geometry = new THREE.PlaneGeometry(1, 0.55);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5,
      });
      const plane = new THREE.Mesh(geometry, material);
      anchor.group.add(plane);

      try {
        await mindarThree.start();
      } catch (e) {
        console.error("MindAR start failed:", e);
        return;
      }

      // Component may have unmounted while start() was resolving
      if (!isMounted) {
        mindarThree.stop();
        return;
      }

      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
    };

    startAR();

    return () => {
      isMounted = false;
      if (mindarThree) {
        try {
          mindarThree.renderer?.setAnimationLoop(null);
          mindarThree.stop();
        } catch (e) {
          console.warn("MindAR stop error (safe to ignore):", e);
        }
      }
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }} ref={containerRef}></div>
  );
};

export default MindARThreeViewer;

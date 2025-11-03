import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SmoothTracker } from "./smooth-tracker.js";

export class ModelManager {

    constructor({ scene, camera, mindarThree, ui, audioManager }) {
        this.scene = scene;
        this.camera = camera;
        this.ui = ui;
        this.audioManager = audioManager;

        this.loader = new GLTFLoader();
        this.mindarThree = mindarThree;

        this.MODEL_URLS = [
            "src/venus1.glb",
            "src/venus2.glb",
            "src/venus3.glb",
        ];

        this.anchors = [];
        this.modelGroups = [];
        this.mixers = [];
        this.actionsList = [];
        this.visibleState = [];
        this.modelsLoaded = [];
        this.modelActivated = [];
        this.trackers = [];

        this.activeTargets = new Set();
        this.unlockedIndex = 0;
        this.currentVisibleModel = null;

        this.setupModels();
        this.setupMarkerEvents();
    }

    setupModels() {
        for (let i = 0; i < this.MODEL_URLS.length; i++) {
            const anchor = this.mindarThree.addAnchor(i);
            this.anchors.push(anchor);

            const group = new THREE.Group();
            group.visible = false;
            anchor.group.add(group);

            this.modelGroups.push(group);
            this.trackers.push(new SmoothTracker());
            this.mixers.push(null);
            this.actionsList.push([]);
            this.visibleState.push(false);
            this.modelActivated.push(false);
            this.modelsLoaded.push(false);

            this.loadModel(i);
            this.setupAnchorEvents(i);
        }
    }

    loadModel(i) {
        this.loader.load(this.MODEL_URLS[i], (gltf) => {
            const model = gltf.scene;
            this.modelGroups[i].add(model);
            this.modelsLoaded[i] = true;

            if (gltf.animations.length) {
                const mixer = new THREE.AnimationMixer(model);
                this.mixers[i] = mixer;
                this.actionsList[i] = gltf.animations.map(clip => {
                    const action = mixer.clipAction(clip);
                    action.setLoop(THREE.LoopOnce);
                    action.clampWhenFinished = true;
                    return action;
                });
            }
        });
    }

    setupMarkerEvents() {
        document.querySelectorAll(".marker").forEach((marker, i) => {
            const activate = () => {
                if (this.modelsLoaded[i] && !this.modelActivated[i] && i <= this.unlockedIndex) {
                    this.showModel(i);
                }
            };

            marker.addEventListener("click", activate);
            marker.addEventListener("touchend", activate);
        });
    }

    setupAnchorEvents(i) {
        const anchor = this.anchors[i];

        anchor.onTargetFound = () => {
            this.visibleState[i] = true;
            this.activeTargets.add(i);

            this.ui.onTargetFound();

            if (!this.modelActivated[i]) {
                const position = new THREE.Vector3();
                this.anchors[i].group.getWorldPosition(position);
                const screenPos = position.clone().project(this.camera);
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
                this.ui.showMarker(i, { x, y });
            } else {
                this.modelGroups[i].visible = true;
            }
        };

        anchor.onTargetLost = () => {
            this.visibleState[i] = false;

            setTimeout(() => {
                if (!this.visibleState[i]) {
                    this.activeTargets.delete(i);
                    this.ui.hideMarker(i);
                    if (this.modelActivated[i]) this.modelGroups[i].visible = false;
                    
                    // Verificar si ya no hay targets activos
                    if (this.activeTargets.size === 0) {
                        this.ui.onTargetLost();
                    }
                }
            }, 800);
        };
    }

    showModel(i) {
        // Ocultar el modelo anterior si existe
        if (this.currentVisibleModel !== null && this.currentVisibleModel !== i) {
            const prevGroup = this.modelGroups[this.currentVisibleModel];
            this.fadeOutModel(prevGroup);
            this.ui.hideSpeechBubble();
        }

        this.modelActivated[i] = true;
        this.currentVisibleModel = i;
        const group = this.modelGroups[i];
        
        // Fade in del nuevo modelo
        this.fadeInModel(group);

        this.ui.hideMarker(i);
        this.ui.showSpeechBubble(i);

        const actions = this.actionsList[i];
        actions?.forEach(a => a.play());

        this.audioManager.play(`foley${i + 1}`);

        if (i + 1 < this.MODEL_URLS.length) {
            this.unlockedIndex = i + 1;
        }
    }

    fadeOutModel(group) {
        // Configurar opacidad inicial si no existe
        group.traverse((child) => {
            if (child.isMesh) {
                if (!child.material.transparent) {
                    child.material.transparent = true;
                    child.material.opacity = 1;
                }
            }
        });

        const duration = 300; // ms
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const opacity = 1 - progress;

            group.traverse((child) => {
                if (child.isMesh) {
                    child.material.opacity = opacity;
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                group.visible = false;
                // Restaurar opacidad para cuando vuelva a aparecer
                group.traverse((child) => {
                    if (child.isMesh) {
                        child.material.opacity = 1;
                    }
                });
            }
        };

        animate();
    }

    fadeInModel(group) {
        group.visible = true;
        
        // Configurar opacidad inicial
        group.traverse((child) => {
            if (child.isMesh) {
                if (!child.material.transparent) {
                    child.material.transparent = true;
                }
                child.material.opacity = 0;
            }
        });

        const duration = 300; // ms
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            group.traverse((child) => {
                if (child.isMesh) {
                    child.material.opacity = progress;
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    update(delta) {
        // animaciones
        this.mixers.forEach((mixer, i) => {
            if (mixer && this.visibleState[i] && this.modelActivated[i]) {
                mixer.update(delta);
            }
        });

        //Actualizar posiciones de marcadores en targets no activados
        for (let i = 0; i < this.anchors.length; i++) {
            if (this.visibleState[i] && !this.modelActivated[i] && i <= this.unlockedIndex) {
                const position = new THREE.Vector3();
                this.anchors[i].group.getWorldPosition(position);
                const screenPos = position.clone().project(this.camera);
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
                this.ui.showMarker(i, { x, y });
            }
        }

        // trackers
        this.modelGroups.forEach((group, i) => {
            if (this.trackers[i] && this.visibleState[i] && this.modelActivated[i]) {
                this.trackers[i].smoothTransform(group, this.anchors[i].group);
            }
        });
    }
}
import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UIControl } from "./js/ui-control.js";
import { SmoothTracker } from "./js/smooth-tracker.js";

const ui = new UIControl();
ui.startLoadingSequence();

// Modelos por target: debe corresponder al orden de targets.mind
const MODEL_URLS = [
    "src/venus1.glb",
    "src/venus2.glb",
    "src/venus3.glb"
];

// Config. para traqueo
const OPCIONES_TRACKEO = {
    filterMinCF: 0.0005,
    filterBeta: 15,
    warmupTolerance: 5, // Reducido para detección más rápida
    missTolerance: 3, // Reducido para mejor respuesta
    showStats: false,
    uiLoading: false,
    uiScanning: false,

    // IMPORTANTE: maxTrack controla cuántos targets pueden estar activos simultáneamente
    maxTrack: 3, // Debe ser >= al número de targets que quieres trackear a la vez
};

const dialogues = [
  "Florencia, 1727. En mármol y silencio nació la Venus de Capua. Su calco, viajero sin pasaporte, cruzó mares invisibles hasta América. Pero algo se quebró: su brazo, fragmentado por el tiempo, quedó atrás. La belleza llegó incompleta.",
  "Un pequeño barco se deslizó por el océano, como un susurro entre olas. La travesía fue breve, pero profunda. Al final del viaje, la Venus encontró tierra en La Plata, donde el arte esperaba en silencio.",
  "Frente a los ojos, la Venus se alzó de nuevo. Cubierta de polvo, su cuerpo de terracota parecía suspirar por lo perdido. Hasta que manos de artistas, diseñadores y soñadores, con tecnología y ternura, le devolvieron el brazo que el tiempo le había robado."
];

// ---------------- Iniciar mindAR ----------------------------------------------
const mindarThree = new MindARThree({
    container: document.querySelector("#container"),
    imageTargetSrc: "src/targets.mind",
    ...OPCIONES_TRACKEO,
});
const { renderer, scene, camera } = mindarThree;

// Configuración del renderer para múltiples objetos
renderer.sortObjects = true;
renderer.setPixelRatio(window.devicePixelRatio);

// Iluminación 
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const hemisphereLight = new THREE.HemisphereLight(0xf5f5f5, 0x666666, 0.4);
scene.add(hemisphereLight);
const keyLight = new THREE.DirectionalLight(0xfff8e7, 1.2);
keyLight.position.set(3, 8, 5);
keyLight.castShadow = false;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xe0e0e0, 0.3);
fillLight.position.set(-4, 3, 6);
scene.add(fillLight);

// Cargar modelo GLTF
const loader = new GLTFLoader();

// Arreglos para gestionar múltiples targets
const anchors = [];
const modelGroups = [];
const mixers = [];
const trackers = [];
const actionsList = [];
const visibleState = [];
const modelsLoaded = [];
const activeTargets = new Set(); // Tracking de targets activos
const speechBubble = document.getElementById("speech-bubble");

const targetCount = MODEL_URLS.length;

function showSpeechBubble(index) {
  speechBubble.textContent = dialogues[index];
  speechBubble.classList.remove("hidden");
  setTimeout(() => {
    speechBubble.classList.add("visible");
  }, 10);
}

function hideSpeechBubble() {
  speechBubble.classList.remove("visible");
  setTimeout(() => {
    speechBubble.classList.add("hidden");
  }, 500);
}

// Crear anchors y configurar cada target
for (let i = 0; i < targetCount; i++) {
    const anchor = mindarThree.addAnchor(i);
    anchors.push(anchor);

    // Crear contenedor para el modelo
    const group = new THREE.Group();
    group.name = `model-group-${i}`;
    modelGroups.push(group);
    group.visible = false;

    // agregar el grupo al anchor
    anchor.group.add(group);

    // Crear un SmoothTracker para cada modelo 
    const st = new SmoothTracker();
    st.setSensitivity('medium');
    trackers.push(st);

    mixers.push(null);
    actionsList.push([]);
    visibleState.push(false);
    modelsLoaded.push(false);

    const modelUrl = MODEL_URLS[i];

    // Cargar modelo
    loader.load(
        modelUrl,
        (gltf) => {
            const model = gltf.scene;
            model.name = `venus-${i}`;

            // Centrar modelo
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            // Escala y rotación
            model.scale.set(1, 1, 1);
            model.rotation.set(Math.PI / 2, 0, 0);
            model.position.set(0, 0, 0);

            // Optimizaciones de renderizado para múltiples objetos
            model.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    if (child.material) {
                        // Clonar material para evitar conflictos entre modelos
                        child.material = child.material.clone();
                        child.material.depthTest = true;
                        child.material.depthWrite = true;
                        child.material.needsUpdate = true;
                        // Render order para evitar conflictos
                        child.renderOrder = i;
                    }
                }
            });

            group.add(model);
            modelsLoaded[i] = true;

            // Configurar animaciones si existen
            if (gltf.animations && gltf.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(model);
                mixers[i] = mixer;

                const actions = gltf.animations.map((clip) => {
                    const action = mixer.clipAction(clip);
                    action.setLoop(THREE.LoopOnce);
                    action.clampWhenFinished = true;
                    return action;
                });
                actionsList[i] = actions;
            }

            // Inicializar posición del tracker
            st.lastPosition.copy(group.position);
            st.lastRotation.copy(group.rotation);
            st.lastScale.copy(group.scale);
        },
        (progress) => {
            const percent = (progress.loaded / progress.total) * 100;
        },
        (err) => {
            console.error(`Error cargando modelo ${modelUrl}:`, err);
        }
    );

// Evento: Target encontrado
anchor.onTargetFound = () => {
    if (!modelsLoaded[i]) return;

    activeTargets.add(i);
    visibleState[i] = true;

    const group = modelGroups[i];
    group.visible = true;

    // Asegurar que el modelo sea opaco
    group.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.opacity = 1;
            child.material.transparent = false;
        }
    });

    trackers[i].onTargetFound();

    // Reproducir animaciones si las hay
    const actions = actionsList[i];
    if (actions && actions.length > 0) {
        actions.forEach(a => {
            a.reset();
            a.play();
        });
    }

    // Ocultar interfaces y mensajes
    document.querySelector("#loading-ui")?.classList.add("hidden");
    document.querySelector("#scanning-ui")?.classList.add("hidden");
    document.getElementById("targetLostMessage")?.classList.add("hidden");

    showSpeechBubble(i);
    updateScanningUI();
    ui.onTargetFound();
};


// Evento: Target perdido
anchor.onTargetLost = () => {
    visibleState[i] = false;

    // Espera breve antes de considerar la pérdida total
    setTimeout(() => {
        if (!visibleState[i]) {
            activeTargets.delete(i);
            modelGroups[i].visible = false;
            updateScanningUI();

            // Mostrar mensaje y volver al modo escaneo
            const scanningUI = document.querySelector("#scanning-ui");
            const targetLostMessage = document.getElementById("targetLostMessage");

            scanningUI?.classList.remove("hidden");
            targetLostMessage?.classList.remove("hidden");

            ui.onTargetLost();
            // Reinicia la animación o efecto de escaneo visual si tenés uno
            ui.onTargetLost();
        }
    }, 800);
};
}

// Actualizar UI de escaneo según targets visibles
function updateScanningUI() {
    const anyVisible = activeTargets.size > 0;
    const scanningScreen = document.getElementById('scanningScreen');
    const targetLostMessage = document.getElementById('targetLostMessage');

    if (anyVisible) {
        scanningScreen?.classList.add('hidden');
        targetLostMessage?.classList.add('hidden');
    } else {
        scanningScreen?.classList.remove('hidden');
        targetLostMessage?.classList.add('hidden');
    }
}

// Ajustes para móviles
if (/Mobi|Android/i.test(navigator.userAgent)) {
    trackers.forEach(t => {
        t.setSensitivity('low');
        t.bufferSize = 6;
        t.predictionStrength = 0.03;
    });

    // Reducir calidad de renderer en móviles
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Debug: Mostrar estado cada 3 segundos
setInterval(() => {
    if (activeTargets.size > 0) {
        console.log(`Estado: ${activeTargets.size} target(s) activo(s) - IDs: [${Array.from(activeTargets).join(', ')}]`);
    }
}, 3000);

// ----------------- Renderizado -----------------
const start = async () => {
    try {
        await mindarThree.start();

        ui.onARReady();

        const clock = new THREE.Clock();
        let frameCount = 0;

        renderer.setAnimationLoop(() => {
            const delta = clock.getDelta();
            frameCount++;

            // Actualizar todas las animaciones activas
            for (let i = 0; i < mixers.length; i++) {
                if (mixers[i] && visibleState[i]) {
                    mixers[i].update(delta);
                }
            }

            // Actualizar trackers para modelos visibles
            for (let i = 0; i < modelGroups.length; i++) {
                const group = modelGroups[i];
                if (!group || !visibleState[i]) continue;

                // Aplicar suavizado de transformación
                trackers[i].smoothTransform(group, anchors[i].group);
            }

            renderer.render(scene, camera);

            // debug cada 60 frames
            if (frameCount % 60 === 0 && activeTargets.size > 0) {
                console.log(`Renderizando ${activeTargets.size} modelo(s)`);
            }
        });

    } catch (err) {
        document.getElementById('loadingSubtext').textContent =
            "Error al cargar. Verifica la cámara y recarga.";
    }
};

// Iniciar aplicación
start();
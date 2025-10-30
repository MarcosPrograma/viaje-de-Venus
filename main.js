import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UIControl } from "./js/ui-control.js";
import { SmoothTracker } from "./js/smooth-tracker.js";

const ui = new UIControl();
ui.startLoadingSequence();

// Modelos por target
const MODEL_URLS = [
    "src/venus1.glb",
    "src/venus2.glb",
    "src/venus3.glb"
];

const OPCIONES_TRACKEO = {
    filterMinCF: 0.0005,
    filterBeta: 15,
    warmupTolerance: 5,
    missTolerance: 3,
    showStats: false,
    uiLoading: false,
    uiScanning: false,
    maxTrack: 3,
};

const dialogues = [
    "Florencia, entre 1900 y 1920. En terracota y silencio nació la Venus de Capua. Su calco, viajero sin pasaporte, cruzó mares invisibles hasta América. Pero algo se quebró: su brazo, fragmentado por el tiempo, quedó atrás. La belleza llegó incompleta.",
    "Un pequeño barco se deslizó por el océano, como un susurro entre olas. La travesía fue breve, pero profunda. Al final del viaje, la Venus encontró tierra en La Plata, donde el arte esperaba en silencio.",
    "Frente a los ojos, la Venus se alzó de nuevo. Cubierta de polvo, su cuerpo de terracota parecía suspirar por lo perdido. Hasta que manos de artistas, diseñadores y soñadores, con tecnología y ternura, le devolvieron el brazo que el tiempo le había robado."
];

// Iniciar MindAR
const mindarThree = new MindARThree({
    container: document.querySelector("#container"),
    imageTargetSrc: "src/targets.mind",
    ...OPCIONES_TRACKEO,
});
const { renderer, scene, camera } = mindarThree;

renderer.sortObjects = true;
renderer.setPixelRatio(window.devicePixelRatio);

// Iluminación
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const hemisphereLight = new THREE.HemisphereLight(0xf5f5f5, 0x666666, 0.4);
scene.add(hemisphereLight);
const keyLight = new THREE.DirectionalLight(0xfff8e7, 1.2);
keyLight.position.set(3, 8, 5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xe0e0e0, 0.3);
fillLight.position.set(-4, 3, 6);
scene.add(fillLight);

const loader = new GLTFLoader();

const listener = new THREE.AudioListener();
camera.add(listener);

// Audio ambiental
const bgSound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

audioLoader.load("src/audio/ambient.mp3", (buffer) => {
    bgSound.setBuffer(buffer);
    bgSound.setLoop(true);
    bgSound.setVolume(0.4);
});

// Foley por modelo
const foleySounds = [];

for (let i = 0; i < MODEL_URLS.length; i++) {
    const sound = new THREE.Audio(listener);
    audioLoader.load(`src/audio/foley${i + 1}.mp3`, (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(false);
        sound.setVolume(0.9);
    });
    foleySounds.push(sound);
}

// Arrays de gestión
const anchors = [];
const modelGroups = [];
const mixers = [];
const trackers = [];
const actionsList = [];
const visibleState = [];
const modelsLoaded = [];
const modelActivated = []; // Nuevo: marca si el modelo ya fue activado manualmente
const activeTargets = new Set();
const speechBubble = document.getElementById("speech-bubble");

let unlockedIndex = 0; // Control secuencial
const markers = document.querySelectorAll(".marker");

// Función para mostrar marcador
function showMarker(index, position2D) {
    const marker = markers[index];
    if (!marker) return;

    marker.style.left = `${position2D.x}px`;
    marker.style.top = `${position2D.y}px`;
    marker.style.pointerEvents = 'auto';
    marker.style.zIndex = '100000';
    marker.classList.add("visible");

    console.log(`Marcador ${index} mostrado en (${position2D.x}, ${position2D.y})`);
}

// Función para ocultar marcador
function hideMarker(index) {
    const marker = markers[index];
    if (!marker) return;

    marker.style.pointerEvents = 'none';
    marker.classList.remove("visible");

    console.log(`Marcador ${index} ocultado`);
}

//Si existe un modelo anterior activado, fade-in y activar nuevo modelo
function fadeOutModel(index) {
    const group = modelGroups[index];
    if (!group) return;

    let opacity = 1;
    group.traverse((child) => {
        if (child.isMesh) {
            child.material.transparent = true;
        }
    });

    const fadeOut = setInterval(() => {
        opacity -= 0.05;
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.opacity = Math.max(opacity, 0);
            }
        });

        if (opacity <= 0) {
            clearInterval(fadeOut);
            group.visible = false;
            group.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = 0;
                }
            });
        }
    }, 40); // velocidad del fade
}

// Función para mostrar modelo (al hacer clic en marcador)
function showModel(index) {
    if (modelActivated[index]) return; // Ya fue activado

    if (index > 0) {
        const previousIndex = index - 1;
        if (modelActivated[previousIndex]) {
            console.log("Ocultando modelo anterior", previousIndex);
            setTimeout(() => {
                fadeOutModel(previousIndex);
            }, 4000); // tiempo de espera antes de ocultar
        }
    }

    modelActivated[index] = true;
    visibleState[index] = true;
    activeTargets.add(index);

    const group = modelGroups[index];
    group.visible = true;

    // Preparar materiales para fade-in
    group.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = 0;
            child.material.needsUpdate = true;
        }
    });

    // Animación de aparición
    setTimeout(() => {
        let opacity = 0;
        const fadeIn = setInterval(() => {
            opacity += 0.3;
            group.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = Math.min(opacity, 1);
                }
            });
            group.scale.multiplyScalar(1.02);

            if (opacity >= 1) {
                clearInterval(fadeIn);
                // Asegurar opacidad final
                group.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.opacity = 1;
                        child.material.transparent = false;
                        child.material.needsUpdate = true;
                    }
                });

                const actions = actionsList[index];
                if (actions && actions.length > 0) {
                    actions.forEach(a => {
                        a.reset();
                        a.play();
                    });
                }

                if (foleySounds[index] && !foleySounds[index].isPlaying) {
                    foleySounds[index].play();
                }
            }
        }, 40);
    }, 800);

    showSpeechBubble(index);
    hideMarker(index);

    // Desbloquear siguiente modelo
    if (index + 1 < MODEL_URLS.length) {
        unlockedIndex = index + 1;
        console.log(`Modelo ${index + 1} desbloqueado`);
    }
}

// Event listeners para marcadores con mejor detección
markers.forEach((marker, i) => {
    // Asegurar que el marcador tenga pointer-events
    marker.style.pointerEvents = 'auto';
    marker.style.cursor = 'pointer';
    marker.style.zIndex = '9999';

    // Múltiples eventos para mejor compatibilidad
    const handleActivation = (e) => {
        e.stopPropagation();
        e.preventDefault();

        console.log(`Click en marcador ${i}, desbloqueado: ${i <= unlockedIndex}, cargado: ${modelsLoaded[i]}, activado: ${modelActivated[i]}`);

        if (i <= unlockedIndex && modelsLoaded[i] && !modelActivated[i]) {
            console.log(`✓ Activando modelo ${i}`);
            showModel(i);
        } else {
            console.log(`✗ No se puede activar modelo ${i}`);
        }
    };

    marker.addEventListener("click", handleActivation);
    marker.addEventListener("touchend", handleActivation);
    marker.addEventListener("pointerdown", handleActivation);
});

const targetCount = MODEL_URLS.length;

let speechTimeout = null;

function showSpeechBubble(index) {
    const bubble = speechBubble;
    if (!bubble) return;

    // Cancelar cualquier diálogo previo
    clearTimeout(speechTimeout);

    // Mostrar nuevo texto
    bubble.textContent = dialogues[index];
    bubble.classList.remove("hidden");
    setTimeout(() => bubble.classList.add("visible"), 10);

    // Ocultar automáticamente después de 15 segundos
    speechTimeout = setTimeout(() => {
        hideSpeechBubble();
    }, 15000);
}

function hideSpeechBubble() {
    const bubble = speechBubble;
    if (!bubble) return;

    bubble.classList.remove("visible");
    clearTimeout(speechTimeout); // evitar superposición de timers

    setTimeout(() => {
        bubble.classList.add("hidden");
    }, 500);
}

// Crear anchors y cargar modelos
for (let i = 0; i < targetCount; i++) {
    const anchor = mindarThree.addAnchor(i);
    anchors.push(anchor);

    const group = new THREE.Group();
    group.name = `model-group-${i}`;
    modelGroups.push(group);
    group.visible = false;

    anchor.group.add(group);

    const st = new SmoothTracker();
    st.setSensitivity('medium');
    trackers.push(st);

    mixers.push(null);
    actionsList.push([]);
    visibleState.push(false);
    modelsLoaded.push(false);
    modelActivated.push(false); // Inicialmente no activado

    const modelUrl = MODEL_URLS[i];

    // Cargar modelo
    loader.load(
        modelUrl,
        (gltf) => {
            const model = gltf.scene;
            model.name = `venus-${i}`;

            // Centrar
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            model.scale.set(1, 1, 1);
            model.rotation.set(Math.PI / 2, 0, 0);
            model.position.set(0, 0, 0);

            model.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    if (child.material) {
                        child.material = child.material.clone();
                        child.material.depthTest = true;
                        child.material.depthWrite = true;
                        child.material.needsUpdate = true;
                        child.renderOrder = i;
                    }
                }
            });

            group.add(model);
            modelsLoaded[i] = true;
            console.log(`Modelo ${i} cargado`);

            // Configurar animaciones
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

    // Target encontrado: solo mostrar marcador si no está activado
    anchor.onTargetFound = () => {
        if (!modelsLoaded[i]) return;

        visibleState[i] = true;
        activeTargets.add(i);

        // Ocultar UIs
        document.querySelector("#loading-ui")?.classList.add("hidden");
        document.querySelector("#scanning-ui")?.classList.add("hidden");
        document.getElementById("targetLostMessage")?.classList.add("hidden");

        // Solo mostrar marcador si el modelo no ha sido activado y está desbloqueado
        if (!modelActivated[i] && i <= unlockedIndex) {
            const position = new THREE.Vector3();
            anchors[i].group.getWorldPosition(position);
            const screenPos = position.clone().project(camera);
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

            showMarker(i, { x, y });
        } else if (modelActivated[i]) {
            // Si ya fue activado, mostrar el modelo directamente
            modelGroups[i].visible = true;
        }

        trackers[i].onTargetFound();
        updateScanningUI();
        ui.onTargetFound();
    };

    // Target perdido
    anchor.onTargetLost = () => {
        visibleState[i] = false;

        setTimeout(() => {
            if (!visibleState[i]) {
                activeTargets.delete(i);

                // Solo ocultar si fue activado
                if (modelActivated[i]) {
                    modelGroups[i].visible = false;
                }

                updateScanningUI();
                hideMarker(i);

                // Solo mostrar mensaje si no hay targets activos
                if (activeTargets.size === 0) {
                    const scanningUI = document.querySelector("#scanning-ui");
                    const targetLostMessage = document.getElementById("targetLostMessage");
                    scanningUI?.classList.remove("hidden");
                    targetLostMessage?.classList.remove("hidden");
                    ui.onTargetLost();
                    //hideSpeechBubble();
                }
            }
        }, 800);
    };
}

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

// Ajustes móviles
if (/Mobi|Android/i.test(navigator.userAgent)) {
    trackers.forEach(t => {
        t.setSensitivity('low');
        t.bufferSize = 6;
        t.predictionStrength = 0.03;
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function enableAudio() {
  if (!bgSound.isPlaying) {
    bgSound.play();
  }
  document.removeEventListener('touchstart', enableAudio);
  document.removeEventListener('click', enableAudio);
}

// Se activa cuando el usuario toca la pantalla
document.addEventListener('touchstart', enableAudio);
document.addEventListener('click', enableAudio);

// Iniciar
const start = async () => {
    try {
        await mindarThree.start();
        ui.onARReady();

        if (!bgSound.isPlaying) bgSound.play();

        const clock = new THREE.Clock();

        renderer.setAnimationLoop(() => {
            const delta = clock.getDelta();

            // Actualizar posición de marcadores para targets detectados pero no activados
            for (let i = 0; i < anchors.length; i++) {
                if (visibleState[i] && !modelActivated[i] && i <= unlockedIndex) {
                    const position = new THREE.Vector3();
                    anchors[i].group.getWorldPosition(position);
                    const screenPos = position.clone().project(camera);
                    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                    const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
                    showMarker(i, { x, y });
                }
            }

            // Actualizar animaciones
            for (let i = 0; i < mixers.length; i++) {
                if (mixers[i] && visibleState[i] && modelActivated[i]) {
                    mixers[i].update(delta);
                }
            }

            // Actualizar trackers
            for (let i = 0; i < modelGroups.length; i++) {
                const group = modelGroups[i];
                if (!group || !visibleState[i] || !modelActivated[i]) continue;
                trackers[i].smoothTransform(group, anchors[i].group);
            }

            renderer.render(scene, camera);
        });

    } catch (err) {
        console.error("Error al iniciar:", err);
        document.getElementById('loadingSubtext').textContent =
            "Error al cargar. Verifica la cámara y recarga.";
    }
};

start();
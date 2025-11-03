import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { UIControl } from "./js/ui-control.js";
import { AudioManager } from "./js/audio-manager.js";
import { ModelManager } from "./js/model-manager.js";
import { setupLighting } from "./js/lighting.js";

const dialogues = [
    "Florencia, entre 1900 y 1920. En terracota y silencio nació la Venus de Capua. Su calco, viajero sin pasaporte, cruzó mares invisibles hasta América. Pero algo se quebró: su brazo, fragmentado por el tiempo, quedó atrás. La belleza llegó incompleta.",
    "Un pequeño barco se deslizó por el océano, como un susurro entre olas. La travesía fue breve, pero profunda. Al final del viaje, la Venus encontró tierra en La Plata, donde el arte esperaba en silencio.",
    "Frente a los ojos, la Venus se alzó de nuevo. Cubierta de polvo, su cuerpo de terracota parecía suspirar por lo perdido. Hasta que manos de artistas, diseñadores y soñadores, con tecnología y ternura, le devolvieron el brazo que el tiempo le había robado."
];
const ui = new UIControl(dialogues);
ui.startLoadingSequence();

// Iniciar MindAR
const mindarThree = new MindARThree({
    container: document.querySelector("#container"),
    uiLoading: false,
    uiScanning: false,
    imageTargetSrc: "src/targets.mind",
    maxTrack: 3,
});

const { renderer, scene, camera } = mindarThree;
renderer.setPixelRatio(window.devicePixelRatio);

//Audio
const audioManager = new AudioManager(camera);

//Control 
const modelManager = new ModelManager({
    scene,
    camera,
    mindarThree,
    ui,
    audioManager
});

// Iluminación
setupLighting(scene);

const start = async () => {
    await mindarThree.start();
    ui.onARReady();
    audioManager.play("ambient");

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();
        modelManager.update(delta);
        renderer.render(scene, camera);
    });
};

start();
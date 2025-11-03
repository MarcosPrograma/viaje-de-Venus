import * as THREE from "three";

export function setupLighting(scene) {
    // Luz ambiente - iluminación general suave
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Luz hemisférica - simula luz del cielo y rebote del suelo
    const hemisphereLight = new THREE.HemisphereLight(0xf5f5f5, 0x666666, 0.4);
    scene.add(hemisphereLight);
    
    // Luz principal (key light) - iluminación principal direccional
    const keyLight = new THREE.DirectionalLight(0xfff8e7, 1.2);
    keyLight.position.set(3, 8, 5);
    scene.add(keyLight);
    
    // Luz de relleno (fill light) - suaviza sombras
    const fillLight = new THREE.DirectionalLight(0xe0e0e0, 0.3);
    fillLight.position.set(-4, 3, 6);
    scene.add(fillLight);
}
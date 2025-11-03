import * as THREE from "three";

export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.audioLoader = new THREE.AudioLoader();

    this.sounds = {};

    this.loadAudio("ambient", "src/audio/ambient.mp3", true, 0.6);
    this.loadAudio("foley1", "src/audio/foley1.mp3");
    this.loadAudio("foley2", "src/audio/foley2.mp3");
    this.loadAudio("foley3", "src/audio/foley3.mp3");
  }

  loadAudio(name, src, loop = false, volume = 1) {
    const sound = new THREE.Audio(this.listener);
    this.audioLoader.load(src, (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(loop);
      sound.setVolume(volume);
      if (loop) sound.play(); 
      this.sounds[name] = sound;
    });
  }

  play(name) {
    if (this.sounds[name]?.isPlaying) {
      this.sounds[name].stop();
    }
    this.sounds[name]?.play();
  }

  stop(name) {
    this.sounds[name]?.stop();
  }
}

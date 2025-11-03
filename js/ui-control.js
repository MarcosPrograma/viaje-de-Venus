export class UIControl {
    constructor(dialogues) {
        // UI Original
        this.loadingScreen = document.getElementById('loadingScreen');
        this.scanningScreen = document.getElementById('scanningScreen');
        this.loadingText = document.getElementById('loadingText');
        this.loadingSubtext = document.getElementById('loadingSubtext');
        this.targetLostMessage = document.getElementById('targetLostMessage');

        // Marcadores
        this.markers = document.querySelectorAll(".marker");

        // Globos de diaologo
        this.speechBubble = document.getElementById("speech-bubble");
        this.dialogues = dialogues;
        this.speechTimeout = null;
    }

    //Marcadores flotantes
    showMarker(index, pos) {
        const marker = this.markers[index];
        if (!marker) return;

        marker.style.left = `${pos.x}px`;
        marker.style.top = `${pos.y}px`;
        marker.classList.add("visible");
        marker.style.pointerEvents = "auto";
    }

    hideMarker(index) {
        const marker = this.markers[index];
        if (!marker) return;

        marker.classList.remove("visible");
        marker.style.pointerEvents = "none";
    }

    //Globos de dialogo
    showSpeechBubble(index) {
        const bubble = this.speechBubble;
        if (!bubble) return;

        clearTimeout(this.speechTimeout);

        bubble.textContent = this.dialogues[index];
        bubble.classList.remove("hidden");

        setTimeout(() => bubble.classList.add("visible"), 10);

        this.speechTimeout = setTimeout(() => {
            this.hideSpeechBubble();
        }, 15000);
    }

    hideSpeechBubble() {
        const bubble = this.speechBubble;
        if (!bubble) return;

        bubble.classList.remove("visible");
        clearTimeout(this.speechTimeout);

        setTimeout(() => {
            bubble.classList.add("hidden");
        }, 500);
    }

    // Estados de escaneo
    showLoading() {
        this.loadingScreen.classList.remove('hidden');
        this.scanningScreen.classList.remove('visible');
        this.simulateLoading();
    }

    hideLoading() {
        this.loadingScreen.classList.add('hidden');
    }

    showScanning() {
        this.hideLoading();
        this.scanningScreen.classList.add('visible');
    }

    hideScanning() {
        this.scanningScreen.classList.remove('visible');
    }

    simulateLoading() {
        setTimeout(() => {
            this.loadingSubtext.textContent = "Hecho en la Universidad Pública ♥";
        }, 1000);

        setTimeout(() => {
            this.hideLoading();
        }, 6000);
    }

    startLoadingSequence() {
        this.showLoading();
    }

    onARReady() {
        this.showScanning();
    }

    onTargetFound() {
        this.hideScanning();
        this.targetLostMessage.style.display = 'none';
    }

    onTargetLost() {
        this.showScanning();
        this.targetLostMessage.style.display = 'block';
        this.hideSpeechBubble();
    }
}

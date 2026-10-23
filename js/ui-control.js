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
        this.transitionTimeout = null;

        this.targetStates = {
            0 : { currentStep: null, isBubbleActive: false },
            1 : { currentStep: null, isBubbleActive: false },
            2 : { currentStep: null, isBubbleActive: false }
        }

        //this.currentStep = null;
        this.currentTargetIndex = null;
        this.activeMarkerIndex = null;
    }

    _initTargetState(targetIndex){
        if(!this.targetStates[targetIndex]){
            this.targetStates[targetIndex] = {
                currentStep : null,
                isBubbleActive : false 
            }
        }
    }

    //Marcadores flotantes
    showMarker(index, pos) {
        this.activeMarkerIndex = index;
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
        if (this.activeMarkerIndex === index) {
            this.activeMarkerIndex = null;
        }
    }

    hideAllMarkers() {
        this.markers.forEach((_, idx) => this.hideMarker(idx));
    }

    //Globos de dialogo
    showSpeechBubble(dialogueIndex, targetIndex = this.currentTargetIndex) {
        const bubble = this.speechBubble;
        if (!bubble || this.dialogues[dialogueIndex] === undefined) return;

        if(targetIndex !== null && targetIndex !== undefined){
            this._initTargetState(targetIndex);
            this.targetStates[targetIndex].currentStep = dialogueIndex;
            this.targetStates[targetIndex].isBubbleActive = true;
        }

        clearTimeout(this.speechTimeout);
        clearTimeout(this.transitionTimeout);

        bubble.classList.remove("hidden", "visible");
        bubble.textContent = this.dialogues[dialogueIndex];

        requestAnimationFrame(() => {
            bubble.classList.add("visible");
        });

        /*
        setTimeout(() => {
            bubble.classList.add("visible");
        }, 20); //delay
        */

        this.speechTimeout = setTimeout(() => {
            this.hideSpeechBubble(false, targetIndex);
        }, 200000); //2min 
    }

    hideSpeechBubble(forceImmediate = false, targetIndex = this.currentTargetIndex) {
        const bubble = this.speechBubble;
        if (!bubble) return;

        if(targetIndex !== null && targetIndex !== undefined && this.targetStates[targetIndex]){
            this.targetStates[targetIndex].isBubbleActive = false;
        }

        //this.isBubbleActive = false;
        clearTimeout(this.speechTimeout);
        clearTimeout(this.transitionTimeout);

        bubble.classList.remove("visible");

        if (forceImmediate) {
            bubble.classList.add("hidden");
        } else {
            this.transitionTimeout = setTimeout(() => {
                bubble.classList.add("hidden");
            }, 20000); //2 seg
        }
    }

    _hideBubbleDOMOnly() {
        const bubble = this.speechBubble;
        if (!bubble) return;
        clearTimeout(this.speechTimeout);
        clearTimeout(this.transitionTimeout);
        bubble.classList.remove("visible");
        bubble.classList.add("hidden");
    }

    onTargetFound(targetIndex) {
        this.currentTargetIndex = targetIndex;
        this._initTargetState(targetIndex);

        this.hideScanning();
        if(this.targetLostMessage){
            this.targetLostMessage.style.display = 'none';
        }

        const state = this.targetStates[targetIndex];

        if(state.isBubbleActive && state.currentStep !== null){
            this.showSpeechBubble(state.currentStep, targetIndex);
        } else {
            this._hideBubbleDOMOnly();
            //his.hideSpeechBubble(true, null);
        }
    }

    onTargetLost(targetIndex) {
        this.showScanning();
        if(this.targetLostMessage) {
            this.targetLostMessage.style.display = 'block';
        }
        
        this.hideAllMarkers();
        this._hideBubbleDOMOnly();

        /*
        if(targetIndex !== null && targetIndex !== undefined && this.targetStates[targetIndex]){
            const wasActive = this.targetStates[targetIndex].isBubbleActive;
            this.hideSpeechBubble(true, targetIndex);
            this.targetStates[targetIndex].isBubbleActive = wasActive;
        } else {
            this.hideSpeechBubble(true, null);
        }
        */ 

        if(this.currentTargetIndex === targetIndex){
            this.currentTargetIndex = null;
        }
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
}

import AudioService from './services/AudioService.js';
import VoiceService from './services/VoiceService.js';
import PlayerState from './state/PlayerState.js';
import PlayerControls from './components/PlayerControls.js';
import VoiceSelector from './components/VoiceSelector.js';
import WaveVisualizer from './components/WaveVisualizer.js';
import TextEditor from './components/TextEditor.js';

export class App {
    constructor() {
        this.elements = {
            generateBtn: document.getElementById('generate-btn'),
            generateBtnText: document.querySelector('#generate-btn .btn-text'),
            generateBtnLoader: document.querySelector('#generate-btn .loader'),
            downloadBtn: document.getElementById('download-btn'),
            autoplayToggle: document.getElementById('autoplay-toggle'),
            formatSelect: document.getElementById('format-select'),
            status: document.getElementById('status'),
            cancelBtn: document.getElementById('cancel-btn'),
            charCount: document.getElementById('char-count'),
            playPauseBtn: document.getElementById('play-pause-btn'),
            playIcon: document.getElementById('play-icon'),
        };

        this.initialize();
    }

    async initialize() {
        this.playerState = new PlayerState();
        this.audioService = new AudioService();
        this.voiceService = new VoiceService();

        this.playerControls = new PlayerControls(this.audioService, this.playerState);
        this.voiceSelector = new VoiceSelector(this.voiceService);
        this.waveVisualizer = new WaveVisualizer(this.playerState);

        const editorContainer = document.getElementById('text-editor');
        this.textEditor = new TextEditor(editorContainer, {
            linesPerPage: 20,
            onTextChange: (text) => {
                if (this.elements.charCount) {
                    this.elements.charCount.textContent = `Characters: ${text.length} / 750`;
                    this.elements.charCount.classList.toggle('warning', text.length > 700 && text.length <= 750);
                    this.elements.charCount.classList.toggle('over-limit', text.length > 750);
                }
                if (this.elements.generateBtn) {
                    this.elements.generateBtn.disabled = text.length > 750;
                }
            }
        });

        const voicesLoaded = await this.voiceSelector.initialize();
        if (!voicesLoaded) {
            this.showStatus('Failed to load voices', 'error');
            this.elements.generateBtn.disabled = true;
            return;
        }

        this.setupEventListeners();
        this.setupAudioEvents();
    }

    setupEventListeners() {
        this.elements.generateBtn.addEventListener('click', () => this.generateSpeech());
        this.elements.downloadBtn.addEventListener('click', () => this.downloadAudio());

        this.elements.cancelBtn.addEventListener('click', () => {
            this.audioService.cancel();
            this.setGenerating(false);
            this.elements.downloadBtn.classList.remove('ready');
            this.elements.downloadBtn.disabled = true;
            this.showStatus('Generation cancelled', 'info');
        });

        window.addEventListener('beforeunload', () => {
            this.audioService.cleanup();
            this.playerControls.cleanup();
            this.waveVisualizer.cleanup();
        });
    }

    setupAudioEvents() {
        this.audioService.addEventListener('bufferError', () => {
            this.showStatus('Processing… download ready when complete', 'info');
        });

        this.audioService.addEventListener('complete', () => {
            this.setGenerating(false);
            this.showStatus('Preparing file…', 'info');
        });

        this.audioService.addEventListener('downloadReady', () => {
            this.elements.downloadBtn.classList.add('ready');
            this.elements.downloadBtn.disabled = false;
            setTimeout(() => {
                this.showStatus('Generation complete', 'success');
            }, 400);
        });

        this.audioService.addEventListener('ended', () => {
            this.playerState.setPlaying(false);
            if (this.elements.playIcon) {
                this.elements.playIcon.setAttribute('d', 'M8 5v14l11-7z');
            }
        });

        this.audioService.addEventListener('play', () => {
            if (this.elements.playIcon) {
                this.elements.playIcon.setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
            }
        });

        this.audioService.addEventListener('pause', () => {
            if (this.elements.playIcon) {
                this.elements.playIcon.setAttribute('d', 'M8 5v14l11-7z');
            }
        });

        this.audioService.addEventListener('error', (error) => {
            this.showStatus('Error: ' + error.message, 'error');
            this.setGenerating(false);
            this.elements.downloadBtn.disabled = true;
        });
    }

    showStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = 'status-pill ' + type;
        setTimeout(() => {
            this.elements.status.className = 'status-pill';
            this.elements.status.textContent = '';
        }, 5000);
    }

    setGenerating(isGenerating) {
        this.playerState.setGenerating(isGenerating);
        this.elements.generateBtn.disabled = isGenerating;
        this.elements.generateBtn.classList.toggle('loading', isGenerating);
        this.elements.cancelBtn.style.display = isGenerating ? 'block' : 'none';
    }

    validateInput() {
        const text = this.textEditor.getText().trim();
        if (!text) {
            this.showStatus('Please enter some text', 'error');
            return false;
        }
        if (text.length > 750) {
            this.showStatus('Input must be 750 characters or fewer', 'error');
            return false;
        }
        if (!this.voiceService.hasSelectedVoices()) {
            this.showStatus('Please select a voice', 'error');
            return false;
        }
        return true;
    }

    async generateSpeech() {
        if (!this.validateInput()) return;

        const text = this.textEditor.getText().trim();
        const voice = this.voiceService.getSelectedVoiceString();
        const speed = this.playerState.getState().speed;

        this.setGenerating(true);
        this.elements.downloadBtn.classList.remove('ready');
        this.elements.downloadBtn.disabled = true;
        this.waveVisualizer.updateProgress(0, 1);

        try {
            await this.audioService.streamAudio(
                text,
                voice,
                speed,
                (loaded, total) => {
                    this.waveVisualizer.updateProgress(loaded, total);
                }
            );
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.showStatus('Error generating speech: ' + error.message, 'error');
                this.setGenerating(false);
            }
        }
    }

    downloadAudio() {
        const downloadUrl = this.audioService.getDownloadUrl();
        if (!downloadUrl) return;

        const format = this.elements.formatSelect.value;
        const voice = this.voiceService.getSelectedVoiceString();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${voice}_${timestamp}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

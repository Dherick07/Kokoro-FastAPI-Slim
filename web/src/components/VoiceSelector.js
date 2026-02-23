export class VoiceSelector {
    constructor(voiceService) {
        this.voiceService = voiceService;
        this.elements = {
            voiceSearch: document.getElementById('voice-search'),
            voiceDropdown: document.getElementById('voice-dropdown'),
            voiceOptions: document.getElementById('voice-options'),
            selectedVoices: document.getElementById('selected-voices')
        };
        
        this._previewAudio = null; // Shared Audio element for voice previews
        this._previewingVoice = null; // Currently previewing voice name
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Voice search focus — open dropdown
        this.elements.voiceSearch.addEventListener('focus', () => {
            this.elements.voiceDropdown.classList.add('show');
        });

        // Clicking the search bar again toggles dropdown closed
        this.elements.voiceSearch.addEventListener('mousedown', (e) => {
            if (document.activeElement === this.elements.voiceSearch &&
                this.elements.voiceDropdown.classList.contains('show')) {
                e.preventDefault();
                this.elements.voiceDropdown.classList.remove('show');
                this.elements.voiceSearch.blur();
            }
        });

        // Voice search
        this.elements.voiceSearch.addEventListener('input', (e) => {
            const filteredVoices = this.voiceService.filterVoices(e.target.value);
            this.renderVoiceOptions(filteredVoices);
        });

        // Voice preview play button
        this.elements.voiceOptions.addEventListener('mousedown', (e) => {
            const playBtn = e.target.closest('.voice-preview-btn');
            if (playBtn) {
                e.preventDefault();
                e.stopPropagation();
                const voice = playBtn.dataset.voice;
                if (voice) this._togglePreview(voice);
                return;
            }
        });

        // Voice selection - handle clicks on the entire voice option
        this.elements.voiceOptions.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur on search input
            
            // Don't select voice when clicking play button
            if (e.target.closest('.voice-preview-btn')) return;
            
            const voiceOption = e.target.closest('.voice-option');
            if (!voiceOption) return;
            
            const voice = voiceOption.dataset.voice;
            if (!voice) return;
            
            const isSelected = voiceOption.classList.contains('selected');
            
            if (!isSelected) {
                this.voiceService.addVoice(voice);
            } else {
                this.voiceService.removeVoice(voice);
            }
            
            voiceOption.classList.toggle('selected');
            this.updateSelectedVoicesDisplay();
            
            // Keep focus on search input
            requestAnimationFrame(() => {
                this.elements.voiceSearch.focus();
            });
        });

        // Weight adjustment via % slider
        this.elements.selectedVoices.addEventListener('input', (e) => {
            if (e.target.classList.contains('voice-mixer-slider')) {
                const voice = e.target.dataset.voice;
                const pct = parseInt(e.target.value, 10);
                const weight = Math.max(0.1, parseFloat((pct / 10).toFixed(1)));
                this.voiceService.updateWeight(voice, weight);
                const label = this.elements.selectedVoices.querySelector(`[data-voice-pct="${voice}"]`);
                if (label) label.textContent = `${pct}%`;
            }
        });

        // Remove selected voice
        this.elements.selectedVoices.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-voice')) {
                e.preventDefault();
                e.stopPropagation();
                const voice = e.target.dataset.voice;
                this.voiceService.removeVoice(voice);
                this.updateVoiceOptionState(voice, false);
                this.updateSelectedVoicesDisplay();
            }
        });

        // Handle clicks outside to close dropdown
        document.addEventListener('mousedown', (e) => {
            // Don't handle clicks in selected voices area
            if (this.elements.selectedVoices.contains(e.target)) {
                return;
            }
            
            // Don't close if clicking in search or dropdown
            if (this.elements.voiceSearch.contains(e.target) || 
                this.elements.voiceDropdown.contains(e.target)) {
                return;
            }
            
            this.elements.voiceDropdown.classList.remove('show');
            this.elements.voiceSearch.blur();
        });

        this.elements.voiceSearch.addEventListener('blur', () => {
            if (!this.elements.voiceSearch.value) {
                this.updateSearchPlaceholder();
            }
        });
    }

    renderVoiceOptions(voices) {
        const samplesAvailable = this.voiceService.getVoiceSamplesAvailable();
        this.elements.voiceOptions.innerHTML = voices
            .map(voice => {
                const hasSample = samplesAvailable.has(voice);
                const isPlaying = this._previewingVoice === voice;
                return `
                <div class="voice-option ${this.voiceService.getSelectedVoices().includes(voice) ? 'selected' : ''}" 
                     data-voice="${voice}">
                    <span class="voice-option-name">${voice}</span>
                    ${hasSample ? `<button class="voice-preview-btn ${isPlaying ? 'playing' : ''}" data-voice="${voice}" title="Preview voice">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            ${isPlaying 
                                ? '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>'
                                : '<path d="M8 5v14l11-7z"/>'
                            }
                        </svg>
                    </button>` : ''}
                </div>
            `})
            .join('');
    }

    updateSelectedVoicesDisplay() {
        const selectedVoices = this.voiceService.getSelectedVoiceWeights();
        this.elements.selectedVoices.innerHTML = selectedVoices
            .map(({voice, weight}) => {
                const pct = Math.round((weight / 10) * 100);
                return `
                <div class="voice-mixer-row">
                    <span class="voice-mixer-name" title="${voice}">${voice}</span>
                    <input type="range"
                           class="voice-mixer-slider"
                           min="0" max="100" step="1"
                           value="${pct}"
                           data-voice="${voice}"
                           title="Mix weight">
                    <span class="voice-mixer-pct" data-voice-pct="${voice}">${pct}%</span>
                    <button class="voice-mixer-remove remove-voice" data-voice="${voice}" title="Remove voice">×</button>
                </div>
            `})
            .join('');

        this.updateSearchPlaceholder();
    }

    updateSearchPlaceholder() {
        const hasSelected = this.voiceService.hasSelectedVoices();
        this.elements.voiceSearch.placeholder = hasSelected ? 
            'Search voices...' : 
            'Search and select voices...';
    }

    updateVoiceOptionState(voice, selected) {
        const voiceOption = this.elements.voiceOptions
            .querySelector(`[data-voice="${voice}"]`);
        if (voiceOption) {
            voiceOption.classList.toggle('selected', selected);
        }
    }

    _togglePreview(voice) {
        // If already playing this voice, stop it
        if (this._previewingVoice === voice && this._previewAudio) {
            this._previewAudio.pause();
            this._previewAudio.currentTime = 0;
            this._previewingVoice = null;
            this._updatePreviewButtons();
            return;
        }

        // Stop any current preview
        if (this._previewAudio) {
            this._previewAudio.pause();
            this._previewAudio.currentTime = 0;
        }

        // Build the sample URL relative to the web player root
        const sampleUrl = `voice_samples/${voice}.mp3`;
        this._previewAudio = new Audio(sampleUrl);
        this._previewingVoice = voice;
        this._updatePreviewButtons();

        this._previewAudio.addEventListener('ended', () => {
            this._previewingVoice = null;
            this._updatePreviewButtons();
        });

        this._previewAudio.addEventListener('error', () => {
            console.warn(`No voice sample available for ${voice}`);
            this._previewingVoice = null;
            this._updatePreviewButtons();
        });

        this._previewAudio.play().catch(() => {
            this._previewingVoice = null;
            this._updatePreviewButtons();
        });
    }

    _updatePreviewButtons() {
        this.elements.voiceOptions.querySelectorAll('.voice-preview-btn').forEach(btn => {
            const voice = btn.dataset.voice;
            const isPlaying = this._previewingVoice === voice;
            btn.classList.toggle('playing', isPlaying);
            btn.querySelector('svg').innerHTML = isPlaying
                ? '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>'
                : '<path d="M8 5v14l11-7z"/>';
        });
    }

    async initialize() {
        try {
            await this.voiceService.loadVoices();
            this.renderVoiceOptions(this.voiceService.getAvailableVoices());
            this.updateSelectedVoicesDisplay();
            return true;
        } catch (error) {
            console.error('Failed to initialize voice selector:', error);
            return false;
        }
    }
}

export default VoiceSelector;
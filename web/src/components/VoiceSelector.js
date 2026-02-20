export class VoiceSelector {
    constructor(voiceService) {
        this.voiceService = voiceService;
        this.elements = {
            voiceSearch: document.getElementById('voice-search'),
            voiceDropdown: document.getElementById('voice-dropdown'),
            voiceOptions: document.getElementById('voice-options'),
            selectedVoices: document.getElementById('selected-voices')
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Voice search focus
        this.elements.voiceSearch.addEventListener('focus', () => {
            this.elements.voiceDropdown.classList.add('show');
        });

        // Voice search
        this.elements.voiceSearch.addEventListener('input', (e) => {
            const filteredVoices = this.voiceService.filterVoices(e.target.value);
            this.renderVoiceOptions(filteredVoices);
        });

        // Voice selection - handle clicks on the entire voice option
        this.elements.voiceOptions.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur on search input
            
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
        this.elements.voiceOptions.innerHTML = voices
            .map(voice => `
                <div class="voice-option ${this.voiceService.getSelectedVoices().includes(voice) ? 'selected' : ''}" 
                     data-voice="${voice}">
                    ${voice}
                </div>
            `)
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
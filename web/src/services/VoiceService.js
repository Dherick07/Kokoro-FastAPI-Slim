import { config } from '../config.js';

export class VoiceService {
    constructor() {
        this.availableVoices = [];
        this.selectedVoices = new Map(); // Changed to Map to store voice:weight pairs
        this._voiceSamplesAvailable = new Set(); // Voices that have pre-generated samples
    }

    async loadVoices() {
        try {
            const apiUrl = await config.getApiUrl('/v1/audio/voices');
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail?.message || 'Failed to load voices');
            }
            
            const data = await response.json();
            if (!data.voices?.length) {
                throw new Error('No voices available');
            }

            this.availableVoices = data.voices;
            
            // Select first voice if none selected
            if (this.selectedVoices.size === 0) {
                const firstVoice = this.availableVoices.find(voice => voice && voice.trim());
                if (firstVoice) {
                    this.addVoice(firstVoice);
                }
            }

            // Load voice sample manifest (await so play buttons render immediately)
            await this._loadVoiceSamples();

            return this.availableVoices;
        } catch (error) {
            console.error('Failed to load voices:', error);
            throw error;
        }
    }

    async _loadVoiceSamples() {
        // Load manifest of available voice samples (single request, no 500s)
        try {
            const resp = await fetch('voice_samples/manifest.json');
            if (resp.ok) {
                const voices = await resp.json();
                for (const v of voices) {
                    this._voiceSamplesAvailable.add(v);
                }
            }
        } catch { /* ignore — play buttons just won't show */ }
    }

    getVoiceSamplesAvailable() {
        return this._voiceSamplesAvailable;
    }

    getAvailableVoices() {
        return this.availableVoices;
    }

    getSelectedVoices() {
        return Array.from(this.selectedVoices.keys());
    }

    getSelectedVoiceWeights() {
        return Array.from(this.selectedVoices.entries()).map(([voice, weight]) => ({
            voice,
            weight
        }));
    }

    getSelectedVoiceString() {
        const entries = Array.from(this.selectedVoices.entries());
        
        // If only one voice with weight 1, return just the voice name
        if (entries.length === 1 && entries[0][1] === 1) {
            return entries[0][0];
        }
        
        // Otherwise return voice(weight) format
        return entries
            .map(([voice, weight]) => `${voice}(${weight})`)
            .join('+');
    }

    addVoice(voice, weight = 1) {
        if (this.availableVoices.includes(voice)) {
            this.selectedVoices.set(voice, parseFloat(weight) || 1);
            return true;
        }
        return false;
    }

    updateWeight(voice, weight) {
        if (this.selectedVoices.has(voice)) {
            this.selectedVoices.set(voice, parseFloat(weight) || 1);
            return true;
        }
        return false;
    }

    removeVoice(voice) {
        return this.selectedVoices.delete(voice);
    }

    clearSelectedVoices() {
        this.selectedVoices.clear();
    }

    filterVoices(searchTerm) {
        if (!searchTerm) {
            return this.availableVoices;
        }
        
        const term = searchTerm.toLowerCase();
        return this.availableVoices.filter(voice => 
            voice.toLowerCase().includes(term)
        );
    }

    hasSelectedVoices() {
        return this.selectedVoices.size > 0;
    }
}

export default VoiceService;
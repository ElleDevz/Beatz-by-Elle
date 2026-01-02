// ============================================
// PROFESSIONAL DJ BEAT MACHINE
// ============================================

// Get all drum pad buttons
const buttons = document.querySelectorAll('.drum-container button');

// Get all audio elements
const audios = document.querySelectorAll('audio');

// INSTANT PLAYBACK: Preload all audio files immediately
audios.forEach(audio => {
  audio.preload = 'auto';
  audio.load();
});

// Get control elements
const volumeSlider = document.getElementById('volume');
const metroVolumeSlider = document.getElementById('metro-volume');
const bpmSlider = document.getElementById('bpm');
const bpmValue = document.getElementById('bpm-value');
const metronomeToggle = document.getElementById('metronome-toggle');
const recordToggle = document.getElementById('record-toggle');
const loopToggle = document.getElementById('loop-toggle');

// Sequencer elements
const playSequence = document.getElementById('play-sequence');
const stopSequence = document.getElementById('stop-sequence');
const clearSequence = document.getElementById('clear-sequence');
const sequencerGrid = document.getElementById('sequencer-grid');

// Effects elements
const reverbSlider = document.getElementById('reverb');
const delaySlider = document.getElementById('delay');
const filterSlider = document.getElementById('filter');
const reverbValue = document.getElementById('reverb-value');
const delayValue = document.getElementById('delay-value');
const filterValue = document.getElementById('filter-value');

// State variables
let metronomeOn = false;
let metronomeInterval;
let currentBpm = 120;
let isRecording = false;
let isLooping = false;
let recordedPattern = [];
let recordStartTime = null;

// Sequencer state
let isPlaying = false;
let currentStep = 0;
let sequencerInterval;
const sequencerData = {
  kick: Array(16).fill(false),
  snare: Array(16).fill(false),
  hihat: Array(16).fill(false),
  openhat: Array(16).fill(false),
  clap: Array(16).fill(false),
  tom: Array(16).fill(false),
  ride: Array(16).fill(false),
  tink: Array(16).fill(false)
};

// Audio Context for effects (shared with synthesizer) - initialized below with buffer system
let masterGain;
let reverbNode;
let delayNode;
let filterNode;

// NOTE: initAudioContext() is defined below with the buffer pre-rendering system

function createReverbImpulse() {
  if (!audioContext || !reverbNode) return; // Guard against early call
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * 2;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }
  }
  
  reverbNode.buffer = impulse;
}

// Master volume control
volumeSlider.addEventListener('input', () => {
  const volume = volumeSlider.value;
  
  // Control synthesizer master gain
  if (masterGain) {
    masterGain.gain.value = volume;
  }
  
  // Also control audio elements (for metronome, etc)
  audios.forEach(audio => {
    if (audio.dataset.key !== 'metronome') {
      audio.volume = volume;
    }
  });
});

// Metronome volume control
metroVolumeSlider.addEventListener('input', () => {
  const metroVolume = metroVolumeSlider.value;
  const metronomeAudio = document.querySelector('audio[data-key="metronome"]');
  if (metronomeAudio) {
    metronomeAudio.volume = metroVolume;
  }
});

// BPM control
bpmSlider.addEventListener('input', () => {
  currentBpm = bpmSlider.value;
  bpmValue.textContent = currentBpm;
  
  // Restart metronome with new BPM if it's running
  if (metronomeOn) {
    clearInterval(metronomeInterval);
    startMetronome();
  }
  
  // Restart sequencer with new BPM if playing
  if (isPlaying) {
    clearInterval(sequencerInterval);
    startSequencer();
  }
});

// Function to play sound - PROFESSIONAL METHOD: Clone for polyphony
function playSound(soundKey) {
  const button = document.querySelector(`button[data-sound="${soundKey}"]`);
  
  // FASTEST: Clone audio for instant polyphonic playback
  const audio = document.querySelector(`audio[data-key="${soundKey}"]`);
  if (audio) {
    const clone = audio.cloneNode();
    clone.volume = audio.volume;
    clone.play(); // INSTANT - no currentTime reset needed
  }
  
  if (button) {
    button.classList.add('active');
    // Instant visual feedback
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        button.classList.remove('active');
      });
    });
  }
  
  // Record if recording is active
  if (isRecording) {
    const timestamp = Date.now() - recordStartTime;
    recordedPattern.push({ soundKey, timestamp });
  }
}

// Click event for drum pads
buttons.forEach(button => {
  button.addEventListener('click', () => {
    // Pre-initialize audio context on first click for zero latency
    initAudioContext();
    
    const sound = button.dataset.sound;
    if (sound) {
      playSound(sound);
    }
  });
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
  // Pre-initialize audio context on first keypress for zero latency
  initAudioContext();
  
  const key = e.key.toLowerCase();
  
  const keyMap = {
    'k': 'kick',
    'n': 'snare',
    'h': 'hihat',
    'p': 'openhat',
    'l': 'clap',
    'm': 'tom',
    'j': 'ride',
    'i': 'tink'
  };
  
  if (keyMap[key]) {
    playSound(keyMap[key]);
  }
});

// Metronome functions
function startMetronome() {
  const interval = (60 / currentBpm) * 1000;
  metronomeInterval = setInterval(() => {
    playMetronomeClick();
  }, interval);
}

function stopMetronome() {
  clearInterval(metronomeInterval);
}

function playMetronomeClick() {
  const metronomeAudio = document.querySelector('audio[data-key="metronome"]');
  if (metronomeAudio) {
    metronomeAudio.currentTime = 0;
    metronomeAudio.play();
  }
  
  buttons.forEach(button => {
    button.classList.add('pulse');
    setTimeout(() => {
      button.classList.remove('pulse');
    }, 100);
  });
}

// Metronome toggle button
metronomeToggle.addEventListener('click', () => {
  metronomeOn = !metronomeOn;
  
  if (metronomeOn) {
    startMetronome();
    metronomeToggle.classList.add('active');
    metronomeToggle.textContent = 'Stop';
  } else {
    stopMetronome();
    metronomeToggle.classList.remove('active');
    metronomeToggle.textContent = 'Metronome';
  }
});

// ============================================
// SEQUENCER FUNCTIONALITY
// ============================================

// Initialize sequencer grid
function initSequencer() {
  const sounds = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'tom', 'ride', 'tink'];
  
  sounds.forEach(sound => {
    // Add track label
    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = sound;
    sequencerGrid.appendChild(label);
    
    // Add 16 steps for this track
    for (let i = 0; i < 16; i++) {
      const step = document.createElement('div');
      step.className = 'step';
      step.dataset.sound = sound;
      step.dataset.step = i;
      
      step.addEventListener('click', () => {
        sequencerData[sound][i] = !sequencerData[sound][i];
        step.classList.toggle('active');
      });
      
      sequencerGrid.appendChild(step);
    }
  });
}

// Start sequencer
function startSequencer() {
  const stepDuration = (60 / currentBpm) * 1000 / 4; // 16th notes
  
  sequencerInterval = setInterval(() => {
    // Remove playing class from all steps
    document.querySelectorAll('.step').forEach(step => {
      if (parseInt(step.dataset.step) === currentStep) {
        step.classList.remove('playing');
      }
    });
    
    // Move to next step
    currentStep = (currentStep + 1) % 16;
    
    // Play sounds for current step
    Object.keys(sequencerData).forEach(sound => {
      if (sequencerData[sound][currentStep]) {
        playSound(sound);
      }
    });
    
    // Highlight current step
    document.querySelectorAll('.step').forEach(step => {
      if (parseInt(step.dataset.step) === currentStep) {
        step.classList.add('playing');
      }
    });
  }, stepDuration);
}

// Sequencer controls
playSequence.addEventListener('click', () => {
  if (!audioContext) initAudioContext();
  
  if (!isPlaying) {
    isPlaying = true;
    currentStep = -1;
    startSequencer();
    playSequence.classList.add('active');
    playSequence.textContent = '⏸ Pause';
  } else {
    isPlaying = false;
    clearInterval(sequencerInterval);
    playSequence.classList.remove('active');
    playSequence.textContent = '▶ Play';
    
    // Remove playing highlights
    document.querySelectorAll('.step').forEach(step => {
      step.classList.remove('playing');
    });
  }
});

stopSequence.addEventListener('click', () => {
  isPlaying = false;
  clearInterval(sequencerInterval);
  currentStep = 0;
  playSequence.classList.remove('active');
  playSequence.textContent = '▶ Play';
  
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('playing');
  });
});

clearSequence.addEventListener('click', () => {
  Object.keys(sequencerData).forEach(sound => {
    sequencerData[sound] = Array(16).fill(false);
  });
  
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
});

// ============================================
// RECORDING & LOOP FUNCTIONALITY
// ============================================

recordToggle.addEventListener('click', () => {
  if (!audioContext) initAudioContext();
  
  isRecording = !isRecording;
  
  if (isRecording) {
    recordedPattern = [];
    recordStartTime = Date.now();
    recordToggle.classList.add('active');
    recordToggle.textContent = '⏹ Stop Rec';
  } else {
    recordToggle.classList.remove('active');
    recordToggle.textContent = '⏺ Record';
    
    // Enable loop button if we have recorded pattern
    if (recordedPattern.length > 0) {
      loopToggle.disabled = false;
    }
  }
});

loopToggle.addEventListener('click', () => {
  if (!audioContext) initAudioContext();
  
  isLooping = !isLooping;
  
  if (isLooping && recordedPattern.length > 0) {
    loopToggle.classList.add('active');
    loopToggle.textContent = '⏹ Stop Loop';
    playRecordedLoop();
  } else {
    isLooping = false;
    loopToggle.classList.remove('active');
    loopToggle.textContent = '🔁 Loop';
  }
});

function playRecordedLoop() {
  if (!isLooping || recordedPattern.length === 0) return;
  
  let loopIndex = 0;
  const startTime = Date.now();
  
  function playNextNote() {
    if (!isLooping) return;
    
    const pattern = recordedPattern[loopIndex];
    const elapsed = Date.now() - startTime;
    
    if (elapsed >= pattern.timestamp) {
      playSound(pattern.soundKey);
      loopIndex++;
      
      if (loopIndex >= recordedPattern.length) {
        loopIndex = 0;
        playRecordedLoop(); // Restart loop
        return;
      }
    }
    
    requestAnimationFrame(playNextNote);
  }
  
  playNextNote();
}

// ============================================
// EFFECTS CONTROLS
// ============================================

reverbSlider.addEventListener('input', () => {
  const value = reverbSlider.value;
  reverbValue.textContent = value + '%';
  // Reverb implementation would require Web Audio API routing
});

delaySlider.addEventListener('input', () => {
  const value = delaySlider.value;
  delayValue.textContent = value + '%';
  
  if (audioContext) {
    delayNode.delayTime.value = (value / 100) * 0.5; // Max 0.5s delay
  }
});

filterSlider.addEventListener('input', () => {
  const value = filterSlider.value;
  filterValue.textContent = value + '%';
  
  if (audioContext) {
    // Map 0-100 to 100Hz-20000Hz logarithmically
    const minFreq = 100;
    const maxFreq = 20000;
    const frequency = minFreq * Math.pow(maxFreq / minFreq, value / 100);
    filterNode.frequency.value = frequency;
  }
});

// ============================================
// PRODUCER ELEMENTS - JAVASCRIPT FUNCTIONALITY
// ============================================

// Mixer Elements
const channelVolumes = document.querySelectorAll('.channel-volume');
const channelPans = document.querySelectorAll('.channel-pan');
const muteButtons = document.querySelectorAll('.mute-btn');
const soloButtons = document.querySelectorAll('.solo-btn');

// EQ Elements
const eqLow = document.getElementById('eq-low');
const eqMid = document.getElementById('eq-mid');
const eqHigh = document.getElementById('eq-high');
const eqLowValue = document.getElementById('eq-low-value');
const eqMidValue = document.getElementById('eq-mid-value');
const eqHighValue = document.getElementById('eq-high-value');

// Compressor Elements
const compThreshold = document.getElementById('comp-threshold');
const compRatio = document.getElementById('comp-ratio');
const compAttack = document.getElementById('comp-attack');
const compRelease = document.getElementById('comp-release');
const compToggle = document.getElementById('comp-toggle');
const compThresholdValue = document.getElementById('comp-threshold-value');
const compRatioValue = document.getElementById('comp-ratio-value');
const compAttackValue = document.getElementById('comp-attack-value');
const compReleaseValue = document.getElementById('comp-release-value');

// Mixer State - Tracks which channels are muted or soloed
const mixerState = {
  muted: [], // Array of muted sound names
  soloed: [] // Array of soloed sound names
};

// Compressor State
let compressorActive = false;

// ============================================
// MIXER CHANNEL CONTROLS
// ============================================

// Channel Volume Faders - Control individual sound volumes
channelVolumes.forEach(fader => {
  fader.addEventListener('input', () => {
    const soundName = fader.dataset.sound;
    const volume = fader.value;
    const audio = document.querySelector(`audio[data-key="${soundName}"]`);
    
    // Update audio volume (if not muted)
    if (audio && !mixerState.muted.includes(soundName)) {
      audio.volume = volume * volumeSlider.value; // Combine with master volume
    }
    
    // Update displayed value
    const valueDisplay = fader.nextElementSibling;
    if (valueDisplay && valueDisplay.classList.contains('fader-value')) {
      valueDisplay.textContent = Math.round(volume * 100) + '%';
    }
  });
});

// Channel Pan Controls - Control stereo positioning
channelPans.forEach(pan => {
  pan.addEventListener('input', () => {
    const soundName = pan.dataset.sound;
    const panValue = parseFloat(pan.value);
    
    // Pan implementation would require Web Audio API
    // This is a placeholder for stereo panning
    console.log(`${soundName} panned to: ${panValue}`);
    
    // Web Audio API stereo panner example:
    // if (audioContext) {
    //   const pannerNode = audioContext.createStereoPanner();
    //   pannerNode.pan.value = panValue;
    //   // Connect audio source to panner to destination
    // }
  });
});

// Mute Buttons - Silence individual channels
muteButtons.forEach(button => {
  button.addEventListener('click', () => {
    const soundName = button.dataset.sound;
    const audio = document.querySelector(`audio[data-key="${soundName}"]`);
    
    // Toggle mute state
    if (mixerState.muted.includes(soundName)) {
      // Unmute
      mixerState.muted = mixerState.muted.filter(s => s !== soundName);
      button.classList.remove('active');
      
      // Restore volume
      const volumeFader = document.querySelector(`.channel-volume[data-sound="${soundName}"]`);
      if (audio && volumeFader) {
        audio.volume = volumeFader.value * volumeSlider.value;
      }
    } else {
      // Mute
      mixerState.muted.push(soundName);
      button.classList.add('active');
      
      // Set volume to 0
      if (audio) {
        audio.volume = 0;
      }
    }
  });
});

// Solo Buttons - Listen to only one channel
soloButtons.forEach(button => {
  button.addEventListener('click', () => {
    const soundName = button.dataset.sound;
    
    // Toggle solo state
    if (mixerState.soloed.includes(soundName)) {
      // Unsolo
      mixerState.soloed = mixerState.soloed.filter(s => s !== soundName);
      button.classList.remove('active');
    } else {
      // Solo
      mixerState.soloed.push(soundName);
      button.classList.add('active');
    }
    
    // Update all channel volumes based on solo state
    updateMixerVolumes();
  });
});

// Update all mixer volumes based on solo/mute state
function updateMixerVolumes() {
  audios.forEach(audio => {
    const soundName = audio.dataset.key;
    if (soundName === 'metronome') return; // Skip metronome
    
    const volumeFader = document.querySelector(`.channel-volume[data-sound="${soundName}"]`);
    if (!volumeFader) return;
    
    // If any channel is soloed, mute all others
    if (mixerState.soloed.length > 0) {
      if (mixerState.soloed.includes(soundName)) {
        // This channel is soloed - play at normal volume
        audio.volume = volumeFader.value * volumeSlider.value;
      } else {
        // This channel is not soloed - mute it
        audio.volume = 0;
      }
    } else if (mixerState.muted.includes(soundName)) {
      // Channel is muted
      audio.volume = 0;
    } else {
      // Normal volume
      audio.volume = volumeFader.value * volumeSlider.value;
    }
  });
}

// ============================================
// EQ CONTROLS - 3-Band Equalizer
// ============================================

// Low Band EQ (Bass frequencies)
eqLow.addEventListener('input', () => {
  const value = eqLow.value;
  eqLowValue.textContent = (value > 0 ? '+' : '') + value + 'dB';
  
  // EQ implementation would require Web Audio API BiquadFilter
  console.log(`Low EQ: ${value}dB`);
});

// Mid Band EQ (Middle frequencies)
eqMid.addEventListener('input', () => {
  const value = eqMid.value;
  eqMidValue.textContent = (value > 0 ? '+' : '') + value + 'dB';
  
  console.log(`Mid EQ: ${value}dB`);
});

// High Band EQ (Treble frequencies)
eqHigh.addEventListener('input', () => {
  const value = eqHigh.value;
  eqHighValue.textContent = (value > 0 ? '+' : '') + value + 'dB';
  
  console.log(`High EQ: ${value}dB`);
});

// ============================================
// COMPRESSOR CONTROLS - Master Dynamics
// ============================================

// Threshold - Level where compression starts
compThreshold.addEventListener('input', () => {
  const value = compThreshold.value;
  compThresholdValue.textContent = value + 'dB';
  
  console.log(`Compressor Threshold: ${value}dB`);
});

// Ratio - Amount of compression applied
compRatio.addEventListener('input', () => {
  const value = compRatio.value;
  compRatioValue.textContent = value + ':1';
  
  console.log(`Compressor Ratio: ${value}:1`);
});

// Attack - How quickly compression engages
compAttack.addEventListener('input', () => {
  const value = compAttack.value;
  compAttackValue.textContent = value + 'ms';
  
  console.log(`Compressor Attack: ${value}ms`);
});

// Release - How quickly compression disengages
compRelease.addEventListener('input', () => {
  const value = compRelease.value;
  compReleaseValue.textContent = value + 'ms';
  
  console.log(`Compressor Release: ${value}ms`);
});

// Compressor Toggle - Turn compressor on/off
compToggle.addEventListener('click', () => {
  compressorActive = !compressorActive;
  
  if (compressorActive) {
    compToggle.classList.add('active');
    compToggle.textContent = 'Compressor: ON';
    console.log('Compressor enabled');
    
    // Web Audio API compressor implementation:
    // if (audioContext) {
    //   const compressor = audioContext.createDynamicsCompressor();
    //   compressor.threshold.value = parseFloat(compThreshold.value);
    //   compressor.ratio.value = parseFloat(compRatio.value);
    //   compressor.attack.value = parseFloat(compAttack.value) / 1000;
    //   compressor.release.value = parseFloat(compRelease.value) / 1000;
    //   // Connect to audio chain
    // }
  } else {
    compToggle.classList.remove('active');
    compToggle.textContent = 'Compressor: OFF';
    console.log('Compressor disabled');
  }
});

// ============================================
// INITIALIZATION
// ============================================

// Initialize sequencer on load
initSequencer();

// Initialize volumes
volumeSlider.dispatchEvent(new Event('input'));
metroVolumeSlider.dispatchEvent(new Event('input'));

// Initialize all fader displays on page load
channelVolumes.forEach(fader => {
  const event = new Event('input');
  fader.dispatchEvent(event);
});

// ============================================
// SYNTHESIZER ENGINE - Generate copyright-free sounds
// ============================================

// Audio Context for synthesis - initialize immediately for zero latency
let audioContext = null;

// PRE-RENDERED BUFFER CACHE for instant playback
const audioBufferCache = {};
let buffersReady = false;

// Initialize AudioContext - SIMPLE AND WORKING
function initAudioContext() {
  if (!audioContext) {
    // Create context
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 44100
    });
    
    // Initialize effects nodes
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    
    reverbNode = audioContext.createConvolver();
    delayNode = audioContext.createDelay(5.0);
    const delayFeedback = audioContext.createGain();
    const delayWet = audioContext.createGain();
    
    filterNode = audioContext.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 20000;
    
    // Connect effects chain
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(masterGain);
    
    // Create reverb impulse
    createReverbImpulse();
  }
  return audioContext;
}

// PRE-RENDER all drum sounds into buffers for INSTANT playback
function preRenderDrumBuffers() {
  if (buffersReady) return;
  
  const ctx = audioContext;
  const soundGenerators = {
    kick: renderKickBuffer,
    snare: renderSnareBuffer,
    hihat: renderHihatBuffer,
    openhat: renderOpenhatBuffer,
    clap: renderClapBuffer,
    tom: renderTomBuffer,
    ride: renderRideBuffer,
    tink: renderTinkBuffer
  };
  
  // Render each sound into a buffer
  Object.keys(soundGenerators).forEach(soundName => {
    audioBufferCache[soundName] = soundGenerators[soundName](ctx);
  });
  
  buffersReady = true;
  console.log('🎵 Audio buffers pre-rendered - ZERO LATENCY MODE ACTIVE');
}

// INSTANT playback from pre-rendered buffers
function playBufferedSound(soundName) {
  if (!buffersReady || !audioBufferCache[soundName]) {
    // Fallback to synthesis if buffers not ready
    playSynthSound(soundName);
    return;
  }
  
  const ctx = audioContext;
  const source = ctx.createBufferSource();
  source.buffer = audioBufferCache[soundName];
  
  // Get channel volume and mute/solo state
  const channelVolume = channelVolumes[soundName] || 0.8;
  const isMuted = mutedChannels.has(soundName);
  const hasSolo = soloChannels.size > 0;
  const isSoloed = soloChannels.has(soundName);
  
  // Calculate final volume
  let finalVolume = channelVolume;
  if (isMuted || (hasSolo && !isSoloed)) {
    finalVolume = 0;
  }
  
  const gain = ctx.createGain();
  gain.gain.value = finalVolume;
  
  source.connect(gain);
  gain.connect(masterGain);
  
  // INSTANT start - ZERO delay
  source.start(ctx.currentTime);
}

// ============================================
// DRUM SYNTHESIZER - Create original drum sounds
// ============================================

// PRE-RENDER BUFFER FUNCTIONS - Generate audio buffers offline for instant playback

function renderKickBuffer(ctx) {
  const duration = 0.5;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const freq = 150 * Math.exp(-t * 6); // Pitch sweep
    const env = Math.exp(-t * 5); // Amplitude envelope
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
  }
  
  return buffer;
}

function renderSnareBuffer(ctx) {
  const duration = 0.2;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 15);
    const tone = Math.sin(2 * Math.PI * 180 * t) * 0.3;
    const noise = (Math.random() * 2 - 1) * 0.7;
    data[i] = (tone + noise) * env * 0.6;
  }
  
  return buffer;
}

function renderHihatBuffer(ctx) {
  const duration = 0.08;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 50);
    data[i] = (Math.random() * 2 - 1) * env * 0.3;
  }
  
  return buffer;
}

function renderOpenhatBuffer(ctx) {
  const duration = 0.3;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 8);
    data[i] = (Math.random() * 2 - 1) * env * 0.3;
  }
  
  return buffer;
}

function renderClapBuffer(ctx) {
  const duration = 0.1;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 30);
    const burst1 = t < 0.01 ? 1 : 0;
    const burst2 = (t >= 0.01 && t < 0.02) ? 1 : 0;
    const burst3 = (t >= 0.02 && t < 0.03) ? 1 : 0;
    data[i] = (Math.random() * 2 - 1) * (burst1 + burst2 + burst3) * env * 0.65;
  }
  
  return buffer;
}

function renderTomBuffer(ctx) {
  const duration = 0.4;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const freq = 200 * Math.exp(-t * 4);
    const env = Math.exp(-t * 8);
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
  }
  
  return buffer;
}

function renderRideBuffer(ctx) {
  const duration = 0.5;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 3);
    const metallic = Math.sin(2 * Math.PI * 1200 * t) * 0.3;
    const noise = (Math.random() * 2 - 1) * 0.2;
    data[i] = (metallic + noise) * env * 0.4;
  }
  
  return buffer;
}

function renderTinkBuffer(ctx) {
  const duration = 0.1;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 40);
    data[i] = Math.sin(2 * Math.PI * 3000 * t) * env * 0.5;
  }
  
  return buffer;
}

// Synthesize Kick Drum
function synthKick(time = 0) {
  const ctx = initAudioContext();
  
  // Create oscillator for the punch
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  // Start at 150Hz and sweep down to 40Hz for that bass thump
  osc.frequency.setValueAtTime(150, ctx.currentTime + time);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + time + 0.5);
  
  // Shape the volume envelope
  gain.gain.setValueAtTime(1, ctx.currentTime + time);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.5);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + 0.5);
}

// Synthesize Snare Drum
function synthSnare(time = 0) {
  const ctx = initAudioContext();
  
  // Oscillator for the body (triangle wave)
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(100, ctx.currentTime + time);
  
  // Noise for the snare crack
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1; // White noise
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  // Gain envelopes
  const oscGain = ctx.createGain();
  const noiseGain = ctx.createGain();
  
  oscGain.gain.setValueAtTime(0.7, ctx.currentTime + time);
  oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.2);
  
  noiseGain.gain.setValueAtTime(1, ctx.currentTime + time);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.2);
  
  osc.connect(oscGain);
  noise.connect(noiseGain);
  
  // Filter the noise for realistic snare tone
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;
  
  noiseGain.connect(filter);
  filter.connect(ctx.destination);
  oscGain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  noise.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + 0.2);
  noise.stop(ctx.currentTime + time + 0.2);
}

// Synthesize Hi-Hat
function synthHihat(time = 0, open = false) {
  const ctx = initAudioContext();
  
  // Create noise for metallic sound
  const bufferSize = ctx.sampleRate * (open ? 0.5 : 0.1);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  // Highpass filter for metallic tone
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 7000;
  
  // Bandpass for resonance
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 10000;
  bandpass.Q.value = 1;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, ctx.currentTime + time);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + (open ? 0.5 : 0.1));
  
  noise.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(ctx.destination);
  
  noise.start(ctx.currentTime + time);
  noise.stop(ctx.currentTime + time + (open ? 0.5 : 0.1));
}

// Synthesize Clap
function synthClap(time = 0) {
  const ctx = initAudioContext();
  
  // Multiple short bursts of noise for hand clap - optimized for instant response
  for (let i = 0; i < 3; i++) {
    const delay = i * 0.01; // Reduced from 0.03 to 0.01 for tighter, more immediate response
    
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    
    for (let j = 0; j < noiseData.length; j++) {
      noiseData[j] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1500;
    bandpass.Q.value = 2;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, ctx.currentTime + time + delay);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + delay + 0.04);
    
    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(ctx.currentTime + time + delay);
    noise.stop(ctx.currentTime + time + delay + 0.04);
  }
}

// Synthesize Tom
function synthTom(time = 0) {
  const ctx = initAudioContext();
  
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  
  // Pitch sweep for tom sound
  osc.frequency.setValueAtTime(200, ctx.currentTime + time);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + time + 0.3);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, ctx.currentTime + time);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + 0.3);
}

// Synthesize Ride Cymbal
function synthRide(time = 0) {
  const ctx = initAudioContext();
  
  // Multiple oscillators for metallic tone
  const frequencies = [800, 1000, 1250, 1600];
  
  frequencies.forEach(freq => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime + time);
    osc.stop(ctx.currentTime + time + 0.4);
  });
}

// Synthesize Tink/Cowbell
function synthTink(time = 0) {
  const ctx = initAudioContext();
  
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 800;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, ctx.currentTime + time);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.2);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + 0.2);
}

// Master synthesizer router
function playSynthSound(soundName) {
  initAudioContext(); // Ensure context is initialized
  
  // Use immediate scheduling for lowest latency
  const now = audioContext.currentTime;
  
  switch(soundName) {
    case 'kick':
      synthKick(0);
      break;
    case 'snare':
      synthSnare(0);
      break;
    case 'hihat':
      synthHihat(0, false);
      break;
    case 'openhat':
      synthHihat(0, true);
      break;
    case 'clap':
      synthClap(0);
      break;
    case 'tom':
      synthTom(0);
      break;
    case 'ride':
      synthRide(0);
      break;
    case 'tink':
      synthTink(0);
      break;
  }
}

// ============================================
// MELODIC INSTRUMENTS - Bass, Keys, Leads
// ============================================

// Synthesize Bass Note
function synthBass(note, duration = 0.5, time = 0) {
  const ctx = initAudioContext();
  
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = note;
  
  // Lowpass filter for warmth
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 5;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, ctx.currentTime + time);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + duration);
}

// Synthesize Piano/Keys Note
function synthKeys(note, duration = 0.5, time = 0) {
  const ctx = initAudioContext();
  
  // Two oscillators for richer sound
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  
  osc1.type = 'sine';
  osc2.type = 'triangle';
  
  osc1.frequency.value = note;
  osc2.frequency.value = note * 2; // Octave above
  
  const gain1 = ctx.createGain();
  const gain2 = ctx.createGain();
  
  gain1.gain.setValueAtTime(0.3, ctx.currentTime + time);
  gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  gain2.gain.setValueAtTime(0.1, ctx.currentTime + time);
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  osc1.connect(gain1);
  osc2.connect(gain2);
  gain1.connect(ctx.destination);
  gain2.connect(ctx.destination);
  
  osc1.start(ctx.currentTime + time);
  osc2.start(ctx.currentTime + time);
  osc1.stop(ctx.currentTime + time + duration);
  osc2.stop(ctx.currentTime + time + duration);
}

// Synthesize Lead Synth Note
function synthLead(note, duration = 0.5, time = 0) {
  const ctx = initAudioContext();
  
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = note;
  
  // Highpass for brightness
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, ctx.currentTime + time);
  filter.frequency.linearRampToValueAtTime(note * 4, ctx.currentTime + time + 0.1);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime + time);
  gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + time + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + duration);
}

// Note frequency map (MIDI-like)
const noteFrequencies = {
  'A0': 27.50, 'A#0': 29.14, 'B0': 30.87,
  'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
  'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53,
  'C7': 2093.00, 'C#7': 2217.46, 'D7': 2349.32
};

// ============================================
// SOUND MODE TOGGLE - Switch between samples and synth
// ============================================

let useSynth = true; // Start with synthesized sounds (copyright-free)

function toggleSoundMode() {
  useSynth = !useSynth;
  console.log(`Sound mode: ${useSynth ? 'Synthesizer' : 'Samples'}`);
}

// ============================================
// INSTRUMENTS FUNCTIONALITY
// ============================================

// Get instrument elements
const instrumentButtons = document.querySelectorAll('.instrument-btn');
const instrumentKeys = document.querySelectorAll('.instrument-keyboard .key');

// Track current instrument
let currentInstrument = 'bass';

// Instrument selection
instrumentButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove active class from all buttons
    instrumentButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active to clicked button
    button.classList.add('active');
    
    // Update current instrument
    currentInstrument = button.dataset.instrument;
    console.log(`Switched to ${currentInstrument} instrument`);
  });
});

// Play instrument notes
instrumentKeys.forEach(key => {
  // Click handler
  key.addEventListener('click', () => {
    playInstrumentNote(key.dataset.note);
    
    // Visual feedback
    key.classList.add('active');
    setTimeout(() => {
      key.classList.remove('active');
    }, 200);
  });
});

// Keyboard controls for instruments
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  
  // Find matching instrument key
  const instrumentKey = document.querySelector(`.instrument-keyboard .key[data-key="${key}"]`);
  
  if (instrumentKey && !e.repeat) {
    const note = instrumentKey.dataset.note;
    playInstrumentNote(note);
    
    // Visual feedback - instant
    instrumentKey.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        instrumentKey.classList.remove('active');
      });
    });
  }
});

// Play note based on current instrument
function playInstrumentNote(noteName) {
  const frequency = noteFrequencies[noteName];
  
  if (!frequency) {
    console.error(`Note ${noteName} not found`);
    return;
  }
  
  switch(currentInstrument) {
    case 'bass':
      synthBass(frequency, 0.8);
      break;
    case 'keys':
      synthKeys(frequency, 0.6);
      break;
    case 'lead':
      synthLead(frequency, 0.5);
      break;
  }
}

// ============================================
// OCTAVE CONTROL
// ============================================

let currentOctave = 3; // Default octave

const octaveSlider = document.getElementById('octave-slider');
const octaveValue = document.getElementById('octave-value');

if (octaveSlider && octaveValue) {
  octaveSlider.addEventListener('input', (e) => {
    currentOctave = parseInt(e.target.value);
    octaveValue.textContent = currentOctave;
    updateKeyboardOctave();
  });
}

// Keyboard number keys (1-6) to change octave
document.addEventListener('keydown', (e) => {
  // Check if it's a number key 1-6 and not being used for other inputs
  if (e.key >= '1' && e.key <= '6' && !e.target.matches('input, textarea')) {
    const newOctave = parseInt(e.key);
    currentOctave = newOctave;
    
    // Update slider and display
    if (octaveSlider) {
      octaveSlider.value = newOctave;
    }
    if (octaveValue) {
      octaveValue.textContent = newOctave;
    }
    
    updateKeyboardOctave();
    
    // Visual feedback - flash the octave control
    const octaveControl = document.querySelector('.octave-control');
    if (octaveControl) {
      octaveControl.style.borderColor = 'rgba(0, 217, 199, 0.8)';
      octaveControl.style.boxShadow = '0 0 20px rgba(0, 217, 199, 0.6)';
      setTimeout(() => {
        octaveControl.style.borderColor = 'rgba(0, 179, 164, 0.3)';
        octaveControl.style.boxShadow = 'none';
      }, 200);
    }
  }
});

function updateKeyboardOctave() {
  const instrumentKeys = document.querySelectorAll('.instrument-keyboard .key');
  
  instrumentKeys.forEach(key => {
    const currentNote = key.dataset.note;
    // Extract note name without octave (e.g., "C#" from "C#3")
    const noteName = currentNote.replace(/[0-9]/g, '');
    // Create new note with current octave
    const newNote = noteName + currentOctave;
    
    // Update data-note attribute
    key.dataset.note = newNote;
    
    // Update display text (first part, keep the key letter)
    const noteDisplay = key.childNodes[0];
    if (noteDisplay && noteDisplay.nodeType === Node.TEXT_NODE) {
      key.childNodes[0].textContent = noteName;
    } else {
      // If structure is different, update the text content before <br>
      const html = key.innerHTML;
      const parts = html.split('<br>');
      if (parts.length > 0) {
        parts[0] = noteName;
        key.innerHTML = parts.join('<br>');
      }
    }
  });
  
  console.log(`Keyboard octave changed to ${currentOctave}`);
}

// ============================================
// SOUND MODE TOGGLE BUTTON
// ============================================

// Add toggle button to control panel
const soundModeToggle = document.createElement('button');
soundModeToggle.id = 'sound-mode-toggle';
soundModeToggle.textContent = '🎹 Synth Mode';
soundModeToggle.style.cssText = 'background: linear-gradient(135deg, #00b3a4, #00d9c7); border: none; padding: 10px 20px; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; margin: 5px;';

soundModeToggle.addEventListener('click', () => {
  toggleSoundMode();
  soundModeToggle.textContent = useSynth ? '🎹 Synth Mode' : '🎵 Sample Mode';
  soundModeToggle.style.background = useSynth ? 
    'linear-gradient(135deg, #00b3a4, #00d9c7)' : 
    'linear-gradient(135deg, #ff6b6b, #ff8787)';
});

// Add toggle to control panel
const controlPanel = document.querySelector('.control-panel');
if (controlPanel) {
  controlPanel.appendChild(soundModeToggle);
}

// ============================================
// FINAL TOUCHES - UI and Usability Enhancements
// ============================================

// Disable loop button initially
loopToggle.disabled = true;

// Show/hide elements based on sound mode
function updateUIForSoundMode() {
  const sampleElements = document.querySelectorAll('.sample-only');
  const synthElements = document.querySelectorAll('.synth-only');
  
  if (useSynth) {
    // Show synthesizer elements, hide sample elements
    synthElements.forEach(el => el.style.display = 'block');
    sampleElements.forEach(el => el.style.display = 'none');
  } else {
    // Show sample elements, hide synthesizer elements
    sampleElements.forEach(el => el.style.display = 'block');
    synthElements.forEach(el => el.style.display = 'none');
  }
}

// Initial UI update
updateUIForSoundMode();

// Update UI on sound mode toggle
document.getElementById('sound-mode-toggle').addEventListener('click', () => {
  updateUIForSoundMode();
});

// Show active sound mode on load
console.log(`Loaded in ${useSynth ? 'Synthesizer' : 'Samples'} mode`);

// ============================================
// ADVANCED BASSLINE SYSTEM
// ============================================

// Bassline elements
const basslineGrid = document.getElementById('bass-grid');
const playBassline = document.getElementById('play-bassline');
const stopBassline = document.getElementById('stop-bassline');
const clearBassline = document.getElementById('clear-bassline');

const bassTypeSelect = document.getElementById('bass-type');
const bassOctaveSelect = document.getElementById('bass-octave');
const bassCutoffSlider = document.getElementById('bass-cutoff');
const bassResonanceSlider = document.getElementById('bass-resonance');
const bassDistortionSlider = document.getElementById('bass-distortion');
const bassGlideSlider = document.getElementById('bass-glide');

const presetButtons = document.querySelectorAll('.preset-btn');
const patternSlots = document.querySelectorAll('.pattern-slot');
const saveBassPattern = document.getElementById('save-bass-pattern');
const loadBassPattern = document.getElementById('load-bass-pattern');
const copyBassPattern = document.getElementById('copy-bass-pattern');

// Bassline state
let basslineData = Array(16).fill(null).map(() => Array(16).fill(false));
let basslineNotes = [
  {note: 'C', octave: 3},
  {note: 'B', octave: 2},
  {note: 'A', octave: 2},
  {note: 'G', octave: 2},
  {note: 'F', octave: 2},
  {note: 'E', octave: 2},
  {note: 'D', octave: 2},
  {note: 'C', octave: 2},
  {note: 'B', octave: 1},
  {note: 'A', octave: 1},
  {note: 'G', octave: 1},
  {note: 'F', octave: 1},
  {note: 'E', octave: 1},
  {note: 'D', octave: 1},
  {note: 'C', octave: 1},
  {note: 'A', octave: 0}
];
let basslineOctave = 2;
let basslineType = 'sub';
let basslinePlaying = false;
let basslineStep = 0;
let basslineInterval = null;
let currentBassPattern = 1;
let bassPatterns = {1: [], 2: [], 3: [], 4: []};
let clipboardPattern = null;

// Bass synthesis parameters
let bassCutoff = 800;
let bassResonance = 5;
let bassDistortion = 0;
let bassGlide = 0;

// ============================================
// ADVANCED BASS SYNTHESIS
// ============================================

// Enhanced 808 Bass (Trap/Hip-Hop)
function synth808Bass(note, duration = 1.0, time = 0) {
  const ctx = initAudioContext();
  
  // Main oscillator - sine wave for punch
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  
  // Classic 808 pitch envelope
  const startFreq = note * 2; // Start higher
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime + time);
  osc.frequency.exponentialRampToValueAtTime(note, ctx.currentTime + time + 0.1);
  
  // Sub oscillator for extra depth
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = note / 2;
  
  // Waveshaping for distortion
  const distortionAmount = bassDistortion / 100;
  const waveshaper = ctx.createWaveShaper();
  waveshaper.curve = makeDistortionCurve(distortionAmount * 400);
  
  // Filter for tone shaping
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = bassCutoff;
  filter.Q.value = bassResonance;
  
  // Gain envelopes
  const mainGain = ctx.createGain();
  const subGain = ctx.createGain();
  
  mainGain.gain.setValueAtTime(0.8, ctx.currentTime + time);
  mainGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  subGain.gain.setValueAtTime(0.5, ctx.currentTime + time);
  subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  // Connect audio graph
  osc.connect(waveshaper);
  waveshaper.connect(filter);
  filter.connect(mainGain);
  subOsc.connect(subGain);
  
  mainGain.connect(ctx.destination);
  subGain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  subOsc.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + duration);
  subOsc.stop(ctx.currentTime + time + duration);
}

// Reese Bass (Drum & Bass / Jungle)
function synthReeseBass(note, duration = 1.0, time = 0) {
  const ctx = initAudioContext();
  
  // Multiple detuned saw waves for thick texture
  const oscs = [];
  const gains = [];
  const detuneAmounts = [-7, -3, 0, 3, 7];
  
  detuneAmounts.forEach((detune, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = note;
    osc.detune.value = detune;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
    
    oscs.push(osc);
    gains.push(gain);
  });
  
  // Aggressive lowpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = bassCutoff;
  filter.Q.value = bassResonance;
  
  // Connect all oscillators
  oscs.forEach((osc, i) => {
    osc.connect(gains[i]);
    gains[i].connect(filter);
  });
  
  filter.connect(ctx.destination);
  
  // Start and stop
  oscs.forEach(osc => {
    osc.start(ctx.currentTime + time);
    osc.stop(ctx.currentTime + time + duration);
  });
}

// Acid Bass (Techno / Acid House)
function synthAcidBass(note, duration = 0.5, time = 0) {
  const ctx = initAudioContext();
  
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = note;
  
  // Classic acid filter sweep
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(note * 2, ctx.currentTime + time);
  filter.frequency.exponentialRampToValueAtTime(bassCutoff, ctx.currentTime + time + 0.1);
  filter.Q.value = bassResonance * 2; // High resonance for acid sound
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, ctx.currentTime + time);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + duration);
}

// Pluck Bass (House / Dance)
function synthPluckBass(note, duration = 0.3, time = 0) {
  const ctx = initAudioContext();
  
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = note;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(bassCutoff * 3, ctx.currentTime + time);
  filter.frequency.exponentialRampToValueAtTime(note, ctx.currentTime + time + duration);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, ctx.currentTime + time);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + time);
  osc.stop(ctx.currentTime + time + duration);
}

// Growl Bass (Dubstep / Bass Music)
function synthGrowlBass(note, duration = 1.0, time = 0) {
  const ctx = initAudioContext();
  
  // Multiple oscillators for complex timbre
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc2.type = 'square';
  osc1.frequency.value = note;
  osc2.frequency.value = note * 1.5;
  
  // LFO for wobble effect
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 4; // 4 Hz wobble
  
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = bassCutoff * 0.5;
  
  lfo.connect(lfoGain);
  
  // Filter with LFO modulation
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = bassCutoff;
  filter.Q.value = bassResonance * 2;
  
  lfoGain.connect(filter.frequency);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, ctx.currentTime + time);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
  
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  lfo.start(ctx.currentTime + time);
  osc1.start(ctx.currentTime + time);
  osc2.start(ctx.currentTime + time);
  
  lfo.stop(ctx.currentTime + time + duration);
  osc1.stop(ctx.currentTime + time + duration);
  osc2.stop(ctx.currentTime + time + duration);
}

// Distortion curve generator
function makeDistortionCurve(amount = 50) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  
  return curve;
}

// Master bass router with glide
let lastBassNote = null;
function playBassNote(noteName, octave = basslineOctave) {
  const frequency = getNoteFrequency(noteName, octave);
  const duration = (60 / currentBpm) * 0.9; // Slightly shorter than beat
  const glideTime = bassGlide / 1000;
  
  console.log(`🎸 Playing ${noteName}${octave} (${frequency.toFixed(2)}Hz) using ${basslineType} bass`);
  
  switch(basslineType) {
    case 'sub':
      synthBass(frequency, duration, glideTime);
      break;
    case '808':
      synth808Bass(frequency, duration, glideTime);
      break;
    case 'reese':
      synthReeseBass(frequency, duration, glideTime);
      break;
    case 'acid':
      synthAcidBass(frequency, duration * 0.5, glideTime);
      break;
    case 'pluck':
      synthPluckBass(frequency, duration * 0.4, glideTime);
      break;
    case 'growl':
      synthGrowlBass(frequency, duration, glideTime);
      break;
    default:
      console.warn(`⚠️ Unknown bass type: ${basslineType}, falling back to sub bass`);
      synthBass(frequency, duration, glideTime);
  }
  
  lastBassNote = frequency;
}

// Get frequency from note name and octave
function getNoteFrequency(noteName, octave) {
  const noteKey = noteName + octave;
  return noteFrequencies[noteKey] || 130.81; // Default to C3
}

// ============================================
// BASSLINE SEQUENCER GRID
// ============================================

// Initialize bass grid
function initBasslineGrid() {
  basslineGrid.innerHTML = '';
  
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const cell = document.createElement('div');
      cell.className = 'bass-step-cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      
      cell.addEventListener('click', () => {
        basslineData[row][col] = !basslineData[row][col];
        cell.classList.toggle('active', basslineData[row][col]);
      });
      
      basslineGrid.appendChild(cell);
    }
  }
}

// ============================================
// BASSLINE PLAYBACK
// ============================================

playBassline.addEventListener('click', () => {
  if (basslinePlaying) return;
  
  basslinePlaying = true;
  basslineStep = 0;
  
  const stepTime = (60 / currentBpm) * 1000 / 4; // 16th notes
  
  basslineInterval = setInterval(() => {
    // Remove previous highlights
    document.querySelectorAll('.bass-step-cell.current-step').forEach(cell => {
      cell.classList.remove('current-step');
    });
    
    // Play notes in current step
    for (let row = 0; row < 16; row++) {
      if (basslineData[row][basslineStep]) {
        const noteInfo = basslineNotes[row];
        playBassNote(noteInfo.note, noteInfo.octave);
        
        // Visual feedback
        const cell = document.querySelector(`.bass-step-cell[data-row="${row}"][data-col="${basslineStep}"]`);
        if (cell) {
          cell.classList.add('playing');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              cell.classList.remove('playing');
            });
          });
        }
      }
    }
    
    // Highlight current step column
    for (let row = 0; row < 16; row++) {
      const cell = document.querySelector(`.bass-step-cell[data-row="${row}"][data-col="${basslineStep}"]`);
      if (cell) cell.classList.add('current-step');
    }
    
    basslineStep = (basslineStep + 1) % 16;
  }, stepTime);
  
  playBassline.textContent = '⏸ Pause';
});

stopBassline.addEventListener('click', () => {
  basslinePlaying = false;
  basslineStep = 0;
  clearInterval(basslineInterval);
  
  // Remove all highlights
  document.querySelectorAll('.bass-step-cell.current-step').forEach(cell => {
    cell.classList.remove('current-step');
  });
  
  playBassline.textContent = '▶ Play Bass';
});

clearBassline.addEventListener('click', () => {
  if (confirm('Clear bassline pattern?')) {
    basslineData = Array(16).fill(null).map(() => Array(16).fill(false));
    document.querySelectorAll('.bass-step-cell').forEach(cell => {
      cell.classList.remove('active');
    });
  }
});

// ============================================
// BASS PARAMETER CONTROLS
// ============================================

bassTypeSelect.addEventListener('change', () => {
  basslineType = bassTypeSelect.value;
  console.log(`Bass type: ${basslineType}`);
});

bassOctaveSelect.addEventListener('change', () => {
  basslineOctave = parseInt(bassOctaveSelect.value);
  console.log(`Bass octave: ${basslineOctave}`);
});

bassCutoffSlider.addEventListener('input', () => {
  bassCutoff = parseFloat(bassCutoffSlider.value);
  document.getElementById('bass-cutoff-value').textContent = bassCutoff + 'Hz';
});

bassResonanceSlider.addEventListener('input', () => {
  bassResonance = parseFloat(bassResonanceSlider.value);
  document.getElementById('bass-resonance-value').textContent = bassResonance;
});

bassDistortionSlider.addEventListener('input', () => {
  bassDistortion = parseFloat(bassDistortionSlider.value);
  document.getElementById('bass-distortion-value').textContent = bassDistortion + '%';
});

bassGlideSlider.addEventListener('input', () => {
  bassGlide = parseFloat(bassGlideSlider.value);
  document.getElementById('bass-glide-value').textContent = bassGlide + 'ms';
});

// ============================================
// GENRE PRESETS
// ============================================

const bassPresets = {
  trap: {
    type: '808',
    octave: 2,
    cutoff: 600,
    resonance: 3,
    distortion: 20,
    glide: 50,
    pattern: [
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false]
    ]
  },
  house: {
    type: 'pluck',
    octave: 2,
    cutoff: 1200,
    resonance: 5,
    distortion: 0,
    glide: 0,
    pattern: [
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]
    ]
  },
  dubstep: {
    type: 'growl',
    octave: 1,
    cutoff: 800,
    resonance: 15,
    distortion: 40,
    glide: 100,
    pattern: [
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, false, false, false, false, false, false, true, false, true, false, false, false, false, false]
    ]
  },
  funk: {
    type: 'pluck',
    octave: 2,
    cutoff: 1500,
    resonance: 8,
    distortion: 10,
    glide: 20,
    pattern: [
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, false, true, false, true, false, false, true, false, false, true, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, true, false, false, false, true, false, true, false, false, false, true, false, false, false]
    ]
  },
  hiphop: {
    type: '808',
    octave: 2,
    cutoff: 700,
    resonance: 4,
    distortion: 15,
    glide: 30,
    pattern: [
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, true]
    ]
  },
  techno: {
    type: 'acid',
    octave: 2,
    cutoff: 1000,
    resonance: 18,
    distortion: 25,
    glide: 0,
    pattern: [
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]
    ]
  },
  dnb: {
    type: 'reese',
    octave: 1,
    cutoff: 900,
    resonance: 12,
    distortion: 30,
    glide: 80,
    pattern: [
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
      [true, false, false, false, false, false, false, false, true, false, false, false, true, false, false, false]
    ]
  },
  jazz: {
    type: 'sub',
    octave: 2,
    cutoff: 1200,
    resonance: 6,
    distortion: 5,
    glide: 40,
    pattern: [
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, false, false, false, false, true, false, false, false, false, false, true, false, false, false],
      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      [false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false],
      [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]
    ]
  }
};

presetButtons.forEach(button => {
  button.addEventListener('click', () => {
    const preset = bassPresets[button.dataset.preset];
    if (!preset) return;
    
    // Remove active from all
    presetButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Load preset parameters
    bassTypeSelect.value = preset.type;
    bassOctaveSelect.value = preset.octave;
    bassCutoffSlider.value = preset.cutoff;
    bassResonanceSlider.value = preset.resonance;
    bassDistortionSlider.value = preset.distortion;
    bassGlideSlider.value = preset.glide;
    
    // Update variables IMMEDIATELY
    basslineType = preset.type;
    basslineOctave = preset.octave;
    bassCutoff = preset.cutoff;
    bassResonance = preset.resonance;
    bassDistortion = preset.distortion;
    bassGlide = preset.glide;
    
    // Update display values
    document.getElementById('bass-cutoff-value').textContent = bassCutoff + 'Hz';
    document.getElementById('bass-resonance-value').textContent = bassResonance;
    document.getElementById('bass-distortion-value').textContent = bassDistortion + '%';
    document.getElementById('bass-glide-value').textContent = bassGlide + 'ms';
    
    // Load pattern
    basslineData = preset.pattern.map(row => [...row]);
    
    // Update grid visuals
    document.querySelectorAll('.bass-step-cell').forEach(cell => {
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      cell.classList.toggle('active', basslineData[row][col]);
    });
    
    // Show confirmation in console
    console.log(`✅ ${button.dataset.preset.toUpperCase()} Preset Loaded:`);
    console.log(`   Bass Type: ${basslineType}`);
    console.log(`   Octave: ${basslineOctave}`);
    console.log(`   Cutoff: ${bassCutoff}Hz`);
    console.log(`   Resonance: ${bassResonance}`);
    console.log(`   Distortion: ${bassDistortion}%`);
    console.log(`   Glide: ${bassGlide}ms`);
  });
});

// ============================================
// PATTERN BANK
// ============================================

patternSlots.forEach(slot => {
  slot.addEventListener('click', () => {
    patternSlots.forEach(s => s.classList.remove('active'));
    slot.classList.add('active');
    currentBassPattern = parseInt(slot.dataset.slot);
    
    // Load pattern if it exists
    if (bassPatterns[currentBassPattern].length > 0) {
      basslineData = bassPatterns[currentBassPattern].map(row => [...row]);
      updateBassGrid();
    }
  });
});

saveBassPattern.addEventListener('click', () => {
  bassPatterns[currentBassPattern] = basslineData.map(row => [...row]);
  console.log(`Pattern ${currentBassPattern} saved`);
});

loadBassPattern.addEventListener('click', () => {
  if (bassPatterns[currentBassPattern].length > 0) {
    basslineData = bassPatterns[currentBassPattern].map(row => [...row]);
    updateBassGrid();
    console.log(`Pattern ${currentBassPattern} loaded`);
  }
});

copyBassPattern.addEventListener('click', () => {
  clipboardPattern = basslineData.map(row => [...row]);
  console.log('Pattern copied to clipboard');
});

function updateBassGrid() {
  document.querySelectorAll('.bass-step-cell').forEach(cell => {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    cell.classList.toggle('active', basslineData[row][col]);
  });
}

// ============================================
// ZERO-LATENCY OPTIMIZATION
// Pre-initialize audio context on ANY user interaction
// ============================================
// ZERO-LATENCY INITIALIZATION
// Pre-initialize audio on ANY user interaction for instant response
// ============================================
let audioInitialized = false;

function earlyInit() {
  if (!audioInitialized) {
    initAudioContext();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
    audioInitialized = true;
  }
}

// Initialize on first click ANYWHERE on page
document.addEventListener('click', earlyInit, { once: true, capture: true });
document.addEventListener('keydown', earlyInit, { once: true, capture: true });
document.addEventListener('touchstart', earlyInit, { once: true, capture: true });
document.addEventListener('mousedown', earlyInit, { once: true, capture: true });

// Resume audio context if suspended (browser autoplay policy)
document.addEventListener('click', () => {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
});

// Initialize bassline grid on load
if (basslineGrid) {
  initBasslineGrid();
}

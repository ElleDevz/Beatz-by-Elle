// ============================================
// PROJECT SAVE/LOAD SYSTEM - Professional Music Production
// ============================================

let currentProjectName = 'Untitled Project';
let projectSaved = false;

// Get all project manager elements
const projectNameInput = document.getElementById('project-name');
const projectInfo = document.getElementById('project-info');
const saveProjectBtn = document.getElementById('save-project');
const loadProjectBtn = document.getElementById('load-project');
const exportProjectBtn = document.getElementById('export-project');
const importProjectBtn = document.getElementById('import-project');
const newProjectBtn = document.getElementById('new-project');
const projectsList = document.getElementById('projects-list');
const projectCount = document.getElementById('project-count');
const importFileInput = document.getElementById('import-file-input');

// Update project name
if (projectNameInput) {
  projectNameInput.addEventListener('input', (e) => {
    currentProjectName = e.target.value || 'Untitled Project';
    projectSaved = false;
    updateProjectInfo();
  });
}

// Gather complete project state
function gatherProjectState() {
  const state = {
    version: '1.0',
    name: currentProjectName,
    timestamp: new Date().toISOString(),
    
    // Global settings
    settings: {
      bpm: document.getElementById('bpm')?.value || 120,
      masterVolume: document.getElementById('volume')?.value || 1,
      metronomeVolume: document.getElementById('metro-volume')?.value || 0.5,
      currentOctave: window.currentOctave || 3,
      currentInstrument: window.currentInstrument || 'bass'
    },
    
    // Drum sequencer pattern
    drumSequencer: {
      pattern: gatherDrumPattern()
    },
    
    // Bassline sequencer
    bassline: {
      pattern: gatherBassPattern(),
      type: document.getElementById('bass-type')?.value || 'sub',
      octave: document.getElementById('bass-octave')?.value || '2',
      cutoff: document.getElementById('bass-cutoff')?.value || 800,
      resonance: document.getElementById('bass-resonance')?.value || 5,
      distortion: document.getElementById('bass-distortion')?.value || 0,
      glide: document.getElementById('bass-glide')?.value || 0
    },
    
    // Mixer settings
    mixer: {
      channels: gatherMixerSettings()
    },
    
    // Effects
    effects: {
      reverb: document.getElementById('reverb')?.value || 0,
      delay: document.getElementById('delay')?.value || 0,
      filter: document.getElementById('filter')?.value || 50
    },
    
    // EQ
    eq: {
      low: document.getElementById('eq-low')?.value || 0,
      mid: document.getElementById('eq-mid')?.value || 0,
      high: document.getElementById('eq-high')?.value || 0
    },
    
    // Compressor
    compressor: {
      threshold: document.getElementById('comp-threshold')?.value || -20,
      ratio: document.getElementById('comp-ratio')?.value || 4,
      attack: document.getElementById('comp-attack')?.value || 10,
      release: document.getElementById('comp-release')?.value || 100,
      enabled: document.getElementById('comp-toggle')?.textContent.includes('ON') || false
    },
    
    // Recorded patterns
    recording: {
      pattern: window.recordedPattern || [],
      isRecording: window.isRecording || false,
      isLooping: window.isLooping || false
    }
  };
  
  return state;
}

function gatherDrumPattern() {
  const pattern = [];
  const sequencerCells = document.querySelectorAll('#sequencer-grid .sequencer-cell.active');
  sequencerCells.forEach(cell => {
    pattern.push({
      sound: cell.dataset.sound,
      step: cell.dataset.step
    });
  });
  return pattern;
}

function gatherBassPattern() {
  const pattern = [];
  const bassCells = document.querySelectorAll('#bass-grid .bass-cell.active');
  bassCells.forEach(cell => {
    pattern.push({
      note: cell.dataset.note,
      step: cell.dataset.step
    });
  });
  return pattern;
}

function gatherMixerSettings() {
  const channels = {};
  const sounds = ['kick', 'snare', 'hihat', 'clap'];
  
  sounds.forEach(sound => {
    const volumeSlider = document.querySelector(`.channel-volume[data-sound="${sound}"]`);
    const panSlider = document.querySelector(`.channel-pan[data-sound="${sound}"]`);
    const muteBtn = document.querySelector(`.mute-btn[data-sound="${sound}"]`);
    const soloBtn = document.querySelector(`.solo-btn[data-sound="${sound}"]`);
    
    channels[sound] = {
      volume: volumeSlider?.value || 0.8,
      pan: panSlider?.value || 0,
      muted: muteBtn?.classList.contains('active') || false,
      solo: soloBtn?.classList.contains('active') || false
    };
  });
  
  return channels;
}

// Save project to localStorage
if (saveProjectBtn) {
  saveProjectBtn.addEventListener('click', () => {
    const state = gatherProjectState();
    const projectKey = `beatz_project_${Date.now()}`;
    
    try {
      // Save to localStorage
      localStorage.setItem(projectKey, JSON.stringify(state));
      
      // Update saved projects list
      const savedProjects = getSavedProjects();
      savedProjects.push({
        key: projectKey,
        name: state.name,
        timestamp: state.timestamp,
        bpm: state.settings.bpm
      });
      localStorage.setItem('beatz_projects_list', JSON.stringify(savedProjects));
      
      projectSaved = true;
      updateProjectInfo();
      refreshProjectsList();
      
      // Success feedback
      showNotification('✅ Project saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving project:', error);
      showNotification('❌ Error saving project', 'error');
    }
  });
}

// Load project
function loadProject(projectKey) {
  try {
    const stateJSON = localStorage.getItem(projectKey);
    if (!stateJSON) {
      showNotification('❌ Project not found', 'error');
      return;
    }
    
    const state = JSON.parse(stateJSON);
    applyProjectState(state);
    
    currentProjectName = state.name;
    projectNameInput.value = state.name;
    projectSaved = true;
    updateProjectInfo();
    
    showNotification('✅ Project loaded successfully!', 'success');
  } catch (error) {
    console.error('Error loading project:', error);
    showNotification('❌ Error loading project', 'error');
  }
}

// Apply project state to UI
function applyProjectState(state) {
  // Global settings
  if (state.settings) {
    if (document.getElementById('bpm')) document.getElementById('bpm').value = state.settings.bpm;
    if (document.getElementById('bpm-value')) document.getElementById('bpm-value').textContent = state.settings.bpm;
    if (document.getElementById('volume')) document.getElementById('volume').value = state.settings.masterVolume;
    if (document.getElementById('metro-volume')) document.getElementById('metro-volume').value = state.settings.metronomeVolume;
    
    if (state.settings.currentOctave) {
      window.currentOctave = state.settings.currentOctave;
      const octaveSlider = document.getElementById('octave-slider');
      const octaveValue = document.getElementById('octave-value');
      if (octaveSlider) octaveSlider.value = state.settings.currentOctave;
      if (octaveValue) octaveValue.textContent = state.settings.currentOctave;
      if (typeof window.updateKeyboardOctave === 'function') {
        window.updateKeyboardOctave();
      }
    }
  }
  
  // Drum sequencer
  if (state.drumSequencer) {
    clearDrumSequencer();
    state.drumSequencer.pattern.forEach(item => {
      const cell = document.querySelector(`#sequencer-grid .sequencer-cell[data-sound="${item.sound}"][data-step="${item.step}"]`);
      if (cell) cell.classList.add('active');
    });
  }
  
  // Bassline
  if (state.bassline) {
    if (document.getElementById('bass-type')) document.getElementById('bass-type').value = state.bassline.type;
    if (document.getElementById('bass-octave')) document.getElementById('bass-octave').value = state.bassline.octave;
    if (document.getElementById('bass-cutoff')) {
      document.getElementById('bass-cutoff').value = state.bassline.cutoff;
      if (document.getElementById('bass-cutoff-value')) {
        document.getElementById('bass-cutoff-value').textContent = state.bassline.cutoff + 'Hz';
      }
    }
    if (document.getElementById('bass-resonance')) {
      document.getElementById('bass-resonance').value = state.bassline.resonance;
      if (document.getElementById('bass-resonance-value')) {
        document.getElementById('bass-resonance-value').textContent = state.bassline.resonance;
      }
    }
    if (document.getElementById('bass-distortion')) {
      document.getElementById('bass-distortion').value = state.bassline.distortion;
      if (document.getElementById('bass-distortion-value')) {
        document.getElementById('bass-distortion-value').textContent = state.bassline.distortion + '%';
      }
    }
    if (document.getElementById('bass-glide')) {
      document.getElementById('bass-glide').value = state.bassline.glide;
      if (document.getElementById('bass-glide-value')) {
        document.getElementById('bass-glide-value').textContent = state.bassline.glide + 'ms';
      }
    }
    
    clearBassSequencer();
    state.bassline.pattern.forEach(item => {
      const cell = document.querySelector(`#bass-grid .bass-cell[data-note="${item.note}"][data-step="${item.step}"]`);
      if (cell) cell.classList.add('active');
    });
  }
  
  // Mixer
  if (state.mixer && state.mixer.channels) {
    Object.keys(state.mixer.channels).forEach(sound => {
      const settings = state.mixer.channels[sound];
      const volumeSlider = document.querySelector(`.channel-volume[data-sound="${sound}"]`);
      const panSlider = document.querySelector(`.channel-pan[data-sound="${sound}"]`);
      
      if (volumeSlider) volumeSlider.value = settings.volume;
      if (panSlider) panSlider.value = settings.pan;
    });
  }
  
  // Effects
  if (state.effects) {
    if (document.getElementById('reverb')) {
      document.getElementById('reverb').value = state.effects.reverb;
      if (document.getElementById('reverb-value')) {
        document.getElementById('reverb-value').textContent = state.effects.reverb + '%';
      }
    }
    if (document.getElementById('delay')) {
      document.getElementById('delay').value = state.effects.delay;
      if (document.getElementById('delay-value')) {
        document.getElementById('delay-value').textContent = state.effects.delay + '%';
      }
    }
    if (document.getElementById('filter')) {
      document.getElementById('filter').value = state.effects.filter;
      if (document.getElementById('filter-value')) {
        document.getElementById('filter-value').textContent = state.effects.filter + '%';
      }
    }
  }
  
  // EQ
  if (state.eq) {
    if (document.getElementById('eq-low')) {
      document.getElementById('eq-low').value = state.eq.low;
      if (document.getElementById('eq-low-value')) {
        document.getElementById('eq-low-value').textContent = state.eq.low + 'dB';
      }
    }
    if (document.getElementById('eq-mid')) {
      document.getElementById('eq-mid').value = state.eq.mid;
      if (document.getElementById('eq-mid-value')) {
        document.getElementById('eq-mid-value').textContent = state.eq.mid + 'dB';
      }
    }
    if (document.getElementById('eq-high')) {
      document.getElementById('eq-high').value = state.eq.high;
      if (document.getElementById('eq-high-value')) {
        document.getElementById('eq-high-value').textContent = state.eq.high + 'dB';
      }
    }
  }
  
  // Compressor
  if (state.compressor) {
    if (document.getElementById('comp-threshold')) {
      document.getElementById('comp-threshold').value = state.compressor.threshold;
      if (document.getElementById('comp-threshold-value')) {
        document.getElementById('comp-threshold-value').textContent = state.compressor.threshold + 'dB';
      }
    }
    if (document.getElementById('comp-ratio')) {
      document.getElementById('comp-ratio').value = state.compressor.ratio;
      if (document.getElementById('comp-ratio-value')) {
        document.getElementById('comp-ratio-value').textContent = state.compressor.ratio + ':1';
      }
    }
    if (document.getElementById('comp-attack')) {
      document.getElementById('comp-attack').value = state.compressor.attack;
      if (document.getElementById('comp-attack-value')) {
        document.getElementById('comp-attack-value').textContent = state.compressor.attack + 'ms';
      }
    }
    if (document.getElementById('comp-release')) {
      document.getElementById('comp-release').value = state.compressor.release;
      if (document.getElementById('comp-release-value')) {
        document.getElementById('comp-release-value').textContent = state.compressor.release + 'ms';
      }
    }
  }
}

// Clear sequencers
function clearDrumSequencer() {
  const cells = document.querySelectorAll('#sequencer-grid .sequencer-cell');
  cells.forEach(cell => cell.classList.remove('active'));
}

function clearBassSequencer() {
  const cells = document.querySelectorAll('#bass-grid .bass-cell');
  cells.forEach(cell => cell.classList.remove('active'));
}

// Export project as JSON file
if (exportProjectBtn) {
  exportProjectBtn.addEventListener('click', () => {
    const state = gatherProjectState();
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProjectName.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showNotification('✅ Project exported!', 'success');
  });
}

// Import project from JSON file
if (importProjectBtn && importFileInput) {
  importProjectBtn.addEventListener('click', () => {
    importFileInput.click();
  });
  
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const state = JSON.parse(event.target.result);
        applyProjectState(state);
        
        currentProjectName = state.name;
        projectNameInput.value = state.name;
        projectSaved = false;
        updateProjectInfo();
        
        showNotification('✅ Project imported!', 'success');
      } catch (error) {
        console.error('Error importing project:', error);
        showNotification('❌ Invalid project file', 'error');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    importFileInput.value = '';
  });
}

// New project
if (newProjectBtn) {
  newProjectBtn.addEventListener('click', () => {
    if (!confirm('Create new project? Unsaved changes will be lost.')) return;
    
    // Reset to default state
    location.reload();
  });
}

// Get saved projects list
function getSavedProjects() {
  const list = localStorage.getItem('beatz_projects_list');
  return list ? JSON.parse(list) : [];
}

// Refresh projects list
function refreshProjectsList() {
  if (!projectsList) return;
  
  const projects = getSavedProjects();
  
  if (projectCount) {
    projectCount.textContent = `(${projects.length})`;
  }
  
  if (projects.length === 0) {
    projectsList.innerHTML = '<p class="no-projects">No saved projects yet. Create your first beat!</p>';
    return;
  }
  
  // Sort by timestamp (newest first)
  projects.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  projectsList.innerHTML = projects.map(project => `
    <div class="project-card" data-key="${project.key}">
      <div class="project-card-header">
        <h4 class="project-card-name">${project.name}</h4>
        <button class="project-card-delete" data-key="${project.key}" onclick="event.stopPropagation()">Delete</button>
      </div>
      <p class="project-card-info">BPM: ${project.bpm}</p>
      <p class="project-card-date">${new Date(project.timestamp).toLocaleString()}</p>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => {
      loadProject(card.dataset.key);
    });
  });
  
  document.querySelectorAll('.project-card-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteProject(btn.dataset.key);
    });
  });
}

// Delete project
function deleteProject(projectKey) {
  if (!confirm('Delete this project?')) return;
  
  try {
    // Remove from localStorage
    localStorage.removeItem(projectKey);
    
    // Update list
    let projects = getSavedProjects();
    projects = projects.filter(p => p.key !== projectKey);
    localStorage.setItem('beatz_projects_list', JSON.stringify(projects));
    
    refreshProjectsList();
    showNotification('✅ Project deleted', 'success');
  } catch (error) {
    console.error('Error deleting project:', error);
    showNotification('❌ Error deleting project', 'error');
  }
}

// Update project info
function updateProjectInfo() {
  if (!projectInfo) return;
  
  if (projectSaved) {
    projectInfo.textContent = 'Saved ✓';
    projectInfo.classList.add('saved');
  } else {
    projectInfo.textContent = 'Not saved';
    projectInfo.classList.remove('saved');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? 'rgba(0, 255, 127, 0.9)' : 'rgba(255, 68, 68, 0.9)'};
    color: #000;
    font-weight: 700;
    border-radius: 10px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.1rem;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Initialize projects list on load
refreshProjectsList();

// Mark project as unsaved when any change is made
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('sequencer-cell') || e.target.classList.contains('bass-cell')) {
    projectSaved = false;
    updateProjectInfo();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('input, select') && !e.target.matches('#project-name')) {
    projectSaved = false;
    updateProjectInfo();
  }
});

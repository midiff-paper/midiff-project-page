window.HELP_IMPROVE_VIDEOJS = false;


$(document).ready(function() {
    // Check for click events on the navbar burger icon

    var options = {
			slidesToScroll: 1,
			slidesToShow: 1,
			loop: true,
			infinite: true,
			autoplay: true,
			autoplaySpeed: 5000,
    }

		// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);
	
    bulmaSlider.attach();

})

// MIDI Visualization Class
class MidiVisualizer {
  constructor(canvasId, midiFilePath, audioFilePath = null) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 10; // Will be updated when MIDI is loaded
    this.animationId = null;
    this.channels = 9;
    this.midiData = [];
    this.midiFilePath = midiFilePath;
    this.audioFilePath = audioFilePath;
    
    // Audio context for playback
    this.audioContext = null;
    this.gainNode = null;
    this.scheduledNotes = [];
    
    // Audio buffer for original drum sounds
    this.audioBuffer = null;
    this.audioSource = null;
    
    // Magenta Player with Tone.js
    this.magentaPlayer = null;
    this.midiSequence = null;
    
    // Initialize setup
    this.setupCanvas();
    this.setupAudio();
    this.setupMagentaPlayer();
    
    // Initialize with empty data first
    this.midiData = [];
    this.draw();
    
    console.log('🎵 Constructor - MIDI file path:', this.midiFilePath);
    console.log('🎵 Constructor - Audio file path:', this.audioFilePath);
    
    // Load the actual MIDI file
    if (this.midiFilePath) {
      this.loadMidiFile().catch(error => {
        console.error('Failed to initialize MIDI file:', error);
        document.getElementById('midi-status').textContent = 'Error: Cannot load MIDI file';
      });
    } else {
      console.error('❌ No MIDI file path provided');
      document.getElementById('midi-status').textContent = 'Error: No MIDI file specified';
    }
    
    // Load original drum audio if provided
    if (this.audioFilePath) {
      this.loadOriginalAudio();
    }
  }
  
  setupCanvas() {
    // Set up high-DPI canvas
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }
  
  async setupAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 0.3; // Set volume
    } catch (error) {
      console.warn('Could not setup audio context:', error);
    }
  }
  
  // Create a simple drum sound synthesizer
  createDrumSound(channel, pitch, velocity, startTime, duration) {
    if (!this.audioContext) return null;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const noiseBuffer = this.createNoiseBuffer();
    const noiseSource = this.audioContext.createBufferSource();
    const filter = this.audioContext.createBiquadFilter();
    
    // Different drum sounds for different channels/pitches
    if (channel === 0 || pitch === 36) { // Kick drum
      oscillator.frequency.setValueAtTime(60, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(30, startTime + 0.1);
      filter.frequency.value = 100;
      gainNode.gain.setValueAtTime(velocity / 127 * 0.8, startTime);
    } else if (channel === 1 || pitch === 38) { // Snare
      oscillator.frequency.value = 200;
      filter.frequency.value = 2000;
      noiseSource.buffer = noiseBuffer;
      noiseSource.connect(filter);
      gainNode.gain.setValueAtTime(velocity / 127 * 0.6, startTime);
    } else if (channel === 2 || pitch >= 42 && pitch <= 46) { // Hi-hat
      oscillator.frequency.value = 8000;
      filter.frequency.value = 10000;
      noiseSource.buffer = noiseBuffer;
      noiseSource.connect(filter);
      gainNode.gain.setValueAtTime(velocity / 127 * 0.3, startTime);
    } else { // Other percussion
      oscillator.frequency.value = 150 + pitch * 10;
      filter.frequency.value = 1000;
      gainNode.gain.setValueAtTime(velocity / 127 * 0.4, startTime);
    }
    
    // Apply envelope
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + Math.min(duration, 0.5));
    
    // Connect nodes
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.gainNode);
    
    // Schedule playback
    oscillator.start(startTime);
    if (noiseSource.buffer) noiseSource.start(startTime);
    
    oscillator.stop(startTime + Math.min(duration, 0.5));
    if (noiseSource.buffer) noiseSource.stop(startTime + Math.min(duration, 0.5));
    
    return { oscillator, noiseSource, gainNode };
  }
  
  // Create noise buffer for drum sounds
  createNoiseBuffer() {
    if (!this.audioContext) return null;
    
    const bufferSize = this.audioContext.sampleRate * 0.1; // 100ms of noise
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    return buffer;
  }
  
  // Setup Magenta Player with Tone.js
  async setupMagentaPlayer() {
    try {
      console.log('🎹 Setting up Magenta Player with Tone.js...');
      
      // Wait for required libraries to be available
      if (typeof core === 'undefined') {
        console.warn('⚠️ Magenta core not available, will use fallback synthesizer');
        document.getElementById('midi-status').textContent = 'Magenta not available - using Web Audio';
        return;
      }
      
      if (typeof Tone === 'undefined') {
        console.warn('⚠️ Tone.js not available, will use fallback synthesizer');
        document.getElementById('midi-status').textContent = 'Tone.js not available - using Web Audio';
        return;
      }
      
      console.log('🎵 Initializing Tone.js audio context...');
      
      // Initialize Tone.js (required for Magenta Player)
      await Tone.start();
      console.log('✅ Tone.js initialized');
      
      // Create Magenta Player
      this.magentaPlayer = new core.Player();
      
      console.log('✅ Magenta Player with Tone.js initialized successfully!');
      document.getElementById('midi-status').textContent = 'Ready: Research Demo Pattern + Magenta';
      
    } catch (error) {
      console.error('❌ Failed to setup Magenta Player:', error);
      this.magentaPlayer = null;
      document.getElementById('midi-status').textContent = 'Setup failed - using Web Audio';
    }
  }
  

  
  async loadMidiFile() {
    const url = this.midiFilePath;
    try {
      console.log(`🎵 Loading MIDI file: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log(`📁 MIDI file loaded, size: ${arrayBuffer.byteLength} bytes`);
      
      const midiArray = new Uint8Array(arrayBuffer);
      console.log(`🔍 First 16 bytes: ${Array.from(midiArray.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      // Try parsing with midi-parser-js first, then fall back to midi-file
      let midi;
      try {
        if (typeof MidiParser !== 'undefined') {
          midi = MidiParser.parse(midiArray);
          console.log('🎼 MIDI parsed with MidiParser:', midi);
        } else if (typeof midiFile !== 'undefined') {
          midi = midiFile.parseMidi(midiArray);
          console.log('🎼 MIDI parsed with midiFile:', midi);
        } else {
          throw new Error('No MIDI parser library available');
        }
      } catch (parseError) {
        console.error('❌ Primary MIDI parser failed:', parseError);
        // Try alternative parsing method
        if (typeof midiFile !== 'undefined' && typeof MidiParser === 'undefined') {
          midi = midiFile.parseMidi(midiArray);
          console.log('🎼 MIDI parsed with fallback midiFile:', midi);
        } else {
          throw parseError;
        }
      }
      
      // Parse the MIDI data and set up visualization
      // Handle different MIDI parser library formats
      if (midi.track) {
        // MidiParser format
        this.parseMidiData(midi);
      } else if (midi.tracks) {
        // midi-file format
        this.parseMidiDataAlternative(midi);
      } else {
        throw new Error('Unknown MIDI data format');
      }
      
      // Create Magenta sequence from the parsed data
      this.createMagentaSequenceFromData();
      
      console.log('✅ MIDI file loaded and parsed successfully');
      this.draw();
      
    } catch (error) {
      console.error(`❌ Failed to load MIDI file: ${error.message}`);
      console.error('Stack trace:', error.stack);
      
      // Don't fall back to sample data - show the error
      throw new Error(`Cannot load MIDI file: ${error.message}`);
    }
  }
  
  // Create Magenta sequence from parsed MIDI data
  createMagentaSequenceFromData() {
    try {
      if (!this.magentaPlayer || typeof core === 'undefined') {
        console.log('⚠️ Magenta not available for sequence creation');
        return;
      }
      
      if (this.midiData.length === 0) {
        console.log('⚠️ No MIDI data available for sequence creation');
        return;
      }
      
      console.log('🎼 Creating Magenta NoteSequence from parsed data...');
      
      // Create a NoteSequence from our parsed MIDI data
      const noteSequence = {
        ticksPerQuarter: 220,
        totalTime: this.duration,
        notes: []
      };
      
      // Convert our parsed MIDI data to Magenta notes format
      this.midiData.forEach((channelData, channelIndex) => {
        channelData.notes.forEach(note => {
          noteSequence.notes.push({
            pitch: note.pitch,
            velocity: note.velocity,
            startTime: note.start,
            endTime: note.start + note.duration,
            instrument: 0, // Use default instrument
            program: channelIndex === 9 ? 1 : 0, // Drum kit for channel 9
            isDrum: channelIndex === 9 || note.pitch >= 35 // Drum notes
          });
        });
      });
      
      this.midiSequence = noteSequence;
      
      console.log('✅ Magenta NoteSequence created!');
      console.log('🎵 Sequence has', this.midiSequence.notes.length, 'notes');
      console.log('⏱️ Sequence duration:', this.midiSequence.totalTime.toFixed(2), 'seconds');
      
    } catch (error) {
      console.error('❌ Failed to create Magenta sequence:', error);
      this.midiSequence = null;
    }
  }
  
  // Load original drum audio file
  async loadOriginalAudio() {
    try {
      console.log('Loading original drum audio from:', this.audioFilePath);
      
      const response = await fetch(this.audioFilePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('Audio file loaded, size:', arrayBuffer.byteLength, 'bytes');
      
      if (this.audioContext) {
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        console.log('✅ Original drum audio loaded successfully!');
        console.log(`Audio duration: ${this.audioBuffer.duration.toFixed(2)}s, Sample rate: ${this.audioBuffer.sampleRate}Hz`);
        
        // Use the longer duration between MIDI and audio, but ensure we can see all MIDI content
        const audioDuration = this.audioBuffer.duration;
        console.log(`Audio duration: ${audioDuration.toFixed(2)}s, Current MIDI duration: ${this.duration.toFixed(2)}s`);
        
        // Always use the longer duration to ensure full content visibility
        this.duration = Math.max(this.duration, audioDuration, 30);
        console.log(`Final duration set to: ${this.duration.toFixed(2)}s`);
        
        // Keep button text as MIDI since we're not using WAV playback
        setTimeout(() => {
          const playBtn = document.getElementById('midi-play-btn');
          if (playBtn) {
            playBtn.innerHTML = '<span class="icon"><i class="fas fa-play"></i></span><span>Play MIDI</span>';
          }
        }, 100);
        
      }
    } catch (error) {
      console.error('Failed to load original drum audio:', error);
      console.warn('Will use synthesized drum sounds instead');
    }
  }
  
  parseMidiData(parsedMidi) {
    console.log('🔍 Detailed MIDI parsing - Raw structure:', parsedMidi);
    
    // Extract timing information
    const ticksPerQuarter = parsedMidi.timeDivision || 480;
    console.log('⏱️ Ticks per quarter note:', ticksPerQuarter);
    
    let maxTime = 0;
    let totalNotes = 0;
    let allEvents = 0;
    
    // Initialize channel data
    const channelData = {};
    for (let i = 0; i < this.channels; i++) {
      channelData[i] = {
        channel: i,
        color: this.getChannelColor(i),
        notes: []
      };
    }
    
    // Process MIDI tracks
    if (!parsedMidi.track || parsedMidi.track.length === 0) {
      console.error('❌ No MIDI tracks found in file - this might be why notes are fake');
      throw new Error('No MIDI tracks found');
    }
    
    console.log(`🎼 Processing ${parsedMidi.track.length} MIDI tracks...`);
    
    parsedMidi.track.forEach((track, trackIndex) => {
      const eventCount = track.event?.length || 0;
      allEvents += eventCount;
      console.log(`🎵 Track ${trackIndex}: ${eventCount} events`);
      
      let currentTime = 0;
      const activeNotes = {}; // Track note on events
      let trackNotes = 0;
      
      if (!track.event) {
        console.warn(`⚠️ Track ${trackIndex} has no events`);
        return;
      }
      
      track.event.forEach((event, eventIndex) => {
        currentTime += event.deltaTime || 0;
        
        // Use more accurate BPM calculation - try to detect tempo or use 138 BPM
        const beatsPerSecond = 138 / 60; // 2.3 beats per second
        const timeInSeconds = (currentTime / ticksPerQuarter) / beatsPerSecond;
        
        // Debug first few events
        if (eventIndex < 5) {
          console.log(`📝 Event ${eventIndex}: type=${event.type}, deltaTime=${event.deltaTime}, time=${timeInSeconds.toFixed(3)}s, data=${event.data}`);
        }
        
        // Handle different MIDI event formats more robustly
        if (event.type === 9 && event.data && event.data.length >= 2) { // Note On
          // Map MIDI channel 9 (drums) to our visualization channels by drum pitch
          let channel = event.channel || 0;
          const pitch = event.data[0];
          const velocity = event.data[1];
          
          // For drum channel (9), map by pitch to our channels
          if (channel === 9 || pitch >= 35) {
            channel = this.mapDrumPitchToChannel(pitch);
          } else {
            channel = Math.min(channel, this.channels - 1);
          }
          
          if (eventIndex < 10) {
            console.log(`🎵 Note ON: ch=${channel}, pitch=${pitch}, vel=${velocity}, time=${timeInSeconds.toFixed(3)}s`);
          }
          
          if (velocity > 0) {
            activeNotes[`${channel}-${pitch}`] = {
              start: timeInSeconds,
              pitch: pitch,
              velocity: velocity,
              channel: channel
            };
            trackNotes++;
          } else {
            // Note off (velocity 0)
            const noteKey = `${channel}-${pitch}`;
            if (activeNotes[noteKey]) {
              const note = activeNotes[noteKey];
              note.duration = Math.max(0.1, timeInSeconds - note.start);
              channelData[channel].notes.push(note);
              delete activeNotes[noteKey];
              maxTime = Math.max(maxTime, timeInSeconds + note.duration);
              totalNotes++;
              
              if (totalNotes <= 10) {
                console.log(`🎼 Added note: ${this.getDrumClassName(channel)} at ${note.start.toFixed(2)}s, dur=${note.duration.toFixed(2)}s`);
              }
            }
          }
        } else if (event.type === 8 && event.data && event.data.length >= 2) { // Note Off
          let channel = event.channel || 0;
          const pitch = event.data[0];
          
          // For drum channel (9), map by pitch to our channels
          if (channel === 9 || pitch >= 35) {
            channel = this.mapDrumPitchToChannel(pitch);
          } else {
            channel = Math.min(channel, this.channels - 1);
          }
          
          const noteKey = `${channel}-${pitch}`;
          
          if (eventIndex < 10) {
            console.log(`🎵 Note OFF: ch=${channel}, pitch=${pitch}, time=${timeInSeconds.toFixed(3)}s`);
          }
          
          if (activeNotes[noteKey]) {
            const note = activeNotes[noteKey];
            note.duration = Math.max(0.1, timeInSeconds - note.start);
            channelData[channel].notes.push(note);
            delete activeNotes[noteKey];
            maxTime = Math.max(maxTime, timeInSeconds);
            totalNotes++;
            
            if (totalNotes <= 10) {
              console.log(`🎼 Added note: ${this.getDrumClassName(channel)} at ${note.start.toFixed(2)}s, dur=${note.duration.toFixed(2)}s`);
            }
          }
        }
        // Handle other event types for debugging
        else if (eventIndex < 10 && event.type !== 255) { // Skip meta events for cleaner output
          console.log(`🔍 Other event: type=${event.type}, channel=${event.channel}, data=${event.data}`);
        }
        console.log(`🎼 Track ${trackIndex} completed: ${trackNotes} note events processed`);
      });
    });
    
    console.log(`📊 Total events processed: ${allEvents}, Note events found: ${totalNotes}`);
    
    // Handle any remaining active notes (notes that never had a proper note-off)
    let hangingNotes = 0;
    Object.values(activeNotes).forEach(note => {
      if (note.channel < this.channels) {
        note.duration = Math.max(0.1, maxTime - note.start);
        channelData[note.channel].notes.push(note);
        maxTime = Math.max(maxTime, note.start + note.duration);
        totalNotes++;
        hangingNotes++;
      }
    });
    
    if (hangingNotes > 0) {
      console.log(`🔧 Fixed ${hangingNotes} hanging notes without note-off events`);
    }
    
    // Convert to array and set duration - use actual content length
    this.midiData = Object.values(channelData);
    this.duration = Math.max(maxTime + 5, 30); // Add 5s buffer and ensure minimum 30 seconds for full visibility
    
    // Count total notes parsed
    const finalNoteCount = this.midiData.reduce((sum, channel) => sum + channel.notes.length, 0);
    
    if (finalNoteCount > 0) {
      console.log(`🎉 REAL MIDI DATA SUCCESSFULLY PARSED!`);
      console.log(`📊 Total notes: ${finalNoteCount}, Duration: ${this.duration.toFixed(2)}s (max time: ${maxTime.toFixed(2)}s)`);
      
      // Log notes per channel for debugging
      this.midiData.forEach((channel, index) => {
        if (channel.notes.length > 0) {
          const drumName = this.getDrumClassName(index);
          const firstNote = channel.notes[0];
          const lastNote = channel.notes[channel.notes.length - 1];
          console.log(`🥁 ${drumName}: ${channel.notes.length} notes (${firstNote.start.toFixed(1)}s to ${lastNote.start.toFixed(1)}s)`);
        }
      });
    } else {
      console.error(`💥 ZERO NOTES PARSED FROM MIDI FILE - This is why you see fake data!`);
      console.error(`📋 Debug info: ${allEvents} total events, ${parsedMidi.track?.length || 0} tracks`);
      throw new Error('No MIDI notes successfully parsed');
    }
  }
  
  // Alternative parsing method for midi-file library
  parseMidiDataAlternative(midiData) {
    console.log('Parsing with alternative method:', midiData);
    
    const ticksPerQuarter = midiData.header.ticksPerQuarter || 480;
    console.log('Alternative parser - Ticks per quarter:', ticksPerQuarter);
    
    let maxTime = 0;
    let totalNotes = 0;
    
    // Initialize channel data
    const channelData = {};
    for (let i = 0; i < this.channels; i++) {
      channelData[i] = {
        channel: i,
        color: this.getChannelColor(i),
        notes: []
      };
    }
    
    // Process tracks
    midiData.tracks.forEach((track, trackIndex) => {
      console.log(`Alternative parser - Processing track ${trackIndex}`);
      
      let currentTime = 0;
      const activeNotes = {};
      
      track.forEach(event => {
        currentTime += event.deltaTime || 0;
        
        // Convert to seconds using 138 BPM
        const beatsPerSecond = 138 / 60;
        const timeInSeconds = (currentTime / ticksPerQuarter) / beatsPerSecond;
        
        if (event.type === 'noteOn' && event.velocity > 0) {
          let channel = event.channel || 0;
          const pitch = event.noteNumber;
          
          // For drum channel (9), map by pitch to our channels
          if (channel === 9 || pitch >= 35) {
            channel = this.mapDrumPitchToChannel(pitch);
          } else {
            channel = Math.min(channel, this.channels - 1);
          }
          
          activeNotes[`${channel}-${pitch}`] = {
            start: timeInSeconds,
            pitch: pitch,
            velocity: event.velocity,
            channel: channel
          };
        } else if ((event.type === 'noteOff') || (event.type === 'noteOn' && event.velocity === 0)) {
          let channel = event.channel || 0;
          const pitch = event.noteNumber;
          
          // For drum channel (9), map by pitch to our channels
          if (channel === 9 || pitch >= 35) {
            channel = this.mapDrumPitchToChannel(pitch);
          } else {
            channel = Math.min(channel, this.channels - 1);
          }
          
          const noteKey = `${channel}-${pitch}`;
          
          if (activeNotes[noteKey]) {
            const note = activeNotes[noteKey];
            note.duration = Math.max(0.1, timeInSeconds - note.start);
            channelData[channel].notes.push(note);
            delete activeNotes[noteKey];
            maxTime = Math.max(maxTime, timeInSeconds);
            totalNotes++;
          }
        }
      });
    });
    
    // Finalize
    this.midiData = Object.values(channelData);
    this.duration = Math.max(maxTime + 5, 30); // Add 5s buffer and ensure minimum 30 seconds
    
    console.log(`✅ Alternative MIDI parsing successful!`);
    console.log(`📊 Channels: ${this.midiData.length}, Total notes: ${totalNotes}`);
    console.log(`⏱️ Alternative Duration: ${this.duration.toFixed(2)}s (max note time: ${maxTime.toFixed(2)}s)`);
    
    if (totalNotes === 0) {
      console.warn('⚠️ Alternative parser found no notes - using sample data');
      this.midiData = this.generateSampleMidiData();
    }
  }
  
  getChannelColor(channel) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'
    ];
    return colors[channel % colors.length];
  }
  
  // Map MIDI drum pitches to our visualization channels
  mapDrumPitchToChannel(pitch) {
    // Standard GM drum mapping to our 9 channels
    const drumMap = {
      35: 0, 36: 0,  // Kick drums -> Channel 0
      37: 1, 38: 1, 40: 1,  // Snare drums -> Channel 1
      42: 2, 44: 2,  // Closed Hi-Hat -> Channel 2
      46: 3,  // Open Hi-Hat -> Channel 3
      49: 4, 52: 4, 55: 4, 57: 4,  // Crash cymbals -> Channel 4
      51: 5, 53: 5, 59: 5,  // Ride cymbals -> Channel 5
      45: 6, 47: 6, 48: 6, 50: 6,  // High toms -> Channel 6
      41: 7, 43: 7,  // Mid toms -> Channel 7
      39: 8, 58: 8   // Low toms/Floor tom -> Channel 8
    };
    
    return drumMap[pitch] || Math.min(Math.floor((pitch - 35) / 4), this.channels - 1);
  }

  // Get drum class name for each channel
  getDrumClassName(channel) {
    const drumClasses = [
      'Kick Drum',     // Channel 0
      'Snare Drum',    // Channel 1
      'Hi-Hat',        // Channel 2
      'Open Hat',      // Channel 3
      'Crash',         // Channel 4
      'Ride',          // Channel 5
      'Tom High',      // Channel 6
      'Tom Mid',       // Channel 7
      'Tom Low'        // Channel 8
    ];
    return drumClasses[channel] || `Perc ${channel + 1}`;
  }
  

  
  draw() {
    const width = this.canvas.getBoundingClientRect().width;
    const height = this.canvas.getBoundingClientRect().height;
    
    // Clear canvas
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, width, height);
    
    // Draw channel lanes
    const channelHeight = height / this.channels;
    
    for (let i = 0; i < this.channels; i++) {
      const y = i * channelHeight;
      
      // Alternate channel background colors
      this.ctx.fillStyle = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
      this.ctx.fillRect(0, y, width, channelHeight);
      
      // Channel separator lines
      this.ctx.strokeStyle = '#e9ecef';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
      
      // Drum class labels
      this.ctx.fillStyle = '#495057';
      this.ctx.font = '11px Arial';
      this.ctx.textAlign = 'left';
      const drumName = this.getDrumClassName(i);
      this.ctx.fillText(drumName, 5, y + channelHeight / 2 + 4);
    }
    
    // Draw MIDI notes
    this.midiData.forEach((channelData, channelIndex) => {
      const y = channelIndex * channelHeight;
      
      channelData.notes.forEach(note => {
        const noteX = (note.start / this.duration) * width;
        const noteWidth = (note.duration / this.duration) * width;
        const noteY = y + 5;
        const noteHeight = channelHeight - 10;
        
        // Note color based on velocity
        const alpha = note.velocity / 127;
        this.ctx.fillStyle = channelData.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        
        // Draw note rectangle
        this.ctx.fillRect(noteX, noteY, Math.max(noteWidth, 2), noteHeight);
        
        // Note border
        this.ctx.strokeStyle = channelData.color;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(noteX, noteY, Math.max(noteWidth, 2), noteHeight);
      });
    });
    
    // Draw playhead
    if (this.currentTime > 0) {
      const playheadX = (this.currentTime / this.duration) * width;
      this.ctx.strokeStyle = '#dc3545';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(playheadX, 0);
      this.ctx.lineTo(playheadX, height);
      this.ctx.stroke();
    }
    
    // Draw time grid
    this.drawTimeGrid(width, height);
  }
  
  drawTimeGrid(width, height) {
    this.ctx.strokeStyle = '#dee2e6';
    this.ctx.lineWidth = 0.5;
    this.ctx.font = '10px Arial';
    this.ctx.fillStyle = '#6c757d';
    this.ctx.textAlign = 'center';
    
    // Calculate appropriate time interval based on duration
    let timeInterval = 1; // Default to every second
    if (this.duration > 20) {
      timeInterval = 2; // Every 2 seconds for medium durations
    } else if (this.duration > 40) {
      timeInterval = 5; // Every 5 seconds for longer durations
    } else if (this.duration > 80) {
      timeInterval = 10; // Every 10 seconds for very long durations
    }
    
    console.log(`🕒 Drawing time grid: duration=${this.duration.toFixed(1)}s, interval=${timeInterval}s`);
    
    // Draw vertical grid lines
    for (let i = 0; i <= this.duration; i += timeInterval) {
      const x = (i / this.duration) * width;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
      
      // Time labels
      this.ctx.fillText(`${i}s`, x, height - 5);
    }
  }
  
  async play() {
    if (this.isPlaying) return;
    
    // Resume audio context if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this.isPlaying = true;
    this.startTime = Date.now() - (this.currentTime * 1000);
    
    // Use Magenta player if available, otherwise fallback to synthesizer
    if (this.magentaPlayer && this.midiSequence) {
      this.playWithMagenta();
    } else {
      console.log('🔄 Magenta not available, using fallback synthesizer');
      this.scheduleAudioPlayback();
    }
    
    this.animate();
    
    // Update button states
    document.getElementById('midi-play-btn').innerHTML = '<span class="icon"><i class="fas fa-pause"></i></span><span>Pause</span>';
  }
  
  // Play the original drum audio file
  playOriginalAudio() {
    if (!this.audioBuffer || !this.audioContext) return;
    
    // Stop any currently playing audio
    this.stopOriginalAudio();
    
    // Create new audio source
    this.audioSource = this.audioContext.createBufferSource();
    this.audioSource.buffer = this.audioBuffer;
    this.audioSource.connect(this.gainNode);
    
    // Start playback from current time position
    const startTime = this.audioContext.currentTime + 0.1;
    const offset = this.currentTime;
    
    console.log(`🎵 Playing original drum audio from ${offset.toFixed(2)}s`);
    
    this.audioSource.start(startTime, offset);
    
    // Handle audio end
    this.audioSource.onended = () => {
      if (this.isPlaying) {
        this.stop();
      }
    };
  }
  
  // Stop original audio playback
  stopOriginalAudio() {
    if (this.audioSource) {
      try {
        this.audioSource.stop();
      } catch (e) {
        // Already stopped
      }
      this.audioSource = null;
    }
  }
  
  // Play MIDI using Magenta Player
  async playWithMagenta() {
    if (!this.magentaPlayer || !this.midiSequence) {
      console.error('❌ Magenta Player or sequence not available');
      return;
    }
    
    try {
      console.log('🎹 Playing with Magenta Player + Tone.js...');
      console.log('🎵 Sequence notes:', this.midiSequence.notes.length);
      console.log('⏱️ Duration:', this.midiSequence.totalTime.toFixed(2), 'seconds');
      
      // Ensure Tone.js is started
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      
      // Stop any current playback
      this.stopMagentaPlayback();
      
      // Start playback with the sequence
      await this.magentaPlayer.start(this.midiSequence);
      
      console.log('▶️ Magenta Player started successfully!');
      
    } catch (error) {
      console.error('❌ Magenta Player failed:', error);
      console.log('🔄 Falling back to synthesizer');
      this.scheduleAudioPlayback();
    }
  }
  
  // Stop Magenta Player
  stopMagentaPlayback() {
    if (this.magentaPlayer && this.magentaPlayer.isPlaying()) {
      this.magentaPlayer.stop();
      console.log('⏹️ Magenta Player stopped');
    }
  }
  
  scheduleAudioPlayback() {
    if (!this.audioContext) return;
    
    // Clear any previously scheduled notes
    this.stopScheduledNotes();
    
    const currentAudioTime = this.audioContext.currentTime;
    const playbackStartTime = currentAudioTime + 0.1; // Small delay for scheduling
    
    // Schedule all notes that should play from current time onwards
    this.midiData.forEach(channelData => {
      channelData.notes.forEach(note => {
        const noteStartTime = note.start - this.currentTime;
        if (noteStartTime >= 0 && noteStartTime < this.duration - this.currentTime) {
          const scheduledTime = playbackStartTime + noteStartTime;
          const audioNodes = this.createDrumSound(
            channelData.channel,
            note.pitch,
            note.velocity,
            scheduledTime,
            note.duration
          );
          
          if (audioNodes) {
            this.scheduledNotes.push(audioNodes);
          }
        }
      });
    });
  }
  
  stopScheduledNotes() {
    // Stop all currently scheduled notes
    this.scheduledNotes.forEach(nodes => {
      try {
        if (nodes.oscillator) nodes.oscillator.stop();
        if (nodes.noiseSource) nodes.noiseSource.stop();
      } catch (e) {
        // Node might already be stopped
      }
    });
    this.scheduledNotes = [];
  }
  
  pause() {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Stop both Magenta and synthesized audio playback
    this.stopMagentaPlayback();
    this.stopScheduledNotes();
    
    // Update button states
    document.getElementById('midi-play-btn').innerHTML = '<span class="icon"><i class="fas fa-play"></i></span><span>Play MIDI</span>';
  }
  
  stop() {
    this.isPlaying = false;
    this.currentTime = 0;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Stop both Magenta and synthesized audio playback
    this.stopMagentaPlayback();
    this.stopScheduledNotes();
    
    this.draw();
    this.updateProgress();
    
    // Update button states
    document.getElementById('midi-play-btn').innerHTML = '<span class="icon"><i class="fas fa-play"></i></span><span>Play MIDI</span>';
  }
  
  animate() {
    if (!this.isPlaying) return;
    
    this.currentTime = (Date.now() - this.startTime) / 1000;
    
    if (this.currentTime >= this.duration) {
      this.stop();
      return;
    }
    
    this.draw();
    this.updateProgress();
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  updateProgress() {
    const progress = (this.currentTime / this.duration) * 100;
    document.getElementById('midi-progress').value = progress;
  }
}

// Initialize MIDI visualizer when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the new visualizer
  initializeNewVisualizer();
});

// New visualizer initialization
function initializeNewVisualizer() {
  console.log('🎵 Initializing new D3.js + Magenta visualizer...');
  
  const midiFilePath = './static/1_funk-groove1_138_beat_4-4.mid';
  let isPlaying = false;
  let player = null;
  let noteSequence = null;
  
  // Initialize Magenta player
  if (typeof mm !== 'undefined') {
    player = new mm.Player();
    console.log('✅ Magenta Player initialized');
  } else {
    console.warn('⚠️ Magenta not available');
  }
  
  // Load MIDI file
  loadMidiForVisualizer(midiFilePath).then(sequence => {
    noteSequence = sequence;
    if (sequence) {
      createD3Visualization(sequence);
      console.log('✅ D3 visualization created');
    }
  }).catch(error => {
    console.error('❌ Failed to load MIDI for visualizer:', error);
  });
  
  // Play/Pause button functionality
  const btnPlaySample = document.getElementById('btnPlaySample');
  const iconPlay = btnPlaySample.querySelector('.iconPlay');
  const iconStop = btnPlaySample.querySelector('.iconStop');
  
  btnPlaySample.addEventListener('click', function() {
    if (!isPlaying && noteSequence && player) {
      // Start playing
      player.start(noteSequence).then(() => {
        isPlaying = true;
        iconPlay.hidden = true;
        iconStop.hidden = false;
        console.log('▶️ Started playback');
      }).catch(error => {
        console.error('❌ Playback failed:', error);
      });
    } else if (isPlaying && player) {
      // Stop playing
      player.stop();
      isPlaying = false;
      iconPlay.hidden = false;
      iconStop.hidden = true;
      console.log('⏹️ Stopped playback');
    }
  });
}

// Load MIDI file for the new visualizer
async function loadMidiForVisualizer(url) {
  try {
    console.log('🎵 Loading MIDI for D3 visualizer:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const midiArray = new Uint8Array(arrayBuffer);
    
    // Convert to Magenta NoteSequence
    if (typeof mm !== 'undefined' && mm.midiToSequenceProto) {
      const sequence = mm.midiToSequenceProto(midiArray);
      console.log('✅ MIDI converted to NoteSequence:', sequence);
      return sequence;
    } else {
      console.warn('⚠️ Magenta MIDI conversion not available');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to load MIDI:', error);
    return null;
  }
}

// Create D3.js visualization
function createD3Visualization(noteSequence) {
  const svg = d3.select('#vizSample');
  const width = 800;
  const height = 150;
  
  svg.attr('width', width).attr('height', height);
  
  if (!noteSequence || !noteSequence.notes || noteSequence.notes.length === 0) {
    console.warn('⚠️ No notes to visualize');
    return;
  }
  
  const notes = noteSequence.notes;
  const maxTime = d3.max(notes, d => d.endTime);
  
  // Scales
  const xScale = d3.scaleLinear()
    .domain([0, maxTime])
    .range([0, width]);
  
  const yScale = d3.scaleLinear()
    .domain([d3.min(notes, d => d.pitch), d3.max(notes, d => d.pitch)])
    .range([height - 20, 20]);
  
  // Color scale for velocity
  const colorScale = d3.scaleSequential(d3.interpolateViridis)
    .domain([0, 127]);
  
  // Draw notes
  svg.selectAll('.note')
    .data(notes)
    .enter()
    .append('rect')
    .attr('class', 'note')
    .attr('x', d => xScale(d.startTime))
    .attr('y', d => yScale(d.pitch))
    .attr('width', d => Math.max(2, xScale(d.endTime - d.startTime)))
    .attr('height', 4)
    .attr('fill', d => colorScale(d.velocity || 80))
    .attr('opacity', 0.8);
  
  console.log(`🎨 D3 visualization created with ${notes.length} notes`);
}

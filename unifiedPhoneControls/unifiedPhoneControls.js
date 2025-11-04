import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Voice Call fields
const VOICE_CALL_FIELDS = [
    'VoiceCall.Id',
    'VoiceCall.FromPhoneNumber',
    'VoiceCall.ToPhoneNumber',
    'VoiceCall.CallType',
    'VoiceCall.CallStartDateTime',
    'VoiceCall.CallEndDateTime',
    'VoiceCall.CallDurationInSeconds'
];

export default class UnifiedPhoneControls extends LightningElement {
    // Public properties
    @api recordId; // Voice Call record ID
    @api debugMode = false; // Enable debug information display
    @api toolbarBackgroundColor = 'rgba(0, 0, 0, 0.85)'; // Customizable toolbar background color
    @api toolbarStyle = 'modern'; // Toolbar visual style (modern, classic, minimal, custom)

    // Call state tracking
    @track isCallActive = false;
    @track callStatus = 'No Call'; // Start with no active call
    @track isOnHold = false;
    @track isMuted = false;
    @track isRecording = true;

    // Timer properties - Call Duration
    @track callDuration = 0; // Total call duration in seconds
    @track formattedCallDuration = '00:00:00';
    callStartTime = null; // Will be set when call actually connects
    callDurationInterval = null;

    // Timer properties - Hold Timer (enhanced from original component)
    @track totalHoldTime = 0; // Accumulated hold time in seconds
    @track currentHoldStart = null; // Timestamp when current hold started
    @track holdSessions = []; // Array of individual hold sessions
    @track formattedTotalHoldTime = '00:00';
    @track holdColorClass = 'hold-timer-green';
    holdTimerInterval = null;

    // Phone number and call info
    @track phoneNumber = '';
    @track callDirection = '';
    @track displayPhoneNumber = '';

    // Telephony integration
    @track telephonyAvailable = false;
    @track toolkitApiAvailable = false;
    @track eventListenersSetup = false;
    
    // Simplified container management (CSS Container Queries handle responsiveness)
    toolkitCheckInterval = null;

    // Debug information
    @track debugMessages = [];
    
    // Call end information from record
    @track callEndDateTime = null;
    
    // Expandable hold details
    @track showHoldDetails = false;

    // Floating pop-out toggle
    @track isFloating = false;
    
    // Drag state
    @track isDragging = false;
    @track dragStartX = 0;
    @track dragStartY = 0;
    @track miniBarX = 0;
    @track miniBarY = 0;

    // Wire to get Voice Call record data
    @wire(getRecord, { recordId: '$recordId', fields: VOICE_CALL_FIELDS })
    voiceCallRecord({ error, data }) {
        if (data) {
            this.addDebugMessage('Voice Call record loaded successfully');
            this.processVoiceCallData(data);
            this.setupToolkitEventListeners();
        } else if (error) {
            this.addDebugMessage(`Error loading Voice Call record: ${error.body?.message || error.message}`);
        }
    }

    // Lifecycle methods
    connectedCallback() {
        console.log('UnifiedPhoneControls: Component connected', {
            recordId: this.recordId,
            debugMode: this.debugMode
        });
        
        this.addDebugMessage('Unified Phone Controls component initialized');
        
        // Start toolkit polling for telephony integration
        this.startToolkitPolling();
        
        // Bind drag handlers to avoid binding issues
        this.boundHandleDrag = this.handleDrag.bind(this);
        this.boundHandleDragEnd = this.handleDragEnd.bind(this);
    }

    disconnectedCallback() {
        this.cleanupTimers();
        this.stopToolkitPolling();
        
        // Clean up drag event listeners
        if (this.boundHandleDrag) {
            document.removeEventListener('mousemove', this.boundHandleDrag);
            document.removeEventListener('touchmove', this.boundHandleDrag);
        }
        if (this.boundHandleDragEnd) {
            document.removeEventListener('mouseup', this.boundHandleDragEnd);
            document.removeEventListener('touchend', this.boundHandleDragEnd);
        }
    }

    // Process Voice Call record data
    processVoiceCallData(data) {
        try {
            const record = data.fields;
            
            // Set phone number and direction
            this.phoneNumber = record.FromPhoneNumber?.value || record.ToPhoneNumber?.value || '';
            this.displayPhoneNumber = this.formatPhoneNumber(this.phoneNumber);
            this.callDirection = record.CallType?.value === 'Inbound' ? 'Inbound' : 'Outbound';
            
            // Check if call has ended
            this.callEndDateTime = record.CallEndDateTime?.value ? new Date(record.CallEndDateTime.value) : null;
            
            // Note: Call start time will be set when call actually connects to rep
            // We don't use CallStartDateTime from record as it may include queue time
            this.addDebugMessage('Call data loaded - waiting for call connection to start timer');

            this.addDebugMessage(`Call data processed: ${this.displayPhoneNumber} (${this.callDirection})`);
            this.addDebugMessage(`Call end time: ${this.callEndDateTime ? this.callEndDateTime.toISOString() : 'null (call active)'}`);
        } catch (error) {
            this.addDebugMessage(`Error processing call data: ${error.message}`);
        }
    }

    // Format phone number for display
    formatPhoneNumber(phoneNumber) {
        if (!phoneNumber) return '';
        
        // Remove any non-digit characters
        const cleaned = phoneNumber.replace(/\D/g, '');
        
        // Format as +1 (XXX) XXX-XXXX for US numbers
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
        } else if (cleaned.length === 10) {
            return `+1 (${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
        }
        
        return phoneNumber; // Return original if can't format
    }

    // =====================================
    // CALL DURATION TIMER METHODS
    // =====================================

    startCallDurationTimer() {
        if (this.callDurationInterval) {
            clearInterval(this.callDurationInterval);
        }

        this.callDurationInterval = setInterval(() => {
            this.updateCallDuration();
        }, 1000);

        this.addDebugMessage('Call duration timer started');
    }

    updateCallDuration() {
        if (!this.callStartTime || !this.isCallActive) {
            // Show 00:00:00 when call not yet connected
            this.formattedCallDuration = '00:00:00';
            return;
        }

        const now = new Date();
        this.callDuration = Math.floor((now - this.callStartTime) / 1000);
        this.formattedCallDuration = this.formatTime(this.callDuration, true); // true for HH:MM:SS format
    }

    // =====================================
    // HOLD TIMER METHODS (from original component)
    // =====================================

    startHoldTimer() {
        if (this.isOnHold) {
            this.addDebugMessage('Already on hold, ignoring duplicate hold event');
            return;
        }

        this.currentHoldStart = Date.now();
        this.isOnHold = true;
        this.addDebugMessage(`Hold started at: ${new Date(this.currentHoldStart).toISOString()}`);
        console.log(`UnifiedPhoneControls: Hold started - currentHoldStart: ${this.currentHoldStart}, isOnHold: ${this.isOnHold}`);

        // Clear any existing timer first
        if (this.holdTimerInterval) {
            clearInterval(this.holdTimerInterval);
        }

        // Start the hold display timer interval
        this.holdTimerInterval = setInterval(() => {
            console.log('UnifiedPhoneControls: Hold timer interval tick - calling updateHoldDisplayTimer');
            this.updateHoldDisplayTimer();
        }, 1000);

        console.log(`UnifiedPhoneControls: Hold timer interval set up with ID: ${this.holdTimerInterval}`);
        this.showToast('Call on Hold', 'The call has been placed on hold', 'info');
    }

    endHoldTimer() {
        if (!this.isOnHold || !this.currentHoldStart) {
            this.addDebugMessage('Not currently on hold, ignoring resume event');
            return;
        }

        const holdEndTime = Date.now();
        const holdDuration = Math.floor((holdEndTime - this.currentHoldStart) / 1000);
        
        // Add this session to total time and sessions array
        this.totalHoldTime += holdDuration;
        const sessionNumber = this.holdSessions.length + 1;
        this.holdSessions.push({
            sessionNumber: sessionNumber,
            startTime: new Date(this.currentHoldStart).toISOString(),
            endTime: new Date(holdEndTime).toISOString(),
            duration: holdDuration
        });

        // Clear hold state
        this.isOnHold = false;
        this.currentHoldStart = null;

        // Clear the display timer
        if (this.holdTimerInterval) {
            clearInterval(this.holdTimerInterval);
            this.holdTimerInterval = null;
        }

        // Update final display
        this.formattedTotalHoldTime = this.formatTime(this.totalHoldTime);
        this.holdColorClass = this.getHoldColorClass(this.totalHoldTime);

        this.addDebugMessage(`Hold ended. Session: ${holdDuration}s, Total: ${this.totalHoldTime}s`);
        this.showToast('Call Resumed', `Hold session: ${this.formatTime(holdDuration)}`, 'success');
    }

    updateHoldDisplayTimer() {
        if (!this.isOnHold || !this.currentHoldStart) {
            console.log('UnifiedPhoneControls: updateHoldDisplayTimer called but not on hold');
            return;
        }

        const currentHoldDuration = Math.floor((Date.now() - this.currentHoldStart) / 1000);
        const displayTime = this.totalHoldTime + currentHoldDuration;
        
        console.log(`UnifiedPhoneControls: Updating hold timer - Current hold: ${currentHoldDuration}s, Total: ${this.totalHoldTime}s, Display: ${displayTime}s`);
        
        this.formattedTotalHoldTime = this.formatTime(displayTime);
        this.holdColorClass = this.getHoldColorClass(displayTime);
        
        console.log(`UnifiedPhoneControls: Formatted hold time: ${this.formattedTotalHoldTime}, Color: ${this.holdColorClass}`);
    }

    // =====================================
    // TELEPHONY EVENT HANDLING
    // =====================================

    startToolkitPolling() {
        this.addDebugMessage('Starting toolkit API polling...');
        this.toolkitCheckInterval = setInterval(() => {
            this.checkAndSetupToolkitListeners();
        }, 2000); // Check every 2 seconds
    }

    stopToolkitPolling() {
        if (this.toolkitCheckInterval) {
            clearInterval(this.toolkitCheckInterval);
            this.toolkitCheckInterval = null;
        }
    }

    checkAndSetupToolkitListeners() {
        const toolkitApi = this.template.querySelector('lightning-service-cloud-voice-toolkit-api');
        
        if (toolkitApi && !this.eventListenersSetup) {
            this.setupToolkitEventListeners();
        } else if (!toolkitApi && this.eventListenersSetup) {
            // Toolkit API was removed, reset state
            this.eventListenersSetup = false;
            this.toolkitApiAvailable = false;
            this.telephonyAvailable = false;
        }
    }

    setupToolkitEventListeners() {
        if (this.eventListenersSetup) {
            return;
        }

        try {
            const toolkitApi = this.template.querySelector('lightning-service-cloud-voice-toolkit-api');
            
            if (!toolkitApi) {
                this.addDebugMessage('Service Cloud Voice Toolkit API not found');
                return;
            }

            this.toolkitApiAvailable = true;
            this.telephonyAvailable = true;
            this.eventListenersSetup = true;
            this.addDebugMessage('Service Cloud Voice Toolkit API found and ready');
            this.addDebugMessage('Phone controls will show when call events are received');
            
            // Listen for specific telephony events from the toolkit API
            toolkitApi.addEventListener('hold', this.handleHoldEvent.bind(this));
            toolkitApi.addEventListener('resume', this.handleResumeEvent.bind(this));
            toolkitApi.addEventListener('mute', this.handleMuteEvent.bind(this));
            toolkitApi.addEventListener('unmute', this.handleUnmuteEvent.bind(this));
            toolkitApi.addEventListener('callstarted', this.handleCallStartedEvent.bind(this));
            toolkitApi.addEventListener('callconnected', this.handleCallConnectedEvent.bind(this));
            toolkitApi.addEventListener('callended', this.handleCallEndedEvent.bind(this));
            toolkitApi.addEventListener('hangup', this.handleCallEndedEvent.bind(this));
            
            this.addDebugMessage('Event listeners registered for: hold, resume, mute, unmute, callstarted, callconnected, callended, hangup');
            
            // Stop polling once we've found and set up the toolkit
            this.stopToolkitPolling();
        } catch (error) {
            this.telephonyAvailable = false;
            this.addDebugMessage(`Failed to setup toolkit event listeners: ${error.message}`);
        }
    }

    // Event handlers
    handleHoldEvent(event) {
        try {
            this.addDebugMessage(`Received hold event: ${JSON.stringify(event.detail || {})}`);
            console.log('UnifiedPhoneControls: Processing hold event - starting timer');
            this.startHoldTimer();
        } catch (error) {
            this.addDebugMessage(`Error processing hold event: ${error.message}`);
        }
    }

    handleResumeEvent(event) {
        try {
            this.addDebugMessage(`Received resume event: ${JSON.stringify(event.detail || {})}`);
            console.log('UnifiedPhoneControls: Analyzing resume event...', event.detail);
            
            // Since both hold and resume seem to fire "resume" events, 
            // let's try to determine the actual state from the context
            if (this.isOnHold) {
                console.log('UnifiedPhoneControls: Currently on hold, treating this as resume');
                this.endHoldTimer();
            } else {
                console.log('UnifiedPhoneControls: Not currently on hold, treating this as hold');
                this.startHoldTimer();
            }
        } catch (error) {
            this.addDebugMessage(`Error processing resume event: ${error.message}`);
        }
    }

    handleMuteEvent(event) {
        try {
            this.addDebugMessage(`Received mute event: ${JSON.stringify(event.detail || {})}`);
            this.isMuted = true;
            this.showToast('Call Muted', 'The call has been muted', 'info');
        } catch (error) {
            this.addDebugMessage(`Error processing mute event: ${error.message}`);
        }
    }

    handleUnmuteEvent(event) {
        try {
            this.addDebugMessage(`Received unmute event: ${JSON.stringify(event.detail || {})}`);
            this.isMuted = false;
            this.showToast('Call Unmuted', 'The call has been unmuted', 'info');
        } catch (error) {
            this.addDebugMessage(`Error processing unmute event: ${error.message}`);
        }
    }

    handleCallStartedEvent(event) {
        try {
            this.addDebugMessage(`Received call started event: ${JSON.stringify(event.detail || {})}`);
            // Call has started but may not be connected to rep yet
            this.callStatus = 'Incoming';
            this.isCallActive = true;
            this.addDebugMessage('Call started - status set to Incoming');
        } catch (error) {
            this.addDebugMessage(`Error processing call started event: ${error.message}`);
        }
    }

    handleCallConnectedEvent(event) {
        try {
            this.addDebugMessage(`Received call connected event: ${JSON.stringify(event.detail || {})}`);
            // Call is now connected to rep
            this.handleCallStarted();
        } catch (error) {
            this.addDebugMessage(`Error processing call connected event: ${error.message}`);
        }
    }

    handleCallEndedEvent(event) {
        try {
            this.addDebugMessage(`Received call ended event: ${JSON.stringify(event.detail || {})}`);
            this.finalizeCall();
        } catch (error) {
            this.addDebugMessage(`Error processing call ended event: ${error.message}`);
        }
    }

    // =====================================
    // BUTTON CLICK HANDLERS
    // =====================================

    handleFlagCall() {
        this.addDebugMessage('Flag call button clicked');
        // TODO: Implement flag call functionality
        this.showToast('Call Flagged', 'This call has been flagged for review', 'info');
    }

    handleHoldClick() {
        try {
            const toolkitApi = this.template.querySelector('lightning-service-cloud-voice-toolkit-api');
            
            if (!toolkitApi) {
                this.addDebugMessage('Error: Toolkit API not available for hold action');
                this.showToast('Error', 'Telephony service not available', 'error');
                return;
            }

            if (this.isOnHold) {
                // Call resume
                this.addDebugMessage('Calling toolkit API resume()');
                const resumeResult = toolkitApi.resume();
                
                // Check if the method returns a Promise
                if (resumeResult && typeof resumeResult.catch === 'function') {
                    resumeResult.catch(error => {
                        this.addDebugMessage(`Resume action failed: ${error.message}`);
                        this.showToast('Error', 'Failed to resume call', 'error');
                    });
                } else {
                    this.addDebugMessage('Resume method called (no Promise returned)');
                }
            } else {
                // Call hold
                this.addDebugMessage('Calling toolkit API hold()');
                const holdResult = toolkitApi.hold();
                
                // Check if the method returns a Promise
                if (holdResult && typeof holdResult.catch === 'function') {
                    holdResult.catch(error => {
                        this.addDebugMessage(`Hold action failed: ${error.message}`);
                        this.showToast('Error', 'Failed to hold call', 'error');
                    });
                } else {
                    this.addDebugMessage('Hold method called (no Promise returned)');
                }
            }
        } catch (error) {
            this.addDebugMessage(`Error in handleHoldClick: ${error.message}`);
            this.showToast('Error', 'Failed to process hold action', 'error');
        }
    }

    handleMuteClick() {
        console.log('🔇 Mute button clicked!', { isMuted: this.isMuted });
        this.addDebugMessage(`🔇 Mute button clicked - Current state: ${this.isMuted ? 'MUTED' : 'UNMUTED'}`);
        
        try {
            const toolkitApi = this.template.querySelector('lightning-service-cloud-voice-toolkit-api');
            
            if (!toolkitApi) {
                this.addDebugMessage('❌ Error: Toolkit API not available for mute action');
                this.showToast('Error', 'Telephony service not available', 'error');
                return;
            }

            this.addDebugMessage(`📡 Toolkit API found, telephonyAvailable: ${this.telephonyAvailable}`);

            if (this.isMuted) {
                // Call unmute
                this.addDebugMessage('🔊 Attempting to UNMUTE call');
                console.log('🔊 Calling toolkit API unmute()');
                
                const unmuteResult = toolkitApi.unmute();
                
                // Check if the method returns a Promise
                if (unmuteResult && typeof unmuteResult.catch === 'function') {
                    unmuteResult.catch(error => {
                        this.addDebugMessage(`❌ Unmute action failed: ${error.message}`);
                        this.showToast('Error', 'Failed to unmute call', 'error');
                        console.error('Unmute failed:', error);
                    });
                } else {
                    this.addDebugMessage('✅ Unmute method called (no Promise returned)');
                    console.log('✅ Unmute method called successfully');
                }
            } else {
                // Call mute
                this.addDebugMessage('🔇 Attempting to MUTE call');
                console.log('🔇 Calling toolkit API mute()');
                
                const muteResult = toolkitApi.mute();
                
                // Check if the method returns a Promise
                if (muteResult && typeof muteResult.catch === 'function') {
                    muteResult.catch(error => {
                        this.addDebugMessage(`❌ Mute action failed: ${error.message}`);
                        this.showToast('Error', 'Failed to mute call', 'error');
                        console.error('Mute failed:', error);
                    });
                } else {
                    this.addDebugMessage('✅ Mute method called (no Promise returned)');
                    console.log('✅ Mute method called successfully');
                }
            }
        } catch (error) {
            this.addDebugMessage(`❌ Error in handleMuteClick: ${error.message}`);
            this.showToast('Error', 'Failed to process mute action', 'error');
            console.error('handleMuteClick error:', error);
        }
    }

    handleTransfer() {
        try {
            const toolkitApi = this.template.querySelector('lightning-service-cloud-voice-toolkit-api');
            
            if (!toolkitApi) {
                this.addDebugMessage('Error: Toolkit API not available for transfer action');
                this.showToast('Error', 'Telephony service not available', 'error');
                return;
            }

            this.addDebugMessage('Transfer button clicked - opening transfer dialog');
            // TODO: Implement transfer dialog or direct transfer
            // For now, show info message
            this.showToast('Transfer', 'Transfer functionality will be implemented', 'info');
        } catch (error) {
            this.addDebugMessage(`Error in handleTransfer: ${error.message}`);
            this.showToast('Error', 'Failed to process transfer action', 'error');
        }
    }

    handleEndCall() {
        try {
            const toolkitApi = this.template.querySelector('lightning-service-cloud-voice-toolkit-api');
            
            if (!toolkitApi) {
                this.addDebugMessage('Error: Toolkit API not available for end call action');
                this.showToast('Error', 'Telephony service not available', 'error');
                return;
            }

            this.addDebugMessage('Calling toolkit API endCall()');
            const endCallResult = toolkitApi.endCall();
            
            // Check if the method returns a Promise
            if (endCallResult && typeof endCallResult.catch === 'function') {
                endCallResult.catch(error => {
                    this.addDebugMessage(`End call action failed: ${error.message}`);
                    this.showToast('Error', 'Failed to end call', 'error');
                });
            } else {
                this.addDebugMessage('End call method called (no Promise returned)');
                // Since we can't rely on a callended event, finalize immediately
                this.finalizeCall();
            }
        } catch (error) {
            this.addDebugMessage(`Error in handleEndCall: ${error.message}`);
            this.showToast('Error', 'Failed to process end call action', 'error');
        }
    }

    // =====================================
    // UTILITY METHODS
    // =====================================

    handleCallStarted() {
        this.addDebugMessage('Call connected to rep - starting call duration timer');
        this.resetHoldTimer();
        this.isCallActive = true;
        this.callStatus = 'Connected';
        
        // Set call start time to now (when actually connected to rep)
        this.callStartTime = new Date();
        
        // Start the call duration timer now that call is connected
        this.startCallDurationTimer();
        
        // Ensure component is visible now that call is active
        this.addDebugMessage('Call started - phone controls should now be visible');
    }

    finalizeCall() {
        this.addDebugMessage('Call ended - finalizing timers and hiding controls');
        this.isCallActive = false;
        this.callStatus = 'Ended';
        this.callEndDateTime = new Date(); // Mark call as ended now
        this.telephonyAvailable = false; // Mark telephony as no longer available
        
        // End any active hold session
        if (this.isOnHold) {
            this.endHoldTimer();
        }
        
        this.cleanupTimers();
        this.showToast('Call Completed', `Total hold time: ${this.formattedTotalHoldTime}`, 'info');
        
        // Component will now hide due to shouldShowControls returning false
        this.addDebugMessage('Phone controls will now be hidden - telephony session ended');
    }

    resetHoldTimer() {
        this.totalHoldTime = 0;
        this.currentHoldStart = null;
        this.isOnHold = false;
        this.holdSessions = [];
        this.formattedTotalHoldTime = '00:00';
        this.holdColorClass = 'hold-timer-green';
        
        if (this.holdTimerInterval) {
            clearInterval(this.holdTimerInterval);
            this.holdTimerInterval = null;
        }
    }

    cleanupTimers() {
        if (this.callDurationInterval) {
            clearInterval(this.callDurationInterval);
            this.callDurationInterval = null;
        }
        
        if (this.holdTimerInterval) {
            clearInterval(this.holdTimerInterval);
            this.holdTimerInterval = null;
        }
        
        this.stopToolkitPolling();
    }

    formatTime(seconds, includeHours = false) {
        if (!seconds || seconds < 0) return includeHours ? '00:00:00' : '00:00';
        
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (includeHours) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    getHoldColorClass(duration) {
        if (duration <= 30) return 'hold-timer-green';
        if (duration <= 120) return 'hold-timer-yellow';
        return 'hold-timer-red';
    }

    addDebugMessage(message) {
        const timestamp = new Date().toISOString();
        const debugEntry = `[${timestamp}] ${message}`;
        this.debugMessages.unshift(debugEntry);
        
        // Keep only last 50 messages to prevent memory issues
        if (this.debugMessages.length > 50) {
            this.debugMessages = this.debugMessages.slice(0, 50);
        }
        
        // Always log to console for debugging
        console.log(`UnifiedPhoneControls: ${debugEntry}`);
    }

    showToast(title, message, variant = 'info') {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(event);
    }

    // =====================================
    // COMPUTED PROPERTIES FOR UI
    // =====================================

    get statusBadgeClass() {
        const baseClass = 'slds-badge slds-badge_';
        switch (this.callStatus) {
            case 'Connected':
                return baseClass + 'success';
            case 'On Hold':
                return baseClass + 'warning';
            case 'Ended':
                return baseClass + 'error';
            case 'Incoming':
                return baseClass + 'light';
            case 'No Call':
                return baseClass + 'light';
            default:
                return baseClass + 'light';
        }
    }

    get holdButtonClass() {
        return this.isOnHold ? 'control-button active' : 'control-button';
    }

    get holdButtonVariant() {
        return this.isOnHold ? 'brand' : 'container';
    }

    get muteButtonClass() {
        return this.isMuted ? 'control-button active' : 'control-button';
    }

    get muteButtonVariant() {
        return this.isMuted ? 'brand' : 'container';
    }

    get holdButtonIcon() {
        return this.isOnHold ? 'utility:play' : 'utility:paused_call';
    }

    get muteButtonIcon() {
        return this.isMuted ? 'utility:volume_off' : 'utility:volume_high';
    }

    get holdButtonTitle() {
        return this.isOnHold ? 'Resume Call' : 'Hold Call';
    }

    get muteButtonTitle() {
        return this.isMuted ? 'Unmute Call' : 'Mute Call';
    }

    // Toolbar-specific class getters for new dark toolbar design
    get holdToolbarClass() {
        return this.isOnHold ? 'toolbar-button toolbar-button-active' : 'toolbar-button';
    }

    get muteToolbarClass() {
        return this.isMuted ? 'toolbar-button toolbar-button-active' : 'toolbar-button';
    }

    get showDebugPanel() {
        return this.debugMode && this.debugMessages.length > 0;
    }

    get hasHoldSessions() {
        return this.holdSessions.length > 0;
    }

    get holdDetailsIcon() {
        return this.showHoldDetails ? 'utility:chevronup' : 'utility:chevrondown';
    }

    get miniBarPosition() {
        if (!this.isFloating) return '';
        return `transform: translate(${this.miniBarX}px, ${this.miniBarY}px);`;
    }

    get miniBarPositionWithBackground() {
        if (!this.isFloating) return '';
        const position = `transform: translate(${this.miniBarX}px, ${this.miniBarY}px);`;
        const background = this.toolbarBackgroundStyle;
        return `${position} ${background}`;
    }

    get shouldShowControls() {
        // Only show phone controls when agent is actively on a live call:
        // 1. Telephony service must be available (indicating live call session)
        // 2. Call must be in an active state (Connected or On Hold)
        // 3. Must have a Voice Call record
        // 4. Call must not have ended
        
        // Must have a Voice Call record ID
        if (!this.recordId) {
            console.log('UnifiedPhoneControls: Hiding controls - no Voice Call record');
            return false;
        }
        
        // Primary requirement: Telephony must be available (indicates live call)
        if (!this.telephonyAvailable) {
            console.log('UnifiedPhoneControls: Hiding controls - no active telephony session');
            return false;
        }
        
        // Never show for "No Call" state
        if (this.callStatus === 'No Call') {
            console.log('UnifiedPhoneControls: Hiding controls - no active call');
            return false;
        }
        
        // Don't show if call has definitively ended
        if (this.callStatus === 'Ended') {
            console.log('UnifiedPhoneControls: Hiding controls - call has ended');
            return false;
        }
        
        // Show only for truly active call states
        const activeStates = ['Connected', 'On Hold'];
        if (activeStates.includes(this.callStatus)) {
            console.log('UnifiedPhoneControls: Showing controls - active call state:', this.callStatus);
            return true;
        }
        
        // "Incoming" state only shows if call is actually active
        if (this.callStatus === 'Incoming' && this.isCallActive) {
            console.log('UnifiedPhoneControls: Showing controls - incoming active call');
            return true;
        }
        
        // Hide by default - wait for call to actually start
        console.log('UnifiedPhoneControls: Hiding controls - waiting for active call, status:', this.callStatus);
        return false;
    }

    // =====================================
    // CONTAINER CLASS MANAGEMENT (CSS Container Queries)
    // =====================================

    // Simplified container class management - CSS Container Queries handle responsive behavior
    get dynamicContainerClass() {
        const floatClass = this.isFloating ? 'floating-overlay' : '';
        return `phone-controls-container ${floatClass}`.trim();
    }

    get popoutIcon() {
        return this.isFloating ? 'utility:dock_panel' : 'utility:new_window';
    }

    get popoutTitle() {
        return this.isFloating ? 'Dock Panel' : 'Pop Out';
    }

    // Dynamic toolbar styling based on configuration
    get toolbarBackgroundStyle() {
        switch (this.toolbarStyle.toLowerCase()) {
            case 'modern':
                return 'background: linear-gradient(145deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.9) 100%);';
            
            case 'classic':
                return 'background: rgba(0, 0, 0, 0.8);';
            
            case 'minimal':
                return 'background: linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.9) 100%); border: 1px solid #e5e7eb;';
            
            case 'custom':
                // Use custom color with automatic gradient generation
                const customColor = this.toolbarBackgroundColor || 'rgba(0, 0, 0, 0.85)';
                if (customColor.includes('gradient') || customColor.includes('linear-gradient')) {
                    return `background: ${customColor};`;
                } else {
                    // Create a subtle gradient from the custom color
                    return `background: linear-gradient(145deg, ${customColor} 0%, ${this.darkenColor(customColor, 0.1)} 100%);`;
                }
            
            default:
                return 'background: linear-gradient(145deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.9) 100%);';
        }
    }

    get toolbarTextColorClass() {
        switch (this.toolbarStyle.toLowerCase()) {
            case 'minimal':
                return 'toolbar-light-theme';
            default:
                return 'toolbar-dark-theme';
        }
    }

    get toolbarCssClasses() {
        const baseClass = 'call-control-toolbar';
        const themeClass = this.toolbarTextColorClass;
        return `${baseClass} ${themeClass}`;
    }

    get miniBarCssClasses() {
        const baseClass = 'mini-bar';
        const themeClass = this.toolbarTextColorClass;
        return `${baseClass} ${themeClass}`;
    }

    // Helper method to darken colors for gradient effect
    darkenColor(color, amount) {
        // Simple approach: if it's rgba, reduce the alpha slightly or adjust RGB values
        if (color.startsWith('rgba')) {
            // Extract rgba values and darken slightly
            const match = color.match(/rgba?\(([^)]+)\)/);
            if (match) {
                const values = match[1].split(',').map(v => v.trim());
                if (values.length >= 3) {
                    const r = Math.max(0, parseInt(values[0]) * (1 - amount));
                    const g = Math.max(0, parseInt(values[1]) * (1 - amount));
                    const b = Math.max(0, parseInt(values[2]) * (1 - amount));
                    const a = values[3] || '1';
                    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
                }
            }
        } else if (color.startsWith('#')) {
            // Handle hex colors
            const hex = color.slice(1);
            const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
            const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
            const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
            return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        }
        
        // Fallback: return original color
        return color;
    }

    // Hold Details toggle method
    toggleHoldDetails() {
        this.showHoldDetails = !this.showHoldDetails;
        this.addDebugMessage(`Hold Details ${this.showHoldDetails ? 'expanded' : 'collapsed'}`);
    }

    // Pop-out / Dock toggle method
    toggleFloating() {
        this.isFloating = !this.isFloating;
        this.addDebugMessage(`Component ${this.isFloating ? 'popped out' : 'docked back'}`);
    }

    // Drag handlers
    handleDragStart(event) {
        // Only drag if NOT clicking on buttons or their children
        if (event.target.tagName === 'LIGHTNING-BUTTON-ICON' || 
            event.target.tagName === 'LIGHTNING-BUTTON' ||
            event.target.closest('lightning-button-icon') ||
            event.target.closest('lightning-button') ||
            event.target.closest('.mini-button') ||
            event.target.closest('.end-call-button') ||
            event.target.closest('.dock-button')) {
            return; // Don't drag when clicking buttons
        }
        
        this.isDragging = true;
        const clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        const clientY = event.clientY || (event.touches && event.touches[0].clientY) || 0;
        
        this.dragStartX = clientX - this.miniBarX;
        this.dragStartY = clientY - this.miniBarY;
        
        document.addEventListener('mousemove', this.boundHandleDrag);
        document.addEventListener('mouseup', this.boundHandleDragEnd);
        document.addEventListener('touchmove', this.boundHandleDrag);
        document.addEventListener('touchend', this.boundHandleDragEnd);
        
        event.preventDefault();
        event.stopPropagation();
    }

    handleDrag(event) {
        if (!this.isDragging) return;
        
        const clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        const clientY = event.clientY || (event.touches && event.touches[0].clientY) || 0;
        
        // Direct position calculation - no restrictions, full freedom
        this.miniBarX = clientX - this.dragStartX;
        this.miniBarY = clientY - this.dragStartY;
        
        event.preventDefault();
    }

    handleDragEnd() {
        this.isDragging = false;
        
        document.removeEventListener('mousemove', this.boundHandleDrag);
        document.removeEventListener('mouseup', this.boundHandleDragEnd);
        document.removeEventListener('touchmove', this.boundHandleDrag);
        document.removeEventListener('touchend', this.boundHandleDragEnd);
    }

    // Public API methods
    @api
    resetTimer() {
        this.resetHoldTimer();
        this.addDebugMessage('Timer reset via public API');
    }

    @api
    getCurrentHoldTime() {
        if (!this.isOnHold || !this.currentHoldStart) return 0;
        return Math.floor((Date.now() - this.currentHoldStart) / 1000);
    }

    @api
    getTotalHoldTime() {
        return this.totalHoldTime + this.getCurrentHoldTime();
    }
}
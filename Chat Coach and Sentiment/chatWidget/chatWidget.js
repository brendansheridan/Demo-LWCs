import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ChatWidget extends LightningElement {
    @api chatTitle = 'Live Chat';
    @api orgName = 'Salesforce';
    @api initialMinimized = false;
    @api position = 'bottom-right'; // bottom-right, bottom-left, top-right, top-left
    
    @track messages = [];
    @track messageText = '';
    @track isConnected = false;
    @track isMinimized = false;
    @track showTypingIndicator = false;
    @track showWelcomeMessage = true;
    @track connectionStatus = 'disconnected';
    @track hasUnreadMessages = false;
    @track unreadCount = 0;
    
    // Reference to the embedded messaging component
    embeddedMessaging;
    
    connectedCallback() {
        this.isMinimized = this.initialMinimized;
        this.initializeChat();
    }
    
    disconnectedCallback() {
        this.cleanup();
    }
    
    // Initialize the chat widget
    initializeChat() {
        // Get reference to the embedded messaging component
        this.embeddedMessaging = this.template.querySelector('#embeddedMessaging');
        
        if (this.embeddedMessaging) {
            // Initialize the embedded messaging component
            this.embeddedMessaging.initialize();
        } else {
            console.error('Embedded Messaging component not found');
        }
    }
    
    // Handle session started from embedded messaging
    handleSessionStarted(event) {
        this.isConnected = true;
        this.connectionStatus = 'connected';
        this.showWelcomeMessage = false;
        
        // Add system message
        this.addSystemMessage('Chat session started. An agent will be with you shortly.');
        
        this.showToast('Success', 'Chat session started', 'success');
    }
    
    // Handle session ended from embedded messaging
    handleSessionEnded(event) {
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
        this.showTypingIndicator = false;
        
        this.addSystemMessage('Chat session has ended. Thank you for contacting us!');
        
        this.showToast('Info', 'Chat session ended', 'info');
    }
    
    // Handle message received from embedded messaging
    handleMessageReceived(event) {
        const messageData = event.detail;
        
        // Add the message to our custom UI
        this.addMessage({
            id: messageData.id || `msg_${Date.now()}`,
            text: messageData.text || messageData.message,
            sender: messageData.sender || 'agent',
            timestamp: messageData.timestamp || new Date(),
            type: messageData.type || 'text'
        });
        
        // Update unread count if minimized
        if (this.isMinimized && messageData.sender === 'agent') {
            this.hasUnreadMessages = true;
            this.unreadCount++;
        }
    }
    
    // Handle agent joined
    handleAgentJoined(event) {
        const agentData = event.detail;
        this.addSystemMessage(`Agent ${agentData.name || 'Support'} has joined the conversation`);
    }
    
    // Handle agent left
    handleAgentLeft(event) {
        this.addSystemMessage('Agent has left the conversation');
    }
    
    // Handle typing started
    handleTypingStarted(event) {
        this.showTypingIndicator = true;
    }
    
    // Handle typing stopped
    handleTypingStopped(event) {
        this.showTypingIndicator = false;
    }
    
    // Send message through embedded messaging
    handleSendMessage() {
        if (!this.messageText.trim() || !this.isConnected) {
            return;
        }
        
        const text = this.messageText.trim();
        
        // Add user message to UI immediately
        this.addMessage({
            id: `user_${Date.now()}`,
            text: text,
            sender: 'user',
            timestamp: new Date(),
            type: 'text'
        });
        
        // Send message through embedded messaging
        if (this.embeddedMessaging) {
            this.embeddedMessaging.sendMessage(text);
        }
        
        this.messageText = '';
        this.showWelcomeMessage = false;
    }
    
    // Add message to the custom UI
    addMessage(messageData) {
        const message = {
            id: messageData.id,
            text: messageData.text,
            timestamp: messageData.timestamp,
            formattedTime: this.formatTime(messageData.timestamp),
            messageClass: `message ${messageData.sender}`,
            isText: messageData.type === 'text',
            isFile: messageData.type === 'file'
        };
        
        this.messages.push(message);
        this.scrollToBottom();
    }
    
    // Add system message
    addSystemMessage(text) {
        this.addMessage({
            id: `system_${Date.now()}`,
            text: text,
            sender: 'system',
            timestamp: new Date(),
            type: 'text'
        });
    }
    
    // Toggle chat window
    toggleChat() {
        this.isMinimized = !this.isMinimized;
        if (!this.isMinimized) {
            this.hasUnreadMessages = false;
            this.unreadCount = 0;
        }
    }
    
    // Minimize chat
    minimizeChat() {
        this.isMinimized = true;
    }
    
    // Close chat
    closeChat() {
        if (this.embeddedMessaging) {
            this.embeddedMessaging.endSession();
        }
        this.isMinimized = true;
        this.isConnected = false;
    }
    
    // Handle input change
    handleInputChange(event) {
        this.messageText = event.target.value;
    }
    
    // Handle key down (Enter to send)
    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSendMessage();
        }
    }
    
    // Format time for display
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Scroll to bottom of messages
    scrollToBottom() {
        const messagesContainer = this.template.querySelector('[data-messages-container]');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    // Show toast notification
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
    
    // Cleanup resources
    cleanup() {
        if (this.embeddedMessaging) {
            this.embeddedMessaging.cleanup();
        }
    }
    
    // Computed properties
    get isSendDisabled() {
        return !this.messageText.trim() || !this.isConnected;
    }
    
    get positionClass() {
        return `position-${this.position.replace('-', '-')}`;
    }
}
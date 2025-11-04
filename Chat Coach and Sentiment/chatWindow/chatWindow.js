import { LightningElement, api, track } from 'lwc';

export default class ChatWindow extends LightningElement {
    @api open = false;
    @api conversation = [];
    @track input = '';
    @track messages = [];

    staticBotResponse = 'Thank you for your question! Our support team will get back to you soon.';

    renderedCallback() {
        // Update messages when conversation prop changes
        if (this.conversation && this.conversation.length > 0 && this.messages !== this.conversation) {
            this.messages = [...this.conversation];
        }
    }

    handleInput(event) {
        this.input = event.target.value;
    }

    handleSend() {
        if (this.input.trim()) {
            this.messages = [
                ...this.messages,
                { id: Date.now(), role: 'user', text: this.input },
                { id: Date.now() + 1, role: 'bot', text: this.staticBotResponse }
            ];
            this.input = '';
        }
    }
} 
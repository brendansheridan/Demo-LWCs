public with sharing class ChatController {
    
    /**
     * Get organization information for the chat UI
     * @return Organization The current organization details
     */
    @AuraEnabled(cacheable=true)
    public static Organization getOrgInfo() {
        try {
            return [SELECT Id, Name, InstanceName 
                    FROM Organization 
                    LIMIT 1];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching organization info: ' + e.getMessage());
        }
    }
    
    /**
     * Create a new chat session for Embedded Service
     * @param deploymentId The Embedded Service Deployment ID
     * @return Map<String, Object> Session information including session ID
     */
    @AuraEnabled
    public static Map<String, Object> createChatSession(String deploymentId) {
        try {
            if (String.isBlank(deploymentId)) {
                throw new AuraHandledException('Deployment ID is required');
            }
            LiveChatTranscript transcript = new LiveChatTranscript();
            transcript.LiveChatDeploymentId = deploymentId;
            transcript.Status = 'Waiting';
            transcript.StartTime = System.now();
            insert transcript;
            Map<String, Object> sessionInfo = new Map<String, Object>();
            sessionInfo.put('sessionId', transcript.Id);
            sessionInfo.put('deploymentId', deploymentId);
            sessionInfo.put('status', transcript.Status);
            sessionInfo.put('startTime', transcript.StartTime);
            return sessionInfo;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating chat session: ' + e.getMessage());
        }
    }
    
    /**
     * Send a message in the chat session
     * @param sessionId The chat session ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean sendMessage(String sessionId) {
        try {
            if (String.isBlank(sessionId)) {
                throw new AuraHandledException('Session ID is required');
            }
            LiveChatTranscriptEvent event = new LiveChatTranscriptEvent();
            event.LiveChatTranscriptId = sessionId;
            event.Type = 'ChatMessage';
            insert event;
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error sending message: ' + e.getMessage());
        }
    }
    
    /**
     * Get chat session messages
     * @param sessionId The chat session ID
     * @return List<Map<String, Object>> List of messages with metadata
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getSessionMessages(String sessionId) {
        try {
            if (String.isBlank(sessionId)) {
                throw new AuraHandledException('Session ID is required');
            }
            List<Map<String, Object>> messages = new List<Map<String, Object>>();
            List<LiveChatTranscriptEvent> events = [
                SELECT Id, Type, CreatedDate, Name
                FROM LiveChatTranscriptEvent
                WHERE LiveChatTranscriptId = :sessionId
                ORDER BY CreatedDate ASC
            ];
            for (LiveChatTranscriptEvent event : events) {
                Map<String, Object> message = new Map<String, Object>();
                message.put('id', event.Id);
                message.put('type', event.Type);
                message.put('timestamp', event.CreatedDate);
                message.put('name', event.Name);
                messages.add(message);
            }
            return messages;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching messages: ' + e.getMessage());
        }
    }
    
    /**
     * End a chat session
     * @param sessionId The chat session ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean endChatSession(String sessionId) {
        try {
            if (String.isBlank(sessionId)) {
                throw new AuraHandledException('Session ID is required');
            }
            LiveChatTranscript transcript = [
                SELECT Id, Status
                FROM LiveChatTranscript
                WHERE Id = :sessionId
                LIMIT 1
            ];
            transcript.Status = 'Completed';
            transcript.EndTime = System.now();
            update transcript;
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error ending chat session: ' + e.getMessage());
        }
    }
}
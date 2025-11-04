# Chat Coach and Sentiment Package

## Overview
The Chat Coach and Sentiment package provides a comprehensive solution for analyzing customer interactions in Salesforce Service Cloud. It enables automated sentiment analysis for both Voice Calls and Messaging Sessions, along with agent performance coaching capabilities. The package combines Einstein GPT-powered AI analysis with intuitive Lightning Web Components to provide real-time insights into customer sentiment and agent performance.

## Key Features

### 1. **Sentiment Analysis**
- **Automated Sentiment Detection**: Uses Einstein GPT to analyze call and chat transcripts, automatically determining customer sentiment (Positive, Neutral, or Negative)
- **Dual Channel Support**: Works with both Voice Calls and Messaging Sessions
- **Detailed Justification**: Provides AI-generated explanations for sentiment ratings
- **Real-time Tracking**: Track sentiment ratings and detailed feedback on record pages

### 2. **Agent Performance Coaching**
- **Performance Rating Extraction**: Automatically extracts performance ratings (0-10 scale) from coaching analysis
- **Detailed Evaluations**: Provides comprehensive feedback and coaching recommendations
- **Invocable Actions**: Integrates seamlessly with Flow for automated coaching workflows

### 3. **Chat Interface Components**
- **Chat Window**: Full-featured chat interface component for customer interactions
- **Chat Widget**: Internal component supporting chat functionality

## Package Components

### Lightning Web Components

#### `sentimentTracker`
A configurable LWC that displays and manages sentiment ratings for Voice Call and Messaging Session records.

**Features:**
- Displays current sentiment rating (Positive, Neutral, Negative)
- Allows manual sentiment selection when no rating exists
- Shows detailed call/chat sentiment text
- Supports both VoiceCall and MessagingSession objects
- Auto-switches between edit and view modes based on existing sentiment data

**Usage:**
- Add to VoiceCall or MessagingSession record pages
- Configure object API name via `objectApiName` property
- Automatically reads `Sentiment_Rating__c` and `Call_Sentiment__c` fields

#### `chatWindow`
A chat interface component for displaying conversation threads and handling user interactions.

**Features:**
- Displays conversation history
- Handles user input and bot responses
- Supports dynamic conversation updates
- Configurable open/close state

#### `chatWidget`
Internal component supporting chat functionality (not exposed).

### Apex Classes

#### `ChatExtractor`
Invocable Apex class that extracts sentiment ratings and justifications from AI-generated sentiment analysis.

**Invocable Method:** `extractSentimentAndJustification`

**Returns:**
- `SentimentRating`: The extracted sentiment rating (Negative, Neutral, or Positive)
- `SentimentJustification`: Detailed explanation for the sentiment rating

**Usage in Flow:**
1. Call Einstein GPT prompt template to analyze chat/call transcript
2. Pass the AI output to `ChatExtractor.extractSentimentAndJustification`
3. Use the returned values to populate record fields

#### `ChatCoachingExtractor`
Invocable Apex class that extracts performance ratings and evaluations from AI-generated coaching analysis.

**Invocable Method:** `extractPerformanceAndEvaluation`

**Returns:**
- `PerformanceRating`: Extracted agent performance rating (0-10 integer)
- `PerformanceEvaluation`: Detailed coaching feedback and recommendations

**Usage in Flow:**
1. Call Einstein GPT prompt template to analyze agent performance
2. Pass the AI output to `ChatCoachingExtractor.extractPerformanceAndEvaluation`
3. Use the returned values for coaching workflows

#### `ChatController`
Apex controller providing chat session management and organization information.

**Methods:**
- `getOrgInfo()`: Retrieves organization details
- `createChatSession(String deploymentId)`: Creates new chat sessions
- Additional chat management methods

### Einstein GPT Prompt Templates

#### `MSG_Chat_Sentiment`
Evaluates chat transcript sentiment for MessagingSession records.

**Input:** MessagingSession record
**Output:** Sentiment rating (Negative, Neutral, or Positive) with justification

**Features:**
- Analyzes customer messages (prefixed with "End User:")
- Considers tone, emotion, language intensity, and context
- Provides detailed sentiment analysis with justification

#### `Call_Sentiment`
Evaluates call transcript sentiment for VoiceCall records.

**Input:** VoiceCall record
**Output:** Sentiment rating (Negative, Neutral, or Positive) with justification

**Features:**
- Analyzes customer phrases (prefixed with "End User:")
- Evaluates multiple sentiment indicators
- Provides comprehensive sentiment analysis

### Custom Fields

#### MessagingSession Object
- `Sentiment_Rating__c`: Stores the sentiment rating (Positive, Neutral, Negative)
- `ChatSentiment__c`: Stores detailed sentiment justification text

**Note:** VoiceCall object likely has similar fields (`Sentiment_Rating__c`, `Call_Sentiment__c`) that should be created separately.

## Workflow Integration

The package is designed to work with Salesforce Flows:

1. **Automated Sentiment Analysis Flow:**
   - Trigger: After Voice Call or Messaging Session ends
   - Steps:
     1. Get transcript using conversation summarization flow
     2. Call Einstein GPT prompt template (Call_Sentiment or MSG_Chat_Sentiment)
     3. Extract sentiment using ChatExtractor
     4. Update record fields with sentiment rating and justification

2. **Agent Coaching Flow:**
   - Trigger: After coaching analysis or manual trigger
   - Steps:
     1. Call Einstein GPT prompt template for performance analysis
     2. Extract coaching data using ChatCoachingExtractor
     3. Store performance rating and evaluation
     4. Optionally trigger notifications or create coaching records

## Installation & Setup

### Prerequisites
- Salesforce org with Service Cloud enabled
- Einstein GPT enabled and configured
- Lightning Experience enabled
- Custom fields created on VoiceCall and/or MessagingSession objects

### Deployment Steps

1. **Deploy Custom Fields:**
   - Create `Sentiment_Rating__c` (Picklist: Positive, Neutral, Negative)
   - Create `Call_Sentiment__c` / `ChatSentiment__c` (Long Text Area)

2. **Deploy Apex Classes:**
   - Deploy all Apex classes from the `classes/` folder
   - Ensure test coverage requirements are met

3. **Deploy Lightning Web Components:**
   - Deploy all LWC components from the `lwc/` folders
   - Add `sentimentTracker` to VoiceCall and/or MessagingSession record pages

4. **Deploy Prompt Templates:**
   - Deploy prompt templates from `genAiPromptTemplates/` folder
   - Configure with appropriate Einstein GPT model

5. **Configure Flows:**
   - Create flows that call the prompt templates and extractors
   - Set up automation triggers (after call/chat ends)

## Usage Examples

### Adding Sentiment Tracker to Record Page
1. Edit VoiceCall or MessagingSession record page in App Builder
2. Drag `sentimentTracker` component onto the page
3. Set `objectApiName` property to "VoiceCall" or "MessagingSession"
4. Save and activate the page

### Using Extractors in Flow
1. Add an "Action" element to your Flow
2. Select "ChatExtractor" or "ChatCoachingExtractor"
3. Pass the AI output from your prompt template
4. Map the returned values to record fields

## Technical Details

- **API Version**: Components use API versions 60.0-62.0
- **Dependencies**: Einstein GPT, Lightning Data Service, UI Record API
- **Browser Support**: Modern browsers supporting ES6+ and Web Components
- **Accessibility**: Components follow SLDS accessibility guidelines

## Notes

- The package uses Einstein GPT for AI-powered analysis. Ensure proper model configuration and credits availability.
- Custom fields must be created before deploying components that reference them.
- Flows are not included in this package but should be configured separately based on your automation requirements.
- The `chatWidget` component is not exposed and is used internally by other components.

## Support

This package is provided as-is for demonstration and learning purposes. For production deployments, ensure proper testing, security review, and compliance with your organization's standards.

## License

MIT License - See repository LICENSE file for details.


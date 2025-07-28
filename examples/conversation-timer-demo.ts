/**
 * Demo: Timer-based Meta Processing in Conversation Mode
 * 
 * Shows how meta processing provides regular updates during
 * interactive conversations, even during pauses in activity.
 */

import { Agent } from '@just-every/ensemble';
import { runTask, addMessageToTask } from '../index';

const agent = new Agent({
    name: 'ConversationAssistant',
    modelClass: 'standard',
    instructions: 'You are a helpful AI assistant engaged in conversation. Be concise but informative.'
});

async function simulateConversation() {
    console.log('=== Conversation Mode with Timer-based Updates ===\n');
    console.log('This simulates a chat where users type at different speeds.\n');

    const task = runTask(agent, 'Hello! I want to discuss machine learning concepts.', {
        memory: { enabled: true },
        cognition: { frequency: 10 },
        runIndefinitely: true
    });

    const startTime = Date.now();
    
    // Simulate user messages with realistic delays
    const userMessages = [
        { delay: 3000, text: "Can you explain what neural networks are?" },
        { delay: 15000, text: "That's interesting. How do they learn?" },  // User thinking
        { delay: 5000, text: "What about convolutional neural networks?" },
        { delay: 45000, text: "I need to think about this... OK, so CNNs are for images?" }, // Long pause
        { delay: 2000, text: "Can you give me a practical example?" },
        { delay: 35000, text: "Thanks! One more question - what are transformers?" } // Another pause
    ];

    let messageIndex = 0;
    let lastUserMessageTime = startTime;
    let conversationActive = true;

    // Process events
    const processEvents = async () => {
        for await (const event of task) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const timeSinceLastMessage = ((Date.now() - lastUserMessageTime) / 1000).toFixed(1);

            switch (event.type) {
                case 'response_output':
                    if (event.message?.content) {
                        console.log(`\n🤖 [${elapsed}s] Assistant: ${event.message.content.substring(0, 150)}...`);
                        
                        // Schedule next user message
                        if (messageIndex < userMessages.length) {
                            const nextMessage = userMessages[messageIndex];
                            messageIndex++;
                            
                            console.log(`\n⏳ User is typing... (will send in ${nextMessage.delay / 1000}s)`);
                            
                            setTimeout(() => {
                                if (conversationActive) {
                                    console.log(`\n👤 [${((Date.now() - startTime) / 1000).toFixed(1)}s] User: ${nextMessage.text}`);
                                    lastUserMessageTime = Date.now();
                                    addMessageToTask(task, {
                                        type: 'message',
                                        role: 'user',
                                        content: nextMessage.text
                                    });
                                }
                            }, nextMessage.delay);
                        } else {
                            // End conversation after last response
                            setTimeout(() => {
                                console.log('\n👋 Conversation ended by user');
                                conversationActive = false;
                            }, 5000);
                        }
                    }
                    break;

                case 'metamemory_event':
                    if (event.operation === 'tagging_complete') {
                        console.log(`\n📝 [${elapsed}s] MEMORY UPDATE (${timeSinceLastMessage}s since last message)`);
                        if (event.data?.state?.topicTags) {
                            const topics = Object.keys(event.data.state.topicTags);
                            console.log(`   Topics discussed: ${topics.join(', ') || 'none yet'}`);
                        }
                        console.log(`   💡 Client can update UI with current topics`);
                    }
                    break;

                case 'metacognition_event':
                    if (event.operation === 'analysis_complete') {
                        console.log(`\n🧠 [${elapsed}s] COGNITION UPDATE (${timeSinceLastMessage}s since last message)`);
                        console.log(`   Conversation quality check completed`);
                        console.log(`   💡 Client can show conversation insights`);
                    }
                    break;

                case 'error':
                    console.error(`\n❌ Error:`, event.error?.message);
                    conversationActive = false;
                    break;
            }

            if (!conversationActive && messageIndex >= userMessages.length) {
                break;
            }
        }
    };

    await processEvents();

    console.log('\n\n📊 Summary:');
    console.log('- Meta updates occurred during user "thinking" pauses');
    console.log('- Topics were tracked throughout the conversation');
    console.log('- Updates happened independently of message flow');
    console.log('- Client could update UI even when user was idle\n');
}

// Run the demo
simulateConversation().catch(console.error);
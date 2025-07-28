/**
 * Automated Conversation Mode Example
 * 
 * This example demonstrates metacognition triggering in conversation mode
 * without user interaction - perfect for testing.
 */

import { runTask, addMessageToTask } from '../index.js';
import { Agent } from '@just-every/ensemble';

async function main() {
    console.log('🤖 Automated Conversation Mode Test\n');
    
    const agent = new Agent({
        name: 'AutoConversationAgent',
        modelClass: 'reasoning',
        instructions: 'You are having a conversation. Keep responses brief (1-2 sentences).'
    });
    
    // Configure for conversation mode with low frequency for quick testing
    const taskState = {
        cognition: {
            frequency: 2 // Trigger every 2 messages
        },
        runIndefinitely: true
    };
    
    console.log('Starting automated conversation (metacognition every 2 messages)...\n');
    
    // Start the conversation
    const taskGenerator = runTask(
        agent, 
        'Hello! Let\'s count together. Say "one".',
        taskState
    );
    
    let responseCount = 0;
    let metacognitionTriggered = false;
    const messages = ['Say "two"', 'Say "three"', 'Say "four"', 'Say "five"'];
    let messageIndex = 0;
    
    // Process events
    for await (const event of taskGenerator) {
        if (event.type === 'message_delta' && 'content' in event) {
            process.stdout.write(event.content);
        } else if (event.type === 'metacognition_event') {
            metacognitionTriggered = true;
            console.log(`\n\n🧠 METACOGNITION ${event.operation.toUpperCase()} at request ${event.data?.requestCount}`);
        } else if (event.type === 'response_output') {
            responseCount++;
            console.log(`\n[Response ${responseCount}]\n`);
            
            // Add next message if available
            if (messageIndex < messages.length) {
                console.log(`User: ${messages[messageIndex]}`);
                console.log('Assistant: ');
                
                addMessageToTask(taskGenerator, {
                    type: 'message',
                    role: 'user',
                    content: messages[messageIndex]
                });
                
                messageIndex++;
            } else {
                // We've sent all messages, break the loop
                console.log('\n✅ Conversation complete!');
                break;
            }
        }
    }
    
    console.log('\n📊 Summary:');
    console.log(`- Total responses: ${responseCount}`);
    console.log(`- Metacognition triggered: ${metacognitionTriggered ? 'YES' : 'NO'}`);
    
    if (metacognitionTriggered) {
        console.log('\n✨ Success! Metacognition triggered without using resumeTask.');
    } else {
        console.log('\n⚠️  Metacognition did not trigger. You may need more messages.');
    }
    
    process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
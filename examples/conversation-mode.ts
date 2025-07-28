/**
 * Conversation Mode Example
 * 
 * This example demonstrates how to use runIndefinitely to have
 * a continuous conversation where metacognition triggers naturally
 * without using resumeTask.
 */

import { runTask, addMessageToTask } from '../index.js';
import { Agent } from '@just-every/ensemble';
import * as readline from 'readline';

async function main() {
    console.log('💬 Conversation Mode Example\n');
    console.log('This shows metacognition triggering in a continuous conversation.\n');
    
    const agent = new Agent({
        name: 'ConversationAgent',
        modelClass: 'reasoning',
        instructions: 'You are a helpful assistant. Have natural conversations with the user.'
    });
    
    // Configure for conversation mode
    const taskState = {
        cognition: {
            frequency: 3 // Trigger metacognition every 3 exchanges
        },
        runIndefinitely: true // Key: prevents automatic task completion
    };
    
    console.log('Starting conversation (metacognition every 3 messages)...');
    console.log('Type "exit" to end the conversation.\n');
    
    // Start the conversation
    const taskGenerator = runTask(
        agent, 
        'Hello! I\'m ready to have a conversation with you. What would you like to talk about?',
        taskState
    );
    
    // Set up readline for user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    let requestCount = 0;
    let isProcessing = false;
    
    // Process task events
    (async () => {
        for await (const event of taskGenerator) {
            if (event.type === 'message_delta' && 'content' in event) {
                process.stdout.write(event.content);
            } else if (event.type === 'metacognition_event') {
                console.log(`\n🧠 METACOGNITION ${event.operation.toUpperCase()} at request ${event.data?.requestCount}\n`);
            } else if (event.type === 'response_output') {
                requestCount++;
                console.log(`\n[Request count: ${requestCount}]\n`);
                isProcessing = false;
            }
        }
    })();
    
    // Handle user input
    const askQuestion = () => {
        rl.question('You: ', async (answer) => {
            if (answer.toLowerCase() === 'exit') {
                console.log('\n👋 Ending conversation...');
                rl.close();
                process.exit(0);
            }
            
            if (!isProcessing) {
                isProcessing = true;
                console.log('\nAssistant: ');
                
                // Add user message to the ongoing task
                addMessageToTask(taskGenerator, {
                    type: 'message',
                    role: 'user',
                    content: answer
                });
            }
            
            // Continue asking for input
            setTimeout(askQuestion, 100);
        });
    };
    
    // Start the conversation loop
    askQuestion();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
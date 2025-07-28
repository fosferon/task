/**
 * Working Metacognition Example
 * 
 * This example demonstrates how to properly trigger metacognition
 * by using resumeTask to continue conversations across multiple requests.
 */

import { runTask, resumeTask } from '../index.js';
import { Agent } from '@just-every/ensemble';

async function main() {
    console.log('🧠 Working Metacognition Example\n');
    console.log('This shows how to trigger metacognition every 5 requests.\n');
    
    const agent = new Agent({
        name: 'MetaCognitiveAgent',
        modelClass: 'reasoning',
        instructions: 'You are a helpful assistant. Answer questions concisely.'
    });
    
    // Configure metacognition to trigger every 5 requests
    const initialState = {
        cognition: {
            frequency: 5
        }
    };
    
    let finalState: any = null;
    let requestCount = 0;
    
    // Questions to ask in sequence
    const questions = [
        'What is 2+2?',
        'What is the capital of France?',
        'Name a primary color.',
        'What is H2O?',
        'What year is it?' // This should trigger metacognition
    ];
    
    console.log('Starting conversation...\n');
    
    // First question
    console.log(`Question 1: ${questions[0]}`);
    for await (const event of runTask(agent, questions[0], initialState)) {
        if (event.type === 'message_delta' && 'content' in event) {
            process.stdout.write(event.content);
        } else if (event.type === 'metacognition_event') {
            console.log(`\n🧠 METACOGNITION ${event.operation.toUpperCase()} at request ${event.data?.requestCount}`);
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            requestCount = finalState.requestCount;
            console.log(`\n[Request count: ${requestCount}]\n`);
            break;
        }
    }
    
    // Continue with remaining questions using resumeTask
    for (let i = 1; i < questions.length; i++) {
        console.log(`Question ${i + 1}: ${questions[i]}`);
        
        for await (const event of resumeTask(agent, finalState, questions[i])) {
            if (event.type === 'message_delta' && 'content' in event) {
                process.stdout.write(event.content);
            } else if (event.type === 'metacognition_event') {
                console.log(`\n🧠 METACOGNITION ${event.operation.toUpperCase()} at request ${event.data?.requestCount}`);
            } else if (event.type === 'task_complete') {
                finalState = event.finalState;
                requestCount = finalState.requestCount;
                console.log(`\n[Request count: ${requestCount}]\n`);
                break;
            }
        }
    }
    
    console.log('\n✅ Conversation complete!');
    console.log(`Total requests: ${requestCount}`);
    console.log('\nMetacognition should have triggered at request 5.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
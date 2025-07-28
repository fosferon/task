/**
 * Demo to verify metacognition frequency is working correctly
 * Should only trigger after 10 messages, not after every message
 */

import { Agent } from '@just-every/ensemble';
import { runTask } from '../index.js';

async function demonstrateMetacognitionFrequency() {
    console.log('\n=== Metacognition Frequency Demo ===\n');
    
    const agent = new Agent({
        name: 'FrequencyTestAgent',
        instructions: 'Count from 1 to 20, one number per message. Be concise.',
        modelClass: 'economical',
    });
    
    let messageCount = 0;
    const cognitionTriggers: number[] = [];
    
    console.log('Starting task with cognition frequency = 10');
    console.log('Metacognition should trigger at messages 10 and 20, NOT after every message\n');
    
    const task = runTask(agent, 'Count from 1 to 20', {
        cognition: { frequency: 10 },
        runIndefinitely: true
    });
    
    for await (const event of task) {
        if (event.type === 'response_output') {
            messageCount++;
            process.stdout.write(`${messageCount} `);
            if (messageCount % 5 === 0) {
                console.log(''); // New line every 5 messages
            }
        }
        
        if (event.type === 'metacognition_event' && event.operation === 'analysis_start') {
            console.log(`\n🧠 METACOGNITION TRIGGERED at message ${messageCount}\n`);
            cognitionTriggers.push(messageCount);
        }
        
        if (messageCount >= 20) {
            console.log('\n\nReached 20 messages, stopping...');
            break;
        }
    }
    
    console.log('\n=== Results ===');
    console.log(`Total messages: ${messageCount}`);
    console.log(`Metacognition triggers: ${cognitionTriggers.join(', ')}`);
    
    if (cognitionTriggers.length === 2 && 
        cognitionTriggers[0] === 10 && 
        cognitionTriggers[1] === 20) {
        console.log('✅ SUCCESS: Metacognition triggered correctly at messages 10 and 20');
    } else {
        console.log('❌ FAILED: Metacognition did not trigger at the expected messages');
    }
}

async function demonstrateCustomFrequency() {
    console.log('\n\n=== Custom Frequency Demo ===\n');
    
    const agent = new Agent({
        name: 'CustomFrequencyAgent',
        instructions: 'Generate a short response for each message.',
        modelClass: 'economical',
    });
    
    let messageCount = 0;
    const cognitionTriggers: number[] = [];
    
    console.log('Starting task with cognition frequency = 5');
    console.log('Metacognition should trigger every 5 messages\n');
    
    const task = runTask(agent, 'Test custom frequency', {
        cognition: { frequency: 5 },
        runIndefinitely: true
    });
    
    for await (const event of task) {
        if (event.type === 'response_output') {
            messageCount++;
            process.stdout.write(`${messageCount} `);
        }
        
        if (event.type === 'metacognition_event' && event.operation === 'analysis_start') {
            console.log(`← 🧠 Metacognition!`);
            cognitionTriggers.push(messageCount);
        }
        
        if (messageCount >= 15) {
            console.log('\n\nReached 15 messages, stopping...');
            break;
        }
    }
    
    console.log('\n=== Results ===');
    console.log(`Metacognition triggers at: ${cognitionTriggers.join(', ')}`);
    console.log('Expected: 5, 10, 15');
    
    const correct = cognitionTriggers.length === 3 &&
                   cognitionTriggers[0] === 5 &&
                   cognitionTriggers[1] === 10 &&
                   cognitionTriggers[2] === 15;
    
    console.log(correct ? '✅ SUCCESS!' : '❌ FAILED');
}

async function main() {
    try {
        await demonstrateMetacognitionFrequency();
        await demonstrateCustomFrequency();
        
        console.log('\n\n=== All Demos Complete ===');
    } catch (error) {
        console.error('Error during demo:', error);
    }
}

main();
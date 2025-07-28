/**
 * Demo: Timer-based Meta Processing
 * 
 * This demo shows how meta memory and meta cognition are triggered
 * independently of the message flow, ensuring clients get updates
 * even during long-running operations.
 */

import { Agent, createToolFunction } from '@just-every/ensemble';
import { runTask } from '../index';

// Create a tool that simulates long-running operations
const longOperationTool = createToolFunction(
    async (task: string, duration: number) => {
        console.log(`\n🔧 Starting ${task} (will take ${duration}ms)...`);
        
        // Simulate work with progress updates
        const steps = 5;
        for (let i = 0; i < steps; i++) {
            await new Promise(resolve => setTimeout(resolve, duration / steps));
            console.log(`   Progress: ${((i + 1) / steps * 100).toFixed(0)}%`);
        }
        
        return `Completed ${task} successfully after ${duration}ms`;
    },
    'Simulate a long-running operation',
    {
        task: { type: 'string', description: 'Task description' },
        duration: { type: 'number', description: 'Duration in milliseconds' }
    },
    undefined,
    'long_operation'
);

// Create a research agent with tools
const agent = new Agent({
    name: 'ResearchAssistant',
    modelClass: 'standard',
    instructions: `You are a research assistant helping with complex analysis tasks.
    Use the long_operation tool to simulate data processing, analysis, and report generation.
    Be conversational and explain what you're doing.`,
    tools: [longOperationTool]
});

async function runDemo() {
    console.log('=== Timer-based Meta Processing Demo ===\n');
    console.log('This demo shows how meta processing runs independently of message flow.');
    console.log('Watch for [META] events that occur during long operations.\n');

    const startTime = Date.now();
    let lastEventTime = startTime;

    const task = runTask(agent, `
        I need help analyzing climate data. Please:
        1. Process the raw climate data (simulate with 45 second operation)
        2. Analyze temperature trends (simulate with 30 second operation)  
        3. Generate a summary report (simulate with 60 second operation)
        
        Explain each step as you go.
    `, {
        memory: { enabled: true },
        cognition: { frequency: 10 }
    });

    // Track different event types
    const eventCounts = {
        messages: 0,
        toolCalls: 0,
        metaMemory: 0,
        metaCognition: 0
    };

    for await (const event of task) {
        const currentTime = Date.now();
        const elapsed = ((currentTime - startTime) / 1000).toFixed(1);
        const sinceLastEvent = ((currentTime - lastEventTime) / 1000).toFixed(1);
        lastEventTime = currentTime;

        switch (event.type) {
            case 'message_delta':
                // Just count message chunks
                eventCounts.messages++;
                break;

            case 'response_output':
                if (event.message?.content) {
                    console.log(`\n💬 [${elapsed}s] Assistant:`, 
                        event.message.content.substring(0, 100) + '...');
                }
                break;

            case 'tool_start':
                eventCounts.toolCalls++;
                console.log(`\n🔨 [${elapsed}s] Tool call:`, event.tool_call?.function?.name);
                break;

            case 'tool_done':
                console.log(`✅ [${elapsed}s] Tool completed`);
                break;

            case 'metamemory_event':
                eventCounts.metaMemory++;
                console.log(`\n🧠 [META MEMORY ${elapsed}s] ${event.operation}`, 
                    `(+${sinceLastEvent}s since last event)`);
                
                if (event.operation === 'tagging_complete' && event.data) {
                    const topics = event.data.state?.topicTags ? 
                        Object.keys(event.data.state.topicTags) : [];
                    console.log(`   Topics tracked: ${topics.join(', ') || 'none yet'}`);
                    console.log(`   Processing time: ${(event.data.processingTime / 1000).toFixed(1)}s`);
                }
                break;

            case 'metacognition_event':
                eventCounts.metaCognition++;
                console.log(`\n🤔 [META COGNITION ${elapsed}s] ${event.operation}`,
                    `(+${sinceLastEvent}s since last event)`);
                
                if (event.operation === 'analysis_complete' && event.data) {
                    console.log(`   Request count: ${event.data.requestCount}`);
                    console.log(`   Processing time: ${(event.data.processingTime / 1000).toFixed(1)}s`);
                }
                break;

            case 'task_complete':
                console.log(`\n✨ [${elapsed}s] Task completed!`);
                console.log('\n📊 Event Summary:');
                console.log(`   Message chunks: ${eventCounts.messages}`);
                console.log(`   Tool calls: ${eventCounts.toolCalls}`);
                console.log(`   Meta memory events: ${eventCounts.metaMemory}`);
                console.log(`   Meta cognition events: ${eventCounts.metaCognition}`);
                console.log(`   Total time: ${elapsed}s`);
                break;

            case 'error':
                console.error(`\n❌ [${elapsed}s] Error:`, event.error?.message);
                break;
        }
    }
}

// Run the demo
console.log('Starting demo...\n');
runDemo().catch(console.error);
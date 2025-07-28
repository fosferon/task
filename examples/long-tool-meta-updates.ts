/**
 * Demo: Meta Updates During Long Tool Calls
 * 
 * This example demonstrates the main benefit of timer-based meta processing:
 * Getting summary updates while a tool is still running.
 */

import { Agent, createToolFunction } from '@just-every/ensemble';
import { runTask } from '../index';

// Create a tool that takes a really long time
const dataProcessingTool = createToolFunction(
    async (dataSize: number) => {
        const duration = dataSize * 1000; // 1 second per GB
        console.log(`\n📊 Processing ${dataSize}GB of data...`);
        console.log(`   Estimated time: ${duration / 1000} seconds`);
        
        // Simulate processing with periodic updates
        const updateInterval = 10000; // Update every 10 seconds
        let processed = 0;
        
        while (processed < duration) {
            await new Promise(resolve => setTimeout(resolve, Math.min(updateInterval, duration - processed)));
            processed += updateInterval;
            const percent = Math.min(100, (processed / duration) * 100);
            console.log(`   Progress: ${percent.toFixed(0)}%`);
        }
        
        return `Successfully processed ${dataSize}GB of data with ${Math.floor(dataSize * 1.5)} million records`;
    },
    'Process large dataset',
    {
        dataSize: { type: 'number', description: 'Size of data in GB' }
    },
    undefined,
    'process_data'
);

const agent = new Agent({
    name: 'DataProcessor',
    modelClass: 'standard',
    instructions: 'You are a data processing assistant. Use the process_data tool when asked to analyze data.',
    tools: [dataProcessingTool]
});

async function runLongToolDemo() {
    console.log('=== Long Tool Call with Meta Updates Demo ===\n');
    console.log('This shows how clients receive meta updates even while tools are running.\n');

    const task = runTask(agent, 
        'Please process our 180GB dataset for analysis. This is for our quarterly report.',
        {
            memory: { enabled: true },
            cognition: { frequency: 10 }
        }
    );

    const startTime = Date.now();
    let toolStartTime: number | null = null;
    let metaEventsDuringTool = 0;

    console.log('📝 Starting task...\n');

    for await (const event of task) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        switch (event.type) {
            case 'response_output':
                if (event.message?.content) {
                    console.log(`💬 [${elapsed}s] Assistant: ${event.message.content}\n`);
                }
                break;

            case 'tool_start':
                toolStartTime = Date.now();
                console.log(`🔧 [${elapsed}s] Tool started: ${event.tool_call?.function?.name}`);
                console.log('⏳ Now watch for meta events while the tool runs...\n');
                break;

            case 'tool_done':
                const toolDuration = toolStartTime ? 
                    ((Date.now() - toolStartTime) / 1000).toFixed(1) : 'unknown';
                console.log(`\n✅ [${elapsed}s] Tool completed after ${toolDuration}s`);
                console.log(`📈 Meta events during tool execution: ${metaEventsDuringTool}\n`);
                toolStartTime = null;
                metaEventsDuringTool = 0;
                break;

            case 'metamemory_event':
                if (toolStartTime) {
                    metaEventsDuringTool++;
                    console.log(`🧠 [${elapsed}s] META MEMORY UPDATE (during tool execution!)`);
                    if (event.operation === 'tagging_complete' && event.data?.state?.topicTags) {
                        const topics = Object.keys(event.data.state.topicTags);
                        console.log(`   Current topics: ${topics.join(', ')}`);
                    }
                } else {
                    console.log(`🧠 [${elapsed}s] Meta memory: ${event.operation}`);
                }
                break;

            case 'metacognition_event':
                if (toolStartTime) {
                    metaEventsDuringTool++;
                    console.log(`🤔 [${elapsed}s] META COGNITION UPDATE (during tool execution!)`);
                    if (event.operation === 'analysis_complete') {
                        console.log(`   System reflection completed`);
                    }
                } else {
                    console.log(`🤔 [${elapsed}s] Meta cognition: ${event.operation}`);
                }
                break;

            case 'task_complete':
                console.log(`\n✨ [${elapsed}s] Task completed successfully!`);
                break;

            case 'error':
                console.error(`❌ [${elapsed}s] Error:`, event.error?.message);
                break;
        }
    }

    console.log('\n📌 Key Benefit Demonstrated:');
    console.log('   Meta processing events occurred DURING the long tool execution,');
    console.log('   allowing clients to receive summaries without waiting for completion.\n');
}

// Run the demo
runLongToolDemo().catch(console.error);
import { describe, it, expect } from 'vitest';
import { Agent } from '@just-every/ensemble';
import { runTask } from '../index';

describe('Verify toolCalls data in metacognition events', () => {
    it('should include toolCalls in metacognition events', async () => {
        const agent = new Agent({
            name: 'TestAgent',
            modelClass: 'testing',
            instructions: 'You are a test agent.',
        });

        const events: any[] = [];
        const task = runTask(agent, 'Generate 12 messages to trigger metacognition', {
            cognition: { frequency: 10 },
            runIndefinitely: true
        });
        
        let messageCount = 0;
        let foundToolCalls = false;
        
        for await (const event of task) {
            events.push(event);
            
            if (event.type === 'response_output') {
                messageCount++;
            }
            
            if (event.type === 'metacognition_event' && event.operation === 'analysis_complete') {
                console.log('\n=== Metacognition Complete Event ===');
                console.log('Has toolCalls?', !!event.data.toolCalls);
                console.log('toolCalls:', event.data.toolCalls);
                console.log('adjustments:', event.data.adjustments);
                console.log('injectedThoughts:', event.data.injectedThoughts);
                
                if (event.data.toolCalls) {
                    foundToolCalls = true;
                }
            }
            
            if (messageCount >= 12) {
                break;
            }
        }
        
        // We should have triggered metacognition and it should have toolCalls
        expect(foundToolCalls).toBe(true);
    });
});
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '@just-every/ensemble';
import { runTask } from '../index';

describe('Stuck state detection (2-minute threshold)', () => {
    it('should detect and reset stuck processing states', async () => {
        // Mock console to capture warnings
        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = vi.fn((...args: any[]) => {
            const message = args.join(' ');
            warnings.push(message);
            // Don't call originalWarn to avoid duplicate output
        });

        const agent = new Agent({
            name: 'TestAgent',
            modelClass: 'testing',
            instructions: 'Count numbers',
        });

        // Create a stuck state from 3 minutes ago
        const stuckTime = Date.now() - (3 * 60 * 1000);
        
        const initialState = {
            messages: [],
            cognition: {
                frequency: 2, // Trigger after 2 messages
                processing: true,
                lastProcessingStartTime: stuckTime
            },
            memory: {
                enabled: true,
                processing: true, 
                lastProcessingStartTime: stuckTime
            },
            runIndefinitely: true
        };

        const task = runTask(agent, 'Count', initialState);
        
        let messageCount = 0;
        let metaCognitionTriggered = false;
        let metaMemoryTriggered = false;
        
        for await (const event of task) {
            if (event.type === 'response_output') {
                messageCount++;
                
                // After 2 messages, wait for debounce
                if (messageCount === 2) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            
            if (event.type === 'metacognition_event' && event.operation === 'analysis_start') {
                metaCognitionTriggered = true;
            }
            
            if (event.type === 'metamemory_event' && event.operation === 'tagging_start') {
                metaMemoryTriggered = true;
            }
            
            // Stop after enough messages
            if (messageCount >= 3) {
                break;
            }
        }
        
        console.warn = originalWarn;
        
        // Check that stuck warnings were logged
        const cognitionStuckWarning = warnings.find(w => 
            w.includes('[Task] Meta cognition processing appears stuck') &&
            w.includes('forcibly resetting')
        );
        
        const memoryStuckWarning = warnings.find(w =>
            w.includes('[Task] Meta memory processing appears stuck') &&
            w.includes('forcibly resetting')
        );
        
        // At least one stuck warning should have been logged
        const hasStuckWarning = !!(cognitionStuckWarning || memoryStuckWarning);
        
        console.log('\nTest Results:');
        console.log('- Messages processed:', messageCount);
        console.log('- Cognition stuck warning:', cognitionStuckWarning ? 'Yes' : 'No');
        console.log('- Memory stuck warning:', memoryStuckWarning ? 'Yes' : 'No');
        console.log('- Meta cognition triggered:', metaCognitionTriggered);
        console.log('- Meta memory triggered:', metaMemoryTriggered);
        console.log('- Total warnings:', warnings.length);
        
        if (warnings.length > 0) {
            console.log('\nCaptured warnings:');
            warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
        }
        
        // The test passes if we detected stuck state
        expect(hasStuckWarning).toBe(true);
    }, 20000);
});
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '@just-every/ensemble';
import { runTask } from '../index';

describe('Stuck state detection unit test', () => {
    it('should reset stuck processing when attempting new processing', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        const agent = new Agent({
            name: 'TestAgent',
            modelClass: 'testing',
            instructions: 'Count numbers'
        });
        
        // Set up initial state with stuck processing from 3 minutes ago
        const stuckTime = Date.now() - (3 * 60 * 1000);
        
        const initialState = {
            messages: [],
            cognition: {
                frequency: 2, // Trigger cognition after 2 messages
                processing: true,
                lastProcessingStartTime: stuckTime
            },
            memory: {
                enabled: false // Disable memory to simplify test
            },
            runIndefinitely: true
        };
        
        const task = runTask(agent, 'Count numbers', initialState);
        
        let messageCount = 0;
        
        for await (const event of task) {
            if (event.type === 'response_output') {
                messageCount++;
                
                // After 2 messages, cognition should try to process
                // This is when stuck detection should trigger
                if (messageCount === 2) {
                    // Give time for debounce timer
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            
            // Collect enough messages to ensure processing was attempted
            if (messageCount >= 3) {
                break;
            }
        }
        
        // Find the stuck warning in console output
        const warnings = consoleWarnSpy.mock.calls
            .map(call => call[0])
            .filter(msg => typeof msg === 'string');
        
        const stuckWarning = warnings.find(msg => 
            msg.includes('[Task] Meta cognition processing appears stuck') &&
            msg.includes('180s') && // 3 minutes = 180 seconds
            msg.includes('forcibly resetting')
        );
        
        expect(stuckWarning).toBeTruthy();
        
        // Also check that cognition processing was attempted after reset
        const logs = consoleLogSpy.mock.calls
            .map(call => call[0])
            .filter(msg => typeof msg === 'string');
            
        const processingLog = logs.find(msg =>
            msg.includes('[Task] Processing meta cognition')
        );
        
        expect(processingLog).toBeTruthy();
        
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
    }, 15000);
});
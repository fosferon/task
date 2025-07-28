import { describe, it, expect, vi } from 'vitest';
import { Agent } from '@just-every/ensemble';
import { runTask, resumeTask } from '../index';

describe('Comprehensive stuck state detection tests', () => {
    it('should NOT trigger stuck detection for processing under 2 minutes', async () => {
        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = vi.fn((...args: any[]) => {
            warnings.push(args.join(' '));
        });

        const agent = new Agent({
            name: 'TestAgent',
            modelClass: 'testing',
            instructions: 'Count numbers when asked.'
        });

        // Create state that's only 1.5 minutes old (not stuck)
        const notStuckTime = Date.now() - (1.5 * 60 * 1000);
        
        const initialState = {
            messages: [
                { type: 'message', role: 'user', content: 'Count to 3', id: 'msg1' }
            ],
            cognition: {
                frequency: 2,
                processing: true,
                lastProcessingStartTime: notStuckTime
            },
            memory: {
                enabled: false // Disable memory to simplify test
            }
        };

        const task = runTask(agent, 'Count to 3', initialState);
        
        let messageCount = 0;
        
        for await (const event of task) {
            if (event.type === 'response_output') {
                messageCount++;
                if (messageCount === 2) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            if (event.type === 'task_complete' || messageCount >= 3) {
                break;
            }
        }
        
        console.warn = originalWarn;
        
        const stuckWarnings = warnings.filter(w => 
            w.includes('processing appears stuck')
        );
        
        // Should NOT have any stuck warnings for 1.5 minute old processing
        expect(stuckWarnings.length).toBe(0);
        expect(messageCount).toBeGreaterThan(0);
    }, 10000);

    it('should handle stuck state correctly on task resume', async () => {
        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = vi.fn((...args: any[]) => {
            warnings.push(args.join(' '));
        });

        const agent = new Agent({
            name: 'ResumeAgent',
            modelClass: 'testing',
            instructions: 'Answer questions briefly.'
        });

        // First, create and complete a task
        let finalState: any;
        const task1 = runTask(agent, 'Say hello');
        
        for await (const event of task1) {
            if (event.type === 'task_complete') {
                finalState = event.finalState;
                break;
            }
        }
        
        expect(finalState).toBeDefined();
        
        // Simulate stuck state from 3 minutes ago
        const stuckTime = Date.now() - (3 * 60 * 1000);
        finalState.cognition = {
            frequency: 2,
            processing: true,
            lastProcessingStartTime: stuckTime
        };
        finalState.memory = {
            enabled: false // Disable memory to avoid complications
        };
        
        // Clear warnings from first task
        warnings.length = 0;
        
        // Resume with stuck state
        const task2 = resumeTask(agent, finalState, 'Say goodbye');
        
        let messageCount = 0;
        let processedAfterReset = false;
        
        for await (const event of task2) {
            if (event.type === 'response_output') {
                messageCount++;
                
                // Wait for debounce after 2 messages
                if (messageCount === 2) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            
            if (event.type === 'metacognition_event' && event.operation === 'analysis_start') {
                processedAfterReset = true;
            }
            
            if (event.type === 'task_complete' || messageCount >= 3) {
                break;
            }
        }
        
        console.warn = originalWarn;
        
        const stuckWarnings = warnings.filter(w => 
            w.includes('processing appears stuck')
        );
        
        console.log('Resume test results:', {
            messageCount,
            processedAfterReset,
            stuckWarnings: stuckWarnings.length,
            warnings: warnings
        });
        
        // Should have detected stuck state and processed after reset
        expect(stuckWarnings.length).toBeGreaterThan(0);
        expect(messageCount).toBeGreaterThan(0);
    }, 15000);

    it('should handle exactly 2-minute threshold correctly', async () => {
        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = vi.fn((...args: any[]) => {
            warnings.push(args.join(' '));
        });

        const agent = new Agent({
            name: 'ThresholdAgent',
            modelClass: 'testing',
            instructions: 'Count briefly.'
        });

        // Test exactly 2 minutes + 1 second (should trigger)
        const justOverThreshold = Date.now() - (2 * 60 + 1) * 1000;
        
        const initialState = {
            messages: [
                { type: 'message', role: 'user', content: 'Count to 3', id: 'msg1' }
            ],
            cognition: {
                frequency: 2,
                processing: true,
                lastProcessingStartTime: justOverThreshold
            },
            memory: {
                enabled: false
            }
        };

        const task = runTask(agent, 'Count to 3', initialState);
        
        let messageCount = 0;
        
        for await (const event of task) {
            if (event.type === 'response_output') {
                messageCount++;
                if (messageCount === 2) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            if (event.type === 'task_complete' || messageCount >= 3) {
                break;
            }
        }
        
        console.warn = originalWarn;
        
        const stuckWarning = warnings.find(w => 
            w.includes('[Task] Meta cognition processing appears stuck') &&
            w.includes('forcibly resetting')
        );
        
        console.log('Threshold test results:', {
            messageCount,
            totalWarnings: warnings.length,
            stuckWarning: stuckWarning ? 'Found' : 'Not found',
            warnings: warnings
        });
        
        // Should have triggered for time just over 2 minutes
        expect(stuckWarning).toBeTruthy();
        expect(messageCount).toBeGreaterThan(0);
    }, 10000);
});
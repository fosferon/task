import { describe, it, expect, beforeEach } from 'vitest';
import { runTask } from '../index.js';
import { Agent } from '@just-every/ensemble';

describe('Memory Processing Race Conditions - Simple', () => {
    let mockAgent: Agent;

    beforeEach(() => {
        mockAgent = {
            name: 'test-agent',
            model: 'gpt-4o',
            tools: [],
            instructions: 'You are a test agent. When given a task, immediately call task_complete with the result "Test completed".'
        } as Agent;
    });

    it('should not have race conditions when processing memory', async () => {
        const taskState = {
            memory: {
                enabled: true,
                processing: false
            },
            cognition: {
                enabled: false // Disable cognition for this test
            }
        };

        let memoryEventCount = 0;
        let concurrentStarts = 0;
        let maxConcurrent = 0;
        let currentlyProcessing = 0;

        // Run the task and track memory events
        try {
            for await (const event of runTask(mockAgent, 'Complete this task immediately', taskState)) {
                if (event.type === 'metamemory_event') {
                    memoryEventCount++;
                    
                    if (event.operation === 'tagging_start') {
                        currentlyProcessing++;
                        if (currentlyProcessing > 1) {
                            concurrentStarts++;
                        }
                        maxConcurrent = Math.max(maxConcurrent, currentlyProcessing);
                    } else if (event.operation === 'tagging_complete') {
                        currentlyProcessing--;
                    }
                }
                
                // Exit when task completes
                if (event.type === 'task_complete') {
                    break;
                }
            }
        } catch (error) {
            // Task might abort background processing, which is fine
            console.log('Task completed with error:', error);
        }

        // Verify no concurrent processing occurred
        expect(concurrentStarts).toBe(0);
        expect(maxConcurrent).toBeLessThanOrEqual(1);
        // Note: currentlyProcessing might be 1 if background processing is still running when task completes
        expect(currentlyProcessing).toBeLessThanOrEqual(1);
    });
});
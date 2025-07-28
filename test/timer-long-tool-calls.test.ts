import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent, createToolFunction } from '@just-every/ensemble';
import { runTask } from '../index';
import type { MetaMemoryEvent, MetaCognitionEvent } from '../src/types/events';

// Mock timers
vi.useFakeTimers();

describe('Timer-based Meta Processing during Long Tool Calls', () => {
    let agent: Agent;
    
    beforeEach(() => {
        // Create agent with long-running tool
        const longRunningTool = createToolFunction(
            async (duration: number) => {
                // Simulate long-running operation
                await new Promise(resolve => setTimeout(resolve, duration));
                return `Completed after ${duration}ms`;
            },
            'Simulate a long-running operation',
            {
                duration: {
                    type: 'number',
                    description: 'Duration in milliseconds'
                }
            },
            undefined,
            'long_operation'
        );

        agent = new Agent({
            name: 'TestAgent',
            modelClass: 'testing',
            instructions: 'You are testing long-running tool calls. Use the long_operation tool when asked.',
            tools: [longRunningTool]
        });
        
        vi.clearAllTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it('should trigger meta memory during 3-minute tool call', async () => {
        const events: any[] = [];
        const taskGen = runTask(agent, 'Run a 3-minute operation using long_operation with duration 180000', {
            memory: { enabled: true }
        });

        const collector = async () => {
            for await (const event of taskGen) {
                events.push(event);
                
                if (event.type === 'tool_start' && event.tool_call?.function?.name === 'long_operation') {
                    // Simulate passage of time during tool execution
                    // Advance in 30-second increments
                    for (let i = 0; i < 6; i++) {
                        vi.advanceTimersByTime(30000);
                        
                        // Check if meta events were generated
                        const currentMetaEvents = events.filter(e => 
                            e.type === 'metamemory_event' && e.operation === 'tagging_start'
                        );
                        
                        if (currentMetaEvents.length > 0) {
                            console.log(`Meta memory triggered after ${(i + 1) * 30} seconds`);
                        }
                    }
                }
                
                if (event.type === 'task_complete') break;
            }
        };

        await collector();

        // Should have triggered meta memory during the long tool call
        const memoryEvents = events.filter(e => e.type === 'metamemory_event');
        expect(memoryEvents.length).toBeGreaterThan(0);
        
        // Verify it triggered from the periodic timer (30s)
        const memoryStartEvents = events.filter(e => 
            e.type === 'metamemory_event' && e.operation === 'tagging_start'
        );
        expect(memoryStartEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should trigger meta cognition during 5-minute tool call', async () => {
        const events: any[] = [];
        const taskGen = runTask(agent, 'Run a 5-minute operation using long_operation with duration 300000', {
            cognition: { frequency: 100 } // High frequency to ensure timer is the trigger
        });

        const collector = async () => {
            for await (const event of taskGen) {
                events.push(event);
                
                if (event.type === 'tool_start' && event.tool_call?.function?.name === 'long_operation') {
                    // Advance time in 1-minute increments
                    for (let i = 0; i < 5; i++) {
                        vi.advanceTimersByTime(60000);
                        
                        // Check for cognition events after 2 minutes
                        if (i >= 1) {
                            const cognitionEvents = events.filter(e => 
                                e.type === 'metacognition_event' && e.operation === 'analysis_start'
                            );
                            
                            if (cognitionEvents.length > 0) {
                                console.log(`Meta cognition triggered after ${(i + 1) * 60} seconds`);
                            }
                        }
                    }
                }
                
                if (event.type === 'task_complete') break;
            }
        };

        await collector();

        // Should have triggered meta cognition from the 2-minute timer
        const cognitionEvents = events.filter(e => 
            e.type === 'metacognition_event' && e.operation === 'analysis_start'
        );
        expect(cognitionEvents.length).toBeGreaterThan(0);
    });

    it('should provide client updates during long tool execution', async () => {
        const events: any[] = [];
        const metaEventTimestamps: { event: string, time: number }[] = [];
        
        const taskGen = runTask(agent, 'Run multiple 90-second operations', {
            memory: { enabled: true },
            cognition: { frequency: 10 }
        });

        let simulatedTime = 0;
        const collector = async () => {
            for await (const event of taskGen) {
                events.push(event);
                
                // Track when meta events occur
                if (event.type === 'metamemory_event' || event.type === 'metacognition_event') {
                    metaEventTimestamps.push({
                        event: `${event.type}_${event.operation}`,
                        time: simulatedTime
                    });
                }
                
                if (event.type === 'tool_start') {
                    // Simulate 90-second tool execution
                    const timeIncrement = 10000; // 10 seconds
                    for (let i = 0; i < 9; i++) {
                        vi.advanceTimersByTime(timeIncrement);
                        simulatedTime += timeIncrement;
                    }
                }
                
                if (event.type === 'task_complete') break;
            }
        };

        await collector();

        // Verify that meta events occurred during tool execution
        expect(metaEventTimestamps.length).toBeGreaterThan(0);
        
        // Verify reasonable spacing of events
        console.log('Meta event timeline:', metaEventTimestamps);
        
        // Should have events spaced throughout execution
        const firstEventTime = metaEventTimestamps[0]?.time || 0;
        const lastEventTime = metaEventTimestamps[metaEventTimestamps.length - 1]?.time || 0;
        expect(lastEventTime - firstEventTime).toBeGreaterThan(30000); // At least 30s span
    });

    it('should handle multiple concurrent long operations', async () => {
        const parallelTool = createToolFunction(
            async (operations: number[]) => {
                // Simulate parallel operations
                const results = await Promise.all(
                    operations.map(async (duration, index) => {
                        await new Promise(resolve => setTimeout(resolve, duration));
                        return `Operation ${index} completed in ${duration}ms`;
                    })
                );
                return results.join(', ');
            },
            'Run multiple operations in parallel',
            {
                operations: {
                    type: 'array',
                    description: 'Array of durations in milliseconds'
                }
            },
            undefined,
            'parallel_operations'
        );

        agent.tools = [...(agent.tools || []), parallelTool];

        const events: any[] = [];
        const taskGen = runTask(agent, 'Run parallel_operations with [60000, 90000, 120000]', {
            memory: { enabled: true },
            cognition: { frequency: 10 }
        });

        const collector = async () => {
            for await (const event of taskGen) {
                events.push(event);
                
                if (event.type === 'tool_start' && event.tool_call?.function?.name === 'parallel_operations') {
                    // Simulate time passage for parallel operations
                    // Advance time to cover the longest operation
                    for (let i = 0; i < 12; i++) {
                        vi.advanceTimersByTime(10000); // 10 seconds at a time
                    }
                }
                
                if (event.type === 'task_complete') break;
            }
        };

        await collector();

        // Should have multiple meta events during parallel execution
        const metaEvents = events.filter(e => 
            e.type === 'metamemory_event' || e.type === 'metacognition_event'
        );
        expect(metaEvents.length).toBeGreaterThan(2);
    });

    it('should resume meta processing after tool completion', async () => {
        const events: any[] = [];
        const taskGen = runTask(agent, 'Run long_operation with 45000, then continue working', {
            memory: { enabled: true }
        });

        let toolCompleted = false;
        const collector = async () => {
            for await (const event of taskGen) {
                events.push(event);
                
                if (event.type === 'tool_start') {
                    // 45-second tool execution
                    vi.advanceTimersByTime(45000);
                }
                
                if (event.type === 'tool_done') {
                    toolCompleted = true;
                    // Continue with more messages after tool
                    vi.advanceTimersByTime(2000);
                }
                
                if (toolCompleted && event.type === 'response_output') {
                    // Should trigger meta processing for new messages
                    vi.advanceTimersByTime(1100);
                }
                
                if (event.type === 'task_complete') break;
            }
        };

        await collector();

        // Filter meta events by whether they occurred after tool completion
        const toolDoneIndex = events.findIndex(e => e.type === 'tool_done');
        const postToolMetaEvents = events.slice(toolDoneIndex).filter(e => 
            e.type === 'metamemory_event' || e.type === 'metacognition_event'
        );

        // Should have meta processing both during and after tool
        expect(postToolMetaEvents.length).toBeGreaterThan(0);
    });
});
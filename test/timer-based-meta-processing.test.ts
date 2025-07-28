import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '@just-every/ensemble';
import { runTask } from '../index';
import type { TaskStartEvent, TaskCompleteEvent, MetaMemoryEvent, MetaCognitionEvent } from '../src/types/events';

// Mock timers
vi.useFakeTimers();

describe('Timer-based Meta Processing', () => {
    let agent: Agent;
    
    beforeEach(() => {
        agent = new Agent({
            name: 'TestAgent',
            modelClass: 'testing',
            instructions: 'You are a helpful assistant for testing timer-based meta processing.',
            tools: []
        });
        vi.clearAllTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('Meta Memory Timer Triggers', () => {
        it('should trigger meta memory after 1 second debounce when message is received', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Test task', {
                memory: { enabled: true }
            });

            // Collect events
            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    if (event.type === 'response_output') {
                        // Simulate message received, advance time by 500ms (not enough for debounce)
                        vi.advanceTimersByTime(500);
                    }
                }
            };

            // Start collection
            const collectorPromise = collector();

            // Advance time to trigger debounce after message
            vi.advanceTimersByTime(600); // Total 1100ms, should trigger

            // Check for meta memory events
            const memoryStartEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.operation === 'tagging_start'
            );
            const memoryCompleteEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.operation === 'tagging_complete'
            );

            expect(memoryStartEvents.length).toBeGreaterThan(0);
        });

        it('should trigger meta memory immediately when 10 messages accumulate', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Generate many messages quickly', {
                memory: { enabled: true }
            });

            // Mock rapid message generation
            let messageCount = 0;
            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    if (event.type === 'response_output') {
                        messageCount++;
                        if (messageCount < 15) {
                            // Simulate rapid messages without waiting
                            vi.advanceTimersByTime(50); // Very short time
                        }
                    }
                }
            };

            const collectorPromise = collector();
            
            // Check that memory processing triggered before debounce timeout
            const memoryEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.operation === 'tagging_start'
            );
            
            // Should have triggered due to batch size, not timer
            expect(memoryEvents.length).toBeGreaterThan(0);
        });

    });

    describe('Meta Cognition Timer Triggers', () => {
        it('should trigger meta cognition after 1 second debounce', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Test cognition task', {
                cognition: { frequency: 10 }
            });

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    if (event.type === 'response_output') {
                        vi.advanceTimersByTime(1100); // Trigger debounce
                    }
                }
            };

            const collectorPromise = collector();

            const cognitionEvents = events.filter(e => 
                e.type === 'metacognition_event' && e.operation === 'analysis_start'
            );

            expect(cognitionEvents.length).toBeGreaterThan(0);
        });

        it('should trigger meta cognition after 5 messages', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Generate exactly 5 messages', {
                cognition: { frequency: 10 }
            });

            let messageCount = 0;
            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    if (event.type === 'response_output') {
                        messageCount++;
                        vi.advanceTimersByTime(100); // Short time between messages
                    }
                    if (messageCount >= 5) break;
                }
            };

            const collectorPromise = collector();

            const cognitionEvents = events.filter(e => 
                e.type === 'metacognition_event' && e.operation === 'analysis_start'
            );

            expect(cognitionEvents.length).toBeGreaterThan(0);
        });

        it('should trigger meta cognition every 2 minutes during long operations', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Long running task with tool calls', {
                cognition: { frequency: 100 }, // High frequency to test timer
                runIndefinitely: true
            });

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    if (event.type === 'tool_start') {
                        // Simulate long-running tool
                        vi.advanceTimersByTime(150000); // 2.5 minutes
                    }
                    if (events.length > 50) break;
                }
            };

            const collectorPromise = collector();

            const cognitionEvents = events.filter(e => 
                e.type === 'metacognition_event' && e.operation === 'analysis_start'
            );

            // Should trigger from periodic timer during long tool call
            expect(cognitionEvents.length).toBeGreaterThan(0);
        });
    });

    describe('Timer Cleanup', () => {
        it('should clean up all timers when task completes', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Complete quickly');

            for await (const event of taskGen) {
                events.push(event);
                if (event.type === 'task_complete') {
                    // Verify timers are cleared
                    const activeTimerCount = vi.getTimerCount();
                    expect(activeTimerCount).toBe(0);
                }
            }
        });

        it('should clean up timers on task error', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Fail immediately');

            try {
                for await (const event of taskGen) {
                    events.push(event);
                    if (event.type === 'task_start') {
                        throw new Error('Simulated error');
                    }
                }
            } catch (error) {
                // Expected error
            }

            // Verify timers are cleared after error
            const activeTimerCount = vi.getTimerCount();
            expect(activeTimerCount).toBe(0);
        });
    });

    describe('Concurrent Processing Prevention', () => {
        it('should not start new meta memory processing while one is running', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Rapid message generation', {
                memory: { enabled: true }
            });

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    if (event.type === 'metamemory_event' && event.operation === 'tagging_start') {
                        // Simulate more messages while processing
                        vi.advanceTimersByTime(1100); // Try to trigger again
                    }
                }
            };

            const collectorPromise = collector();

            // Count start events - should only be one at a time
            const startEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.operation === 'tagging_start'
            );
            const completeEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.operation === 'tagging_complete'
            );

            // Each start should have a corresponding complete before next start
            expect(startEvents.length).toBeLessThanOrEqual(completeEvents.length + 1);
        });
    });

    describe('Integration with Existing Features', () => {
        it('should work with task resumption', async () => {
            let finalState: any;
            const events1: any[] = [];
            
            // First task
            const task1 = runTask(agent, 'Initial task', {
                memory: { enabled: true },
                cognition: { frequency: 5 }
            });

            for await (const event of task1) {
                events1.push(event);
                if (event.type === 'task_complete') {
                    finalState = event.finalState;
                    break;
                }
            }

            // Resume task
            const events2: any[] = [];
            const task2 = runTask(agent, 'Continue task', finalState);

            for await (const event of task2) {
                events2.push(event);
                if (event.type === 'response_output') {
                    vi.advanceTimersByTime(1100); // Trigger timers
                }
            }

            // Should have meta events in resumed task
            const metaEvents = events2.filter(e => 
                e.type === 'metamemory_event' || e.type === 'metacognition_event'
            );
            expect(metaEvents.length).toBeGreaterThan(0);
        });

        it('should handle message injection with timer triggers', async () => {
            const { addMessageToTask } = await import('../index');
            const events: any[] = [];
            const taskGen = runTask(agent, 'Interactive task', {
                memory: { enabled: true },
                runIndefinitely: true
            });

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    if (events.length === 5) {
                        // Inject message mid-task
                        addMessageToTask(taskGen, {
                            type: 'message',
                            role: 'user',
                            content: 'Additional instruction'
                        });
                        vi.advanceTimersByTime(1100); // Trigger processing
                    }
                    if (events.length > 20) break;
                }
            };

            const collectorPromise = collector();

            // Should process injected message
            const metaEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.data?.messageCount > 5
            );
            expect(metaEvents.length).toBeGreaterThan(0);
        });
    });

    describe('Event Ordering and Queue Management', () => {
        it('should maintain correct event order with async processing', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Test event ordering', {
                memory: { enabled: true },
                cognition: { frequency: 5 }
            });

            for await (const event of taskGen) {
                events.push({ type: event.type, timestamp: Date.now() });
                if (event.type === 'response_output') {
                    vi.advanceTimersByTime(1100);
                }
                if (events.length > 30) break;
            }

            // Verify events are in chronological order
            for (let i = 1; i < events.length; i++) {
                expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i-1].timestamp);
            }
        });

        it('should handle async event queue properly', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Test async queue', {
                memory: { enabled: true }
            });

            let asyncEventsSeen = false;
            for await (const event of taskGen) {
                events.push(event);
                if (event.type === 'metamemory_event' || event.type === 'metacognition_event') {
                    asyncEventsSeen = true;
                }
            }

            expect(asyncEventsSeen).toBe(true);
        });
    });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '@just-every/ensemble';
import { runTask } from '../index';

// Mock timers
vi.useFakeTimers();

describe('Timer-based Meta Processing Edge Cases', () => {
    let agent: Agent;
    
    beforeEach(() => {
        agent = new Agent({
            name: 'TestAgent',
            modelClass: 'testing',
            instructions: 'You are testing edge cases.'
        });
        vi.clearAllTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('Rapid Message Bursts', () => {
        it('should handle 50 messages in rapid succession', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Generate rapid responses', {
                memory: { enabled: true },
                runIndefinitely: true
            });

            const collector = async () => {
                let messageCount = 0;
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (event.type === 'response_output') {
                        messageCount++;
                        // Simulate rapid messages
                        vi.advanceTimersByTime(10); // 10ms between messages
                        
                        if (messageCount >= 50) {
                            // After burst, wait for processing
                            vi.advanceTimersByTime(2000);
                            break;
                        }
                    }
                }
            };

            await collector();

            // Should batch process efficiently
            const memoryStartEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.operation === 'tagging_start'
            );
            
            // Should trigger based on batch size (10 messages)
            expect(memoryStartEvents.length).toBeGreaterThanOrEqual(5);
        });

        it('should handle alternating bursts and pauses', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Burst pattern test', {
                memory: { enabled: true },
                cognition: { frequency: 10 },
                runIndefinitely: true
            });

            const collector = async () => {
                let phase = 0;
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (event.type === 'response_output') {
                        if (phase < 3) {
                            // Burst phase: 5 quick messages
                            for (let i = 0; i < 4; i++) {
                                vi.advanceTimersByTime(50);
                            }
                            phase++;
                            
                            // Pause phase: wait 5 seconds
                            vi.advanceTimersByTime(5000);
                        } else {
                            break;
                        }
                    }
                }
            };

            await collector();

            // Should handle burst/pause pattern gracefully
            const metaEvents = events.filter(e => 
                e.type === 'metamemory_event' || e.type === 'metacognition_event'
            );
            expect(metaEvents.length).toBeGreaterThan(0);
        });
    });

    describe('Timer Interference', () => {
        it('should handle overlapping timer triggers', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Test overlapping timers', {
                memory: { enabled: true },
                cognition: { frequency: 5 }
            });

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (event.type === 'response_output') {
                        // Advance to just before multiple timers would fire
                        vi.advanceTimersByTime(29999); // Just before 30s memory timer
                        vi.advanceTimersByTime(1); // Trigger 30s timer
                        vi.advanceTimersByTime(1000); // Also trigger 1s debounce
                    }
                    
                    if (events.length > 50) break;
                }
            };

            await collector();

            // Should handle both timers without conflicts
            const uniqueEventIds = new Set(
                events
                    .filter(e => e.type === 'metamemory_event' || e.type === 'metacognition_event')
                    .map(e => e.eventId)
            );
            
            // Each event should have unique ID
            const metaEvents = events.filter(e => 
                e.type === 'metamemory_event' || e.type === 'metacognition_event'
            );
            expect(uniqueEventIds.size).toBe(metaEvents.length);
        });

        it('should clear debounce timers correctly', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Test debounce clearing', {
                memory: { enabled: true },
                runIndefinitely: true
            });

            const collector = async () => {
                let messagesSent = 0;
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (event.type === 'response_output') {
                        messagesSent++;
                        
                        if (messagesSent < 5) {
                            // Rapid messages that reset debounce
                            vi.advanceTimersByTime(500); // Half the debounce time
                        } else if (messagesSent === 5) {
                            // Final message, let debounce complete
                            vi.advanceTimersByTime(1100);
                            break;
                        }
                    }
                }
            };

            await collector();

            // Should only trigger once after debounce settles
            const memoryStartEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.operation === 'tagging_start'
            );
            expect(memoryStartEvents.length).toBe(1);
        });
    });

    describe('Memory Pressure Scenarios', () => {
        it('should handle very large message arrays', async () => {
            const events: any[] = [];
            
            // Pre-populate with many messages
            const initialMessages = Array.from({ length: 1000 }, (_, i) => ({
                type: 'message' as const,
                role: 'assistant' as const,
                content: `Historical message ${i}`,
                id: `msg-${i}`
            }));

            const taskGen = runTask(agent, 'Continue with large history', {
                memory: { enabled: true },
                messages: initialMessages
            });

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (event.type === 'response_output') {
                        vi.advanceTimersByTime(1100);
                    }
                    
                    if (event.type === 'task_complete') break;
                }
            };

            await collector();

            // Should handle large message arrays
            const memoryEvents = events.filter(e => e.type === 'metamemory_event');
            expect(memoryEvents.length).toBeGreaterThan(0);
            
            // Check that processing completes
            const completeEvents = memoryEvents.filter(e => e.operation === 'tagging_complete');
            expect(completeEvents.length).toBeGreaterThan(0);
        });
    });

    describe('Error Recovery', () => {
        it('should continue after meta memory processing error', async () => {
            // Mock a processing error
            const originalConsoleError = console.error;
            const consoleErrors: string[] = [];
            console.error = (...args) => {
                consoleErrors.push(args.join(' '));
                originalConsoleError(...args);
            };

            const events: any[] = [];
            const taskGen = runTask(agent, 'Test error recovery', {
                memory: { enabled: true }
            });

            try {
                const collector = async () => {
                    for await (const event of taskGen) {
                        events.push(event);
                        
                        if (event.type === 'metamemory_event' && event.operation === 'tagging_start') {
                            // Simulate timeout by advancing past timeout period
                            vi.advanceTimersByTime(3 * 60 * 1000 + 1000); // 3 min + 1s
                        }
                        
                        if (event.type === 'task_complete') break;
                    }
                };

                await collector();

                // Should have logged timeout error
                const timeoutErrors = consoleErrors.filter(err => 
                    err.includes('Timeout') && err.includes('metamemory')
                );
                expect(timeoutErrors.length).toBeGreaterThan(0);

                // Task should complete despite error
                const completeEvent = events.find(e => e.type === 'task_complete');
                expect(completeEvent).toBeDefined();
            } finally {
                console.error = originalConsoleError;
            }
        });

        it('should handle processing flag stuck scenarios', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Test stuck processing flag', {
                memory: { enabled: true },
                cognition: { frequency: 5 }
            });

            const collector = async () => {
                let stuckSimulated = false;
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (!stuckSimulated && event.type === 'metamemory_event' && event.operation === 'tagging_start') {
                        // Simulate stuck processing by not getting complete event
                        stuckSimulated = true;
                        // Wait past normal processing time
                        vi.advanceTimersByTime(60000); // 1 minute
                    }
                    
                    if (event.type === 'response_output' && stuckSimulated) {
                        // Try to trigger again
                        vi.advanceTimersByTime(31000); // Past periodic timer
                    }
                    
                    if (events.length > 30) break;
                }
            };

            await collector();

            // Should not have duplicate processing while stuck
            const concurrentStarts = [];
            let processingActive = false;
            
            for (const event of events) {
                if (event.type === 'metamemory_event') {
                    if (event.operation === 'tagging_start') {
                        if (processingActive) {
                            concurrentStarts.push(event);
                        }
                        processingActive = true;
                    } else if (event.operation === 'tagging_complete') {
                        processingActive = false;
                    }
                }
            }
            
            // Should not start new processing while one is active
            expect(concurrentStarts.length).toBe(0);
        });
    });

    describe('Disabled Meta Processing', () => {
        it('should not trigger timers when memory is disabled', async () => {
            const events: any[] = [];
            const taskGen = runTask(agent, 'Test with disabled memory', {
                memory: { enabled: false }
            });

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (event.type === 'response_output') {
                        // Advance time significantly
                        vi.advanceTimersByTime(60000); // 1 minute
                    }
                    
                    if (event.type === 'task_complete') break;
                }
            };

            await collector();

            // Should have no memory events
            const memoryEvents = events.filter(e => e.type === 'metamemory_event');
            expect(memoryEvents.length).toBe(0);
        });

        it('should handle enabling/disabling during task', async () => {
            const events: any[] = [];
            const state = {
                memory: { enabled: true },
                cognition: { frequency: 10 }
            };
            
            const taskGen = runTask(agent, 'Test dynamic enable/disable', state);

            const collector = async () => {
                let messagesProcessed = 0;
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (event.type === 'response_output') {
                        messagesProcessed++;
                        
                        if (messagesProcessed === 3) {
                            // Disable memory mid-task
                            state.memory.enabled = false;
                        } else if (messagesProcessed === 6) {
                            // Re-enable memory
                            state.memory.enabled = true;
                        }
                        
                        vi.advanceTimersByTime(1100);
                    }
                    
                    if (messagesProcessed >= 10) break;
                }
            };

            await collector();

            // Should respect enable/disable state changes
            const memoryEvents = events.filter(e => e.type === 'metamemory_event');
            expect(memoryEvents.length).toBeGreaterThan(0);
            expect(memoryEvents.length).toBeLessThan(10); // Not every message
        });
    });
});
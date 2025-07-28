import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent, createToolFunction } from '@just-every/ensemble';
import { runTask, resumeTask } from '../index';
import type { TaskEvent } from '../src/types/events';

// Mock timers
vi.useFakeTimers();

describe('Timer-based Meta Processing Real-World Scenarios', () => {
    let agent: Agent;
    
    beforeEach(() => {
        // Create realistic tools
        const searchTool = createToolFunction(
            async (query: string) => {
                // Simulate search delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                return `Found 10 results for "${query}"`;
            },
            'Search for information',
            { query: { type: 'string', description: 'Search query' } },
            undefined,
            'search'
        );

        const analyzeTool = createToolFunction(
            async (data: string) => {
                // Simulate analysis delay
                await new Promise(resolve => setTimeout(resolve, 5000));
                return `Analysis complete: ${data.substring(0, 50)}...`;
            },
            'Analyze data',
            { data: { type: 'string', description: 'Data to analyze' } },
            undefined,
            'analyze'
        );

        const generateReportTool = createToolFunction(
            async (sections: string[]) => {
                // Simulate report generation
                await new Promise(resolve => setTimeout(resolve, 10000));
                return `Report generated with ${sections.length} sections`;
            },
            'Generate a report',
            { sections: { type: 'array', description: 'Report sections' } },
            undefined,
            'generate_report'
        );

        agent = new Agent({
            name: 'ResearchAgent',
            modelClass: 'testing',
            instructions: 'You are a research assistant. Use the available tools to search, analyze, and generate reports.',
            tools: [searchTool, analyzeTool, generateReportTool]
        });
        
        vi.clearAllTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('Research Task Workflow', () => {
        it('should maintain summaries during multi-step research', async () => {
            const events: any[] = [];
            const metaUpdates: any[] = [];
            
            const taskGen = runTask(agent, 
                'Research climate change impacts. First search for recent data, then analyze the findings, and finally generate a comprehensive report.',
                {
                    memory: { enabled: true },
                    cognition: { frequency: 5 }
                }
            );

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    
                    // Track meta updates for client
                    if (event.type === 'metamemory_event' || event.type === 'metacognition_event') {
                        metaUpdates.push({
                            type: event.type,
                            operation: event.operation,
                            timestamp: Date.now()
                        });
                    }
                    
                    // Simulate tool execution times
                    if (event.type === 'tool_start') {
                        const toolName = event.tool_call?.function?.name;
                        if (toolName === 'search') {
                            vi.advanceTimersByTime(2000);
                        } else if (toolName === 'analyze') {
                            vi.advanceTimersByTime(5000);
                        } else if (toolName === 'generate_report') {
                            // Long report generation
                            for (let i = 0; i < 10; i++) {
                                vi.advanceTimersByTime(1000);
                            }
                        }
                    }
                    
                    // Add thinking time between steps
                    if (event.type === 'response_output') {
                        vi.advanceTimersByTime(1500);
                    }
                    
                    if (event.type === 'task_complete') break;
                }
            };

            await collector();

            // Should have regular meta updates throughout
            expect(metaUpdates.length).toBeGreaterThan(3);
            
            // Check update distribution
            const updateTypes = metaUpdates.reduce((acc, update) => {
                acc[update.type] = (acc[update.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            
            expect(updateTypes['metamemory_event']).toBeGreaterThan(0);
            expect(updateTypes['metacognition_event']).toBeGreaterThan(0);
        });

        it('should handle interrupted and resumed research', async () => {
            let finalState: TaskEvent['finalState'];
            const events1: any[] = [];
            
            // Start research task
            const task1 = runTask(agent, 
                'Research quantum computing applications. Start by searching for recent breakthroughs.',
                {
                    memory: { enabled: true },
                    cognition: { frequency: 5 }
                }
            );

            // Simulate interruption after initial search
            for await (const event of task1) {
                events1.push(event);
                
                if (event.type === 'tool_start') {
                    vi.advanceTimersByTime(2000);
                }
                
                if (event.type === 'tool_done' && event.tool_call?.function?.name === 'search') {
                    // Interrupt after search completes
                    finalState = {
                        ...event.finalState,
                        messages: events1
                            .filter(e => e.type === 'response_output')
                            .map(e => e.message)
                            .filter(Boolean)
                    };
                    break;
                }
            }

            // Resume after interruption
            const events2: any[] = [];
            const task2 = resumeTask(agent, finalState!, 
                'Continue the research. Analyze the search results and prepare a report.'
            );

            for await (const event of task2) {
                events2.push(event);
                
                if (event.type === 'tool_start') {
                    const toolName = event.tool_call?.function?.name;
                    if (toolName === 'analyze') {
                        vi.advanceTimersByTime(5000);
                    } else if (toolName === 'generate_report') {
                        vi.advanceTimersByTime(10000);
                    }
                }
                
                if (event.type === 'response_output') {
                    vi.advanceTimersByTime(1100);
                }
                
                if (event.type === 'task_complete') break;
            }

            // Should have meta processing in both parts
            const meta1 = events1.filter(e => 
                e.type === 'metamemory_event' || e.type === 'metacognition_event'
            );
            const meta2 = events2.filter(e => 
                e.type === 'metamemory_event' || e.type === 'metacognition_event'
            );
            
            expect(meta1.length).toBeGreaterThan(0);
            expect(meta2.length).toBeGreaterThan(0);
            
            // Resumed task should continue with context
            const memory2Events = meta2.filter(e => e.type === 'metamemory_event');
            expect(memory2Events.some(e => e.data?.state?.topicTags)).toBe(true);
        });
    });

    describe('Interactive Chat Scenario', () => {
        it('should provide timely updates during conversational flow', async () => {
            const { addMessageToTask } = await import('../index');
            const events: any[] = [];
            const clientUpdates: any[] = [];
            
            const taskGen = runTask(agent, 'Hello! I need help with my research project.', {
                memory: { enabled: true },
                cognition: { frequency: 5 },
                runIndefinitely: true
            });

            const conversation = [
                { delay: 3000, message: "Can you search for information about renewable energy?" },
                { delay: 15000, message: "That's interesting. Can you analyze the solar energy data?" },
                { delay: 8000, message: "What about wind energy trends?" },
                { delay: 45000, message: "Please generate a comparison report of solar vs wind." }
            ];

            let conversationIndex = 0;
            let lastActivityTime = 0;

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    const currentTime = Date.now();
                    
                    // Track client-visible updates
                    if (event.type === 'metamemory_event' && event.operation === 'tagging_complete') {
                        clientUpdates.push({
                            time: currentTime - lastActivityTime,
                            topics: event.data?.state?.topicTags ? 
                                Object.keys(event.data.state.topicTags).length : 0
                        });
                    }
                    
                    // Simulate user typing and sending messages
                    if (event.type === 'response_output' && conversationIndex < conversation.length) {
                        lastActivityTime = currentTime;
                        const { delay, message } = conversation[conversationIndex];
                        
                        // User thinking/typing time
                        vi.advanceTimersByTime(delay);
                        
                        // Send user message
                        addMessageToTask(taskGen, {
                            type: 'message',
                            role: 'user',
                            content: message
                        });
                        
                        conversationIndex++;
                    }
                    
                    // Execute tools
                    if (event.type === 'tool_start') {
                        const toolName = event.tool_call?.function?.name;
                        if (toolName === 'search') {
                            vi.advanceTimersByTime(2000);
                        } else if (toolName === 'analyze') {
                            vi.advanceTimersByTime(5000);
                        } else if (toolName === 'generate_report') {
                            // Simulate long report generation
                            for (let i = 0; i < 30; i++) {
                                vi.advanceTimersByTime(1000);
                                
                                // Check if we're getting updates during long operation
                                const recentUpdates = clientUpdates.filter(u => 
                                    u.time < 30000 // Within last 30 seconds
                                );
                                if (recentUpdates.length > 0 && i === 15) {
                                    console.log('Client received update during long operation');
                                }
                            }
                        }
                    }
                    
                    // Stop after all conversations
                    if (conversationIndex >= conversation.length && 
                        event.type === 'task_complete') {
                        break;
                    }
                    
                    // Safety limit
                    if (events.length > 200) break;
                }
            };

            await collector();

            // Should have regular updates for the client
            expect(clientUpdates.length).toBeGreaterThan(3);
            
            // Updates should include topic evolution
            const topicCounts = clientUpdates.map(u => u.topics);
            const maxTopics = Math.max(...topicCounts);
            expect(maxTopics).toBeGreaterThan(1); // Multiple topics discussed
        });
    });

    describe('Error Handling in Production', () => {
        it('should gracefully handle tool failures with continued meta processing', async () => {
            const unreliableTool = createToolFunction(
                async (shouldFail: boolean) => {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    if (shouldFail) {
                        throw new Error('Tool operation failed');
                    }
                    return 'Success';
                },
                'Unreliable tool that might fail',
                { shouldFail: { type: 'boolean', description: 'Whether to fail' } },
                undefined,
                'unreliable_tool'
            );

            agent.tools = [...(agent.tools || []), unreliableTool];

            const events: any[] = [];
            const errors: any[] = [];
            
            const taskGen = runTask(agent, 
                'Test the unreliable_tool with shouldFail=true, then retry with shouldFail=false',
                {
                    memory: { enabled: true },
                    cognition: { frequency: 5 }
                }
            );

            const collector = async () => {
                for await (const event of taskGen) {
                    events.push(event);
                    
                    if (event.type === 'error') {
                        errors.push(event);
                    }
                    
                    if (event.type === 'tool_start') {
                        vi.advanceTimersByTime(1000);
                    }
                    
                    if (event.type === 'response_output') {
                        vi.advanceTimersByTime(1100);
                    }
                    
                    if (event.type === 'task_complete') break;
                }
            };

            await collector();

            // Should handle tool errors gracefully
            expect(errors.length).toBeGreaterThan(0);
            
            // Meta processing should continue despite errors
            const metaEventsAfterError = events
                .slice(events.findIndex(e => e.type === 'error'))
                .filter(e => e.type === 'metamemory_event' || e.type === 'metacognition_event');
            
            expect(metaEventsAfterError.length).toBeGreaterThan(0);
        });

        it('should handle system resource pressure gracefully', async () => {
            const events: any[] = [];
            const processingTimes: number[] = [];
            
            // Simulate high message volume
            const taskGen = runTask(agent, 'Process this high-volume task', {
                memory: { enabled: true },
                cognition: { frequency: 5 },
                runIndefinitely: true
            });

            const collector = async () => {
                let burstCount = 0;
                
                for await (const event of taskGen) {
                    events.push(event);
                    
                    // Track processing times
                    if (event.type === 'metamemory_event' && event.data?.processingTime) {
                        processingTimes.push(event.data.processingTime);
                    }
                    
                    if (event.type === 'response_output') {
                        burstCount++;
                        
                        if (burstCount <= 100) {
                            // Simulate message burst
                            vi.advanceTimersByTime(50);
                        } else if (burstCount <= 110) {
                            // Normal pace
                            vi.advanceTimersByTime(1100);
                        } else {
                            break;
                        }
                    }
                }
            };

            await collector();

            // System should handle load without degradation
            const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
            expect(avgProcessingTime).toBeLessThan(10000); // Under 10 seconds average
            
            // Should batch efficiently during high load
            const memoryEvents = events.filter(e => 
                e.type === 'metamemory_event' && e.operation === 'tagging_start'
            );
            expect(memoryEvents.length).toBeGreaterThan(5); // Multiple batches
            expect(memoryEvents.length).toBeLessThan(20); // But not every message
        });
    });
});
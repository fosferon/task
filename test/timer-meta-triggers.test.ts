import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '@just-every/ensemble';
import { runTask } from '../index';

// Use fake timers for controlled testing
vi.useFakeTimers();

describe('Timer-based Meta Processing Triggers', () => {
    let agent: Agent;
    
    beforeEach(() => {
        agent = new Agent({
            name: 'TestAgent', 
            modelClass: 'testing',
            instructions: 'Test timer triggers',
        });
        vi.clearAllTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    it('should trigger meta memory after 1-second debounce', async () => {
        const events: any[] = [];
        const taskGen = runTask(agent, 'Test memory timer', {
            memory: { enabled: true }
        });

        // Start collecting events
        const collector = (async () => {
            for await (const event of taskGen) {
                events.push(event);
                console.log(`[${Date.now()}] Event: ${event.type}`, 
                    event.type === 'metamemory_event' ? event.operation : '');
                
                // When we get the first response, advance time
                if (event.type === 'response_output' && !events.find(e => e.type === 'metamemory_event')) {
                    console.log('Got response_output, advancing time by 1100ms');
                    // Wait for debounce timer
                    await vi.advanceTimersByTimeAsync(1100);
                    
                    // Process any pending timers
                    await vi.runOnlyPendingTimersAsync();
                }
                
                // Stop after we see meta memory complete
                if (event.type === 'metamemory_event' && event.operation === 'tagging_complete') {
                    break;
                }
                
                // Safety limit
                if (events.length > 50) break;
            }
        })();

        await collector;

        // Check that we got meta memory events
        const memoryStartEvents = events.filter(e => 
            e.type === 'metamemory_event' && e.operation === 'tagging_start'
        );
        const memoryCompleteEvents = events.filter(e => 
            e.type === 'metamemory_event' && e.operation === 'tagging_complete'  
        );

        console.log('Total events:', events.length);
        console.log('Memory start events:', memoryStartEvents.length);
        console.log('Memory complete events:', memoryCompleteEvents.length);

        expect(memoryStartEvents.length).toBeGreaterThan(0);
        expect(memoryCompleteEvents.length).toBeGreaterThan(0);
    });


    it('should trigger meta cognition after 10 messages', async () => {
        const events: any[] = [];
        const taskGen = runTask(agent, 'Generate multiple responses quickly', {
            cognition: { frequency: 100 }, // High frequency so timer doesn't interfere
            runIndefinitely: true
        });

        const collector = (async () => {
            let messageCount = 0;
            
            for await (const event of taskGen) {
                events.push(event);
                
                if (event.type === 'response_output') {
                    messageCount++;
                    console.log(`Message ${messageCount} received`);
                    
                    // Quick succession of messages
                    if (messageCount < 11) {
                        await vi.advanceTimersByTimeAsync(100); // Short delay
                    }
                }
                
                if (event.type === 'metacognition_event') {
                    console.log('Meta cognition event:', event.operation);
                    if (event.operation === 'analysis_complete') {
                        break;
                    }
                }
                
                if (messageCount >= 15) break;
            }
        })();

        await collector;

        const cognitionStartEvents = events.filter(e => 
            e.type === 'metacognition_event' && e.operation === 'analysis_start'
        );
        
        console.log('Total messages:', events.filter(e => e.type === 'response_output').length);
        console.log('Cognition triggers:', cognitionStartEvents.length);
        
        expect(cognitionStartEvents.length).toBeGreaterThan(0);
    });

    it('should trigger meta cognition on 3-minute periodic timer', async () => {
        const events: any[] = [];
        const taskGen = runTask(agent, 'Test long-running task', {
            cognition: { frequency: 1000 }, // Very high to ensure timer is the trigger
            runIndefinitely: true
        });

        const collector = (async () => {
            let gotFirstMessage = false;
            
            for await (const event of taskGen) {
                events.push(event);
                
                if (event.type === 'response_output' && !gotFirstMessage) {
                    gotFirstMessage = true;
                    console.log('First message, advancing 3.5 minutes...');
                    // Advance past 3-minute timer
                    await vi.advanceTimersByTimeAsync(210000); // 3.5 minutes
                    await vi.runOnlyPendingTimersAsync();
                }
                
                if (event.type === 'metacognition_event') {
                    console.log('Meta cognition event:', event.operation);
                    if (event.operation === 'analysis_complete') {
                        break;
                    }
                }
                
                if (events.length > 50) break;
            }
        })();

        await collector;

        const cognitionEvents = events.filter(e => e.type === 'metacognition_event');
        console.log('Cognition events:', cognitionEvents.map(e => e.operation));
        
        expect(cognitionEvents.length).toBeGreaterThan(0);
    });
});
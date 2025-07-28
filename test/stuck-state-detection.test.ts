import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '@just-every/ensemble';
import { runTask, resumeTask } from '../index';

describe('Stuck state detection (2-minute threshold)', () => {
    let consoleWarnSpy: any;
    let originalDateNow: () => number;
    let currentTime: number;
    
    beforeEach(() => {
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        // Mock Date.now() to control time
        originalDateNow = Date.now;
        currentTime = originalDateNow();
        Date.now = vi.fn(() => currentTime);
    });
    
    afterEach(() => {
        consoleWarnSpy.mockRestore();
        Date.now = originalDateNow;
    });

    it('should detect and reset stuck memory processing after 2 minutes', async () => {
        const agent = new Agent({
            name: 'StuckTestAgent',
            modelClass: 'testing',
            instructions: 'Test agent',
        });

        // Create initial state with stuck memory processing
        const stuckState = {
            messages: [],
            memory: {
                enabled: true,
                processing: true,
                lastProcessingStartTime: currentTime - (2.5 * 60 * 1000) // 2.5 minutes ago
            }
        };
        
        // Start a task with the stuck state
        const task = runTask(agent, 'Test task', stuckState);
        
        let taskStarted = false;
        let memoryEventReceived = false;
        
        for await (const event of task) {
            if (event.type === 'task_start') {
                taskStarted = true;
            }
            
            if (event.type === 'metamemory_event') {
                memoryEventReceived = true;
            }
            
            if (event.type === 'task_complete') {
                break;
            }
        }
        
        expect(taskStarted).toBe(true);
        
        // Check that stuck warning was logged
        const warnings = consoleWarnSpy.mock.calls.map((call: any[]) => call[0]);
        const stuckWarning = warnings.find((msg: string) => 
            msg.includes('[Task] Meta memory processing appears stuck') &&
            msg.includes('150s') && // 2.5 minutes = 150 seconds
            msg.includes('forcibly resetting')
        );
        
        expect(stuckWarning).toBeDefined();
    });

    it('should detect and reset stuck cognition processing after 2 minutes', async () => {
        const agent = new Agent({
            name: 'StuckCognitionAgent',
            modelClass: 'testing',
            instructions: 'Test agent',
        });

        // Create initial state with stuck cognition processing
        const stuckState = {
            messages: [],
            cognition: {
                frequency: 5,
                processing: true,
                lastProcessingStartTime: currentTime - (2.5 * 60 * 1000) // 2.5 minutes ago
            }
        };
        
        // Start a task with the stuck state
        const task = runTask(agent, 'Test task', stuckState);
        
        let taskStarted = false;
        
        for await (const event of task) {
            if (event.type === 'task_start') {
                taskStarted = true;
            }
            
            if (event.type === 'task_complete') {
                break;
            }
        }
        
        expect(taskStarted).toBe(true);
        
        // Check that stuck warning was logged
        const warnings = consoleWarnSpy.mock.calls.map((call: any[]) => call[0]);
        const stuckWarning = warnings.find((msg: string) => 
            msg.includes('[Task] Meta cognition processing appears stuck') &&
            msg.includes('150s') && // 2.5 minutes = 150 seconds
            msg.includes('forcibly resetting')
        );
        
        expect(stuckWarning).toBeDefined();
    });

    it('should NOT reset processing that is under 2 minutes', async () => {
        const agent = new Agent({
            name: 'NotStuckAgent',
            modelClass: 'testing',
            instructions: 'Test agent',
        });

        // Create state with processing that started 1 minute ago (not stuck)
        const notStuckState = {
            messages: [],
            memory: {
                enabled: true,
                processing: true,
                lastProcessingStartTime: currentTime - (1 * 60 * 1000) // 1 minute ago
            },
            cognition: {
                frequency: 5,
                processing: true,
                lastProcessingStartTime: currentTime - (1 * 60 * 1000) // 1 minute ago
            }
        };
        
        // Start a task
        const task = runTask(agent, 'Test task', notStuckState);
        
        let taskStarted = false;
        
        for await (const event of task) {
            if (event.type === 'task_start') {
                taskStarted = true;
            }
            
            if (event.type === 'task_complete') {
                break;
            }
        }
        
        expect(taskStarted).toBe(true);
        
        // Check that NO stuck warnings were logged
        const warnings = consoleWarnSpy.mock.calls.map((call: any[]) => call[0]);
        const stuckWarnings = warnings.filter((msg: string) => 
            msg.includes('processing appears stuck')
        );
        
        expect(stuckWarnings.length).toBe(0);
    });

    it('should handle resume with stuck state and process new messages', async () => {
        const agent = new Agent({
            name: 'ResumeStuckAgent',
            modelClass: 'testing', 
            instructions: 'Count numbers when asked',
        });

        // First, get a valid final state
        let finalState: any;
        const task1 = runTask(agent, 'Count to 3');
        
        for await (const event of task1) {
            if (event.type === 'task_complete') {
                finalState = event.finalState;
                break;
            }
        }
        
        expect(finalState).toBeDefined();
        
        // Simulate stuck processing
        if (finalState.cognition) {
            finalState.cognition.processing = true;
            finalState.cognition.lastProcessingStartTime = currentTime - (3 * 60 * 1000); // 3 minutes ago
        }
        if (finalState.memory) {
            finalState.memory.processing = true;
            finalState.memory.lastProcessingStartTime = currentTime - (3 * 60 * 1000); // 3 minutes ago
        }
        
        // Clear previous warnings
        consoleWarnSpy.mockClear();
        
        // Resume with stuck state
        const task2 = resumeTask(agent, finalState, 'Continue counting to 5');
        
        let messageCount = 0;
        let metaEventsAfterReset = 0;
        
        for await (const event of task2) {
            if (event.type === 'response_output') {
                messageCount++;
            }
            
            if (event.type === 'metacognition_event' || event.type === 'metamemory_event') {
                metaEventsAfterReset++;
            }
            
            if (event.type === 'task_complete') {
                break;
            }
        }
        
        // Should have processed new messages
        expect(messageCount).toBeGreaterThan(0);
        
        // Check that stuck warnings were logged
        const warnings = consoleWarnSpy.mock.calls.map((call: any[]) => call[0]);
        const stuckWarnings = warnings.filter((msg: string) => 
            msg.includes('processing appears stuck') &&
            msg.includes('180s') && // 3 minutes = 180 seconds
            msg.includes('forcibly resetting')
        );
        
        // Should have warnings for both memory and cognition
        expect(stuckWarnings.length).toBeGreaterThan(0);
    });
});
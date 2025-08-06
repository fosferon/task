import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runTask, taskStatus, addMessageToTask } from '../index.js';
import type { Agent } from '@just-every/ensemble';
import type { TaskStatusEvent } from '../src/types/events.js';

// Track call counts per agent for testing
const callCounts = new Map<string, number>();

// Mock the ensemble module before anything else
vi.mock('@just-every/ensemble', async () => {
  const actual = await vi.importActual('@just-every/ensemble') as any;
  return {
    ...actual,
    ensembleRequest: vi.fn((messages, agent) => {
      // Return an async generator
      return (async function* () {
        // Check if this is a summary request
        const isSummaryRequest = agent?.modelClass === 'summary';
        
        // Default response for summary requests
        if (isSummaryRequest) {
          // Check for special test cases based on agent name
          let text = 'Task is analyzing code structure and identifying performance bottlenecks. Currently processing file analysis results.';
          
          if (agent?.name === 'error-test-agent') {
            text = 'Task encountered an error while processing the request.';
          } else if (agent?.name === 'waiting-test-agent') {
            text = 'Task is waiting for external resources to become available.';
          } else if (agent?.name === 'completion-test-agent') {
            text = 'Task has completed all major operations and is finalizing results.';
          } else if (agent?.name === 'no-response-agent') {
            // Don't yield anything for this case
            return;
          }
          
          yield {
            type: 'response_output',
            message: {
              content: [
                {
                  type: 'text',
                  text: text
                }
              ]
            }
          };
          return;
        }
        
        // Track call count for this agent
        const agentKey = agent?.name || 'default';
        const callCount = (callCounts.get(agentKey) || 0) + 1;
        callCounts.set(agentKey, callCount);
        
        // Only return task_complete on the first call to avoid infinite loops
        if (callCount === 1) {
          yield {
            type: 'task_start',
            task_id: 'test-task-id'
          };
          yield {
            type: 'tool_done',
            tool_call: {
              function: {
                name: 'task_complete'
              }
            },
            result: {
              output: 'Task completed'
            }
          };
        } else {
          // Subsequent calls just yield a response without task_complete
          yield {
            type: 'response_output',
            message: {
              content: [
                {
                  type: 'text',
                  text: 'Continuing task...'
                }
              ]
            }
          };
        }
      })();
    }),
    cloneAgent: actual.cloneAgent || ((agent: Agent) => ({ ...agent }))
  };
});

describe('taskStatus function', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = {
      name: 'test-agent',
      model: 'mock-model',
      apiKey: 'test-key',
      instructions: 'Test instructions',
      tools: [],
    };
    vi.clearAllMocks();
    callCounts.clear(); // Clear call counts between tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should retrieve status for an active task', async () => {
    // Start a task
    const task = runTask(agent, 'Test task content');
    
    // Let the task initialize
    const iterator = task[Symbol.asyncIterator]();
    await iterator.next(); // Get first event

    // Get task status
    const status = await taskStatus(task, agent);

    expect(status).toBeDefined();
    expect(status.type).toBe('task_status');
    expect(status.messageCount).toBeGreaterThan(0);
    expect(status.summary).toBeDefined();
    expect(status.currentTimestamp).toBeGreaterThan(0);
    expect(status.lastMessageTimestamp).toBeGreaterThan(0);
  });

  it('should throw error for invalid task generator', async () => {
    await expect(taskStatus(null as any, agent)).rejects.toThrow('Task generator is required');
  });

  it('should throw error for completed task', async () => {
    // Start and complete a task
    const task = runTask(agent, 'Test task');
    
    // Fully consume the generator to trigger cleanup
    const events = [];
    for await (const event of task) {
      events.push(event);
      // Don't break - consume everything to trigger cleanup
    }
    
    // Verify we got completion event
    const hasComplete = events.some(e => e.type === 'task_complete');
    expect(hasComplete).toBe(true);

    // Now try to get status after completion - should throw
    await expect(taskStatus(task, agent)).rejects.toThrow('Task not found or already completed');
  });

  it('should handle task with multiple messages', async () => {
    // Start a task
    const task = runTask(agent, 'Initial content');
    
    // Let it initialize
    const iterator = task[Symbol.asyncIterator]();
    await iterator.next();

    // Add multiple messages
    addMessageToTask(task, {
      type: 'message',
      role: 'user',
      content: 'Additional instruction 1'
    });
    
    addMessageToTask(task, {
      type: 'message',
      role: 'assistant',
      content: 'Processing instruction 1'
    });

    addMessageToTask(task, {
      type: 'message',
      role: 'user',
      content: 'Additional instruction 2'
    });

    // Get status
    const status = await taskStatus(task, agent);

    expect(status.messageCount).toBeGreaterThanOrEqual(4);
    expect(status.lastMessageTimestamp).toBeGreaterThan(0);
  });

  it('should include recent messages in truncated form', async () => {
    const task = runTask(agent, 'Start analyzing the codebase');
    
    const iterator = task[Symbol.asyncIterator]();
    await iterator.next();

    // Add a long message
    const longContent = 'A'.repeat(300);
    addMessageToTask(task, {
      type: 'message',
      role: 'user',
      content: longContent
    });

    const status = await taskStatus(task, agent);
    
    expect(status.lastMessageTimestamp).toBeGreaterThan(0);
    // The function truncates content to 200 chars + '...'
    expect(status.summary).toBeDefined();
  });


  it('should handle tasks with more than 20 messages', async () => {
    const task = runTask(agent, 'Start task');
    
    const iterator = task[Symbol.asyncIterator]();
    await iterator.next();

    // Add 25 messages
    for (let i = 0; i < 25; i++) {
      addMessageToTask(task, {
        type: 'message',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      });
    }

    const status = await taskStatus(task, agent);

    expect(status.messageCount).toBeGreaterThanOrEqual(26); // initial + 25
    expect(status.lastMessageTimestamp).toBeGreaterThan(0);
  });

  it('should handle missing summary response gracefully', async () => {
    const noResponseAgent: Agent = {
      ...agent,
      name: 'no-response-agent'
    };

    const task = runTask(noResponseAgent, 'Test task');
    const iterator = task[Symbol.asyncIterator]();
    await iterator.next();

    const status = await taskStatus(task, noResponseAgent);
    
    expect(status.summary).toBe('Unable to generate summary');
    // Summary should be the default when no response
  });

  it('should work with tasks that have metamemory enabled', async () => {
    // Create an agent with metamemory configuration
    const memoryAgent: Agent = {
      ...agent,
      memory: {
        enabled: true,
        config: {
          slidingWindowSize: 10,
          processingThreshold: 2
        }
      }
    };

    const task = runTask(memoryAgent, 'Analyze code with memory');
    
    const iterator = task[Symbol.asyncIterator]();
    await iterator.next();

    // Add some messages to trigger memory processing
    for (let i = 0; i < 5; i++) {
      addMessageToTask(task, {
        type: 'message',
        role: 'user',
        content: `Instruction ${i + 1} for analysis`
      });
    }

    const status = await taskStatus(task, memoryAgent);

    expect(status).toBeDefined();
    expect(status.messageCount).toBeGreaterThanOrEqual(6);
  });

  it('should return task_id when available', async () => {
    const task = runTask(agent, 'Test task');
    
    // Get first event which should contain task_id
    const iterator = task[Symbol.asyncIterator]();
    const firstEvent = await iterator.next();

    // Get status
    const status = await taskStatus(task, agent);

    // Check if task_id is set (it might be 'unknown' if not captured yet)
    expect(status.task_id).toBeDefined();
    expect(typeof status.task_id).toBe('string');
  });

  it('should handle parallel status requests', async () => {
    const task = runTask(agent, 'Test parallel status');
    
    const iterator = task[Symbol.asyncIterator]();
    await iterator.next();

    // Make parallel status requests
    const [status1, status2, status3] = await Promise.all([
      taskStatus(task, agent),
      taskStatus(task, agent),
      taskStatus(task, agent)
    ]);

    // All should succeed and return valid status
    expect(status1).toBeDefined();
    expect(status2).toBeDefined();
    expect(status3).toBeDefined();
    expect(status1.type).toBe('task_status');
    expect(status2.type).toBe('task_status');
    expect(status3.type).toBe('task_status');
  });
});
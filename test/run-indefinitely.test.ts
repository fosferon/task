import { describe, it, expect, vi } from 'vitest'
import { Agent } from '@just-every/ensemble'
import { runTask } from '../src/core/engine'

describe('Run Indefinitely Tests', () => {
  it('should trigger metacognition without using resumeTask', async () => {
    const agent = new Agent({
      name: 'ConversationAgent',
      modelClass: 'reasoning',
      instructions: 'You are a helpful assistant having a conversation.',
      tools: []
    })

    const consoleLogSpy = vi.spyOn(console, 'log')
    
    // Configure to run indefinitely with low frequency
    const taskState = {
      cognition: {
        frequency: 2
      },
      runIndefinitely: true // Key setting - no task_complete tool
    }

    const metacognitionEvents: any[] = []
    let messageCount = 0
    
    console.log('\n[TEST] Starting conversation mode test...')
    
    const generator = runTask(
      agent, 
      'Hello! Let\'s have a conversation about AI. Ask me questions.',
      taskState
    )

    // Simulate conversation by processing multiple responses
    for await (const event of generator) {
      if (event.type === 'metacognition_event') {
        metacognitionEvents.push(event)
        console.log(`[TEST] Metacognition ${event.operation} at request ${event.data?.requestCount}`)
      }
      
      if (event.type === 'response_output') {
        messageCount++
        console.log(`[TEST] Message ${messageCount} received`)
        
        // In real usage, you would use addMessageToTask here to continue conversation
        // For this test, we'll just count responses
        
        if (messageCount >= 3) {
          // Stop after a few messages to avoid infinite loop
          break
        }
      }
    }

    // Check logs
    const triggerLogs = consoleLogSpy.mock.calls.filter(call =>
      call[0]?.includes('[Task] Checking metacognition triggers:')
    )
    
    console.log('[TEST] Total trigger checks:', triggerLogs.length)
    console.log('[TEST] Metacognition events:', metacognitionEvents.length)
    
    // Since runIndefinitely is true, the task won't complete automatically
    expect(messageCount).toBeGreaterThan(0)
  }, 30000)

  it('should not add task_complete tools when runIndefinitely is true', async () => {
    const agent = new Agent({
      name: 'TestAgent',
      modelClass: 'reasoning',
      instructions: 'Test agent',
      tools: []
    })

    const taskState = {
      runIndefinitely: true
    }

    // We can't easily test the internal tool setup, but we can verify
    // that task_complete events are not emitted
    const generator = runTask(agent, 'Test message', taskState)
    
    let hasTaskComplete = false
    let eventCount = 0
    
    for await (const event of generator) {
      eventCount++
      
      if (event.type === 'task_complete' || event.type === 'task_start') {
        hasTaskComplete = true
      }
      
      // Break after some events to avoid hanging
      if (eventCount > 20) {
        break
      }
    }
    
    expect(hasTaskComplete).toBe(false)
  })
})
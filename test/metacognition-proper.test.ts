import { describe, it, expect, vi } from 'vitest'
import { Agent } from '@just-every/ensemble'
import { runTask, resumeTask } from '../src/core/engine'

describe('Metacognition Proper Tests', () => {
  it('should trigger metacognition after 5 requests using resumeTask', async () => {
    const agent = new Agent({
      name: 'TestAgent',
      modelClass: 'reasoning',
      instructions: 'You are a helpful assistant. Complete each task thoroughly.',
      tools: []
    })

    // Track all events
    const metacognitionEvents: any[] = []
    const requestCounts: number[] = []
    let finalState: any = null

    // Initial task with metacognition frequency of 5
    console.log('\n[TEST] Starting initial task...')
    const initialState = {
      cognition: {
        frequency: 5
      }
    }

    // Phase 1: First request
    for await (const event of runTask(agent, 'Tell me what 2+2 equals.', initialState)) {
      if (event.type === 'metacognition_event') {
        metacognitionEvents.push(event)
        console.log(`[TEST] Metacognition ${event.operation} at request ${event.data?.requestCount}`)
      }
      if (event.type === 'task_complete' || event.type === 'task_fatal_error') {
        finalState = event.finalState
        requestCounts.push(finalState.requestCount)
        console.log(`[TEST] Phase 1 complete. Request count: ${finalState.requestCount}`)
        break
      }
    }

    // Phase 2-5: Resume with new questions
    const questions = [
      'Now tell me what 3+3 equals.',
      'What is 4+4?',
      'What is 5+5?', 
      'What is 6+6?'
    ]

    for (let i = 0; i < questions.length; i++) {
      console.log(`\n[TEST] Phase ${i + 2}: Resuming with new question...`)
      
      for await (const event of resumeTask(agent, finalState, questions[i])) {
        if (event.type === 'metacognition_event') {
          metacognitionEvents.push(event)
          console.log(`[TEST] Metacognition ${event.operation} at request ${event.data?.requestCount}`)
        }
        if (event.type === 'task_complete' || event.type === 'task_fatal_error') {
          finalState = event.finalState
          requestCounts.push(finalState.requestCount)
          console.log(`[TEST] Phase ${i + 2} complete. Request count: ${finalState.requestCount}`)
          break
        }
      }
    }

    // Summary
    console.log('\n[TEST] Summary:')
    console.log('Request count progression:', requestCounts)
    console.log('Metacognition events:', metacognitionEvents.length)
    metacognitionEvents.forEach(e => {
      console.log(`  - ${e.operation} at request ${e.data?.requestCount}`)
    })

    // Assertions
    expect(requestCounts[requestCounts.length - 1]).toBeGreaterThanOrEqual(5)
    expect(metacognitionEvents.length).toBeGreaterThan(0)
    expect(metacognitionEvents.some(e => e.operation === 'analysis_start')).toBe(true)
  }, 60000)

  it('should show exact trigger conditions at request 5', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log')
    
    const agent = new Agent({
      name: 'DebugAgent',
      modelClass: 'reasoning',
      instructions: 'Answer questions briefly.',
      tools: []
    })

    let finalState: any = null
    const triggerLogs: any[] = []

    // Start with frequency 5
    const initialState = {
      cognition: {
        frequency: 5
      },
      requestCount: 0 // Explicitly start at 0
    }

    // Make exactly 5 requests
    const prompts = [
      'Say "one"',
      'Say "two"', 
      'Say "three"',
      'Say "four"',
      'Say "five"'
    ]

    // First request
    console.log('\n[TEST] Request 1...')
    for await (const event of runTask(agent, prompts[0], initialState)) {
      if (event.type === 'task_complete') {
        finalState = event.finalState
        break
      }
    }

    // Subsequent requests
    for (let i = 1; i < prompts.length; i++) {
      console.log(`\n[TEST] Request ${i + 1}...`)
      
      for await (const event of resumeTask(agent, finalState, prompts[i])) {
        if (event.type === 'task_complete') {
          finalState = event.finalState
          
          // Capture trigger logs around request 5
          if (finalState.requestCount === 5) {
            const logs = consoleLogSpy.mock.calls.filter(call =>
              call[0]?.includes('[Task] Checking metacognition triggers:')
            )
            triggerLogs.push(...logs)
          }
          break
        }
      }
    }

    console.log('\n[TEST] Trigger conditions at request 5:')
    if (triggerLogs.length > 0) {
      console.log(JSON.stringify(triggerLogs[triggerLogs.length - 1][1], null, 2))
    }

    expect(finalState.requestCount).toBe(5)
    expect(triggerLogs.length).toBeGreaterThan(0)
  }, 60000)

  it('should test exact demo scenario with resumeTask', async () => {
    const agent = new Agent({
      name: 'DemoAgent',
      modelClass: 'reasoning',
      instructions: 'You are a helpful AI assistant.',
      tools: []
    })

    const metacognitionEvents: any[] = []
    let finalState: any = null

    // Demo default settings
    const initialState = {
      cognition: {
        frequency: 5
      },
      memory: {
        enabled: true
      }
    }

    console.log('\n[TEST] Simulating demo scenario...')

    // Simulate a multi-turn conversation like in the demo
    const conversation = [
      'Hello! Can you help me understand JavaScript closures?',
      'Can you give me a practical example?',
      'How do closures relate to memory management?',
      'What are some common pitfalls?',
      'Can you summarize the key points?'
    ]

    // First turn
    for await (const event of runTask(agent, conversation[0], initialState)) {
      if (event.type === 'metacognition_event') {
        metacognitionEvents.push(event)
        console.log(`[TEST] Metacognition: ${event.operation}`)
      }
      if (event.type === 'task_complete') {
        finalState = event.finalState
        console.log(`[TEST] Turn 1 complete. Request count: ${finalState.requestCount}`)
        break
      }
    }

    // Subsequent turns
    for (let i = 1; i < conversation.length; i++) {
      for await (const event of resumeTask(agent, finalState, conversation[i])) {
        if (event.type === 'metacognition_event') {
          metacognitionEvents.push(event)
          console.log(`[TEST] Metacognition: ${event.operation} at request ${event.data?.requestCount}`)
        }
        if (event.type === 'task_complete') {
          finalState = event.finalState
          console.log(`[TEST] Turn ${i + 1} complete. Request count: ${finalState.requestCount}`)
          break
        }
      }
    }

    console.log('\n[TEST] Final results:')
    console.log('- Total requests:', finalState?.requestCount)
    console.log('- Metacognition events:', metacognitionEvents.length)
    console.log('- Should have triggered at request 5:', finalState?.requestCount >= 5)

    expect(finalState?.requestCount).toBeGreaterThanOrEqual(5)
    expect(metacognitionEvents.some(e => e.operation === 'analysis_start')).toBe(true)
  }, 60000)
})
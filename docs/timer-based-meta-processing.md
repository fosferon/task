# Timer-based Meta Processing

## Overview

The Task system now uses timer-based triggers for meta memory and meta cognition processing. This decouples these systems from the main message flow, ensuring that clients receive regular updates even during long-running operations.

## Problem Solved

Previously, meta processing only occurred at specific points in the message flow:
- **Meta Memory**: Only after `response_output` events
- **Meta Cognition**: Only at the start of request loops

This caused issues:
- During long tool calls (e.g., 3-5 minute operations), no updates were sent to clients
- Summaries and insights were delayed until after operations completed
- The UI couldn't show progress or current state during long waits

## New Architecture

### Timer System

The system now uses independent timers that observe the message stream:

```typescript
interface MetaProcessingTimers {
    memoryTimer: NodeJS.Timeout | null;      // Not used (kept for compatibility)
    cognitionTimer: NodeJS.Timeout | null;    // 3-minute periodic timer
    memoryDebounceTimer: NodeJS.Timeout | null;    // 1-second debounce
    cognitionDebounceTimer: NodeJS.Timeout | null; // 1-second debounce
}
```

### Trigger Conditions

**Meta Memory Triggers:**
1. **Debounced**: 1 second after any new message (timer resets on each message)
2. **Batch**: Immediately when 10 unprocessed messages accumulate

**Meta Cognition Triggers:**
1. **Message Count**: After 10 messages (with 1-second debounce)
2. **Periodic**: Every 3 minutes (allows checking during long operations)

### Processing Flow

1. Messages are added to unprocessed queues when received
2. Timers are "bumped" (reset) on each new message
3. When a timer fires, it processes all unprocessed messages
4. Processing happens asynchronously in the background
5. Events are queued and yielded to the client

## Benefits

### 1. Updates During Long Operations
```typescript
// Tool running for 5 minutes
🔧 Tool started: analyze_dataset
⏳ Processing...
🧠 [30s] Meta Memory: Updated topics (during tool!)
🧠 [60s] Meta Memory: Updated topics (during tool!)
🤔 [180s] Meta Cognition: System check (during tool!)
✅ [300s] Tool completed
```

### 2. Responsive Conversation Mode
```typescript
// User pauses to think
👤 User: "Tell me about neural networks"
🤖 Assistant: "Neural networks are..."
⏳ User thinking (15 seconds)...
📝 Meta Memory: Topics updated
👤 User: "How do they learn?"
```

### 3. Efficient Batch Processing
```typescript
// Rapid message bursts
📨 10 messages received in 500ms
🧠 Meta Memory: Processing batch immediately
```

## Implementation Details

### Message Queue Management
```typescript
interface MetaProcessingState {
    unprocessedMemoryMessages: ResponseInput;
    unprocessedCognitionMessages: ResponseInput;
    lastMemoryProcessTime: number;
    lastCognitionProcessTime: number;
    messagesSinceLastCognition: number;
}
```

### Timer Lifecycle
1. **Initialization**: Timers created when task starts
2. **Bumping**: Debounce timers reset on each message
3. **Cleanup**: All timers cleared when task completes

### Concurrent Processing Prevention
- Processing flags prevent multiple simultaneous runs
- Queue ensures no messages are lost
- Async operations tracked and awaited on completion

## Usage Examples

### Basic Configuration
```typescript
const task = runTask(agent, 'Your prompt', {
    memory: { enabled: true },
    cognition: { frequency: 10 }
});
```

### Handling Events
```typescript
for await (const event of task) {
    switch (event.type) {
        case 'metamemory_event':
            if (event.operation === 'tagging_complete') {
                // Update UI with current topics
                updateTopicDisplay(event.data.state.topicTags);
            }
            break;
            
        case 'metacognition_event':
            if (event.operation === 'analysis_complete') {
                // Show system insights
                showSystemStatus(event.data);
            }
            break;
    }
}
```

## Best Practices

1. **Enable for Long Tasks**: Always enable meta processing for tasks with long operations
2. **Monitor Events**: Use meta events to update UI state
3. **Handle Gracefully**: Meta events are supplementary - don't block on them
4. **Resource Awareness**: Timer-based processing uses additional compute

## Configuration

### Memory Timers
- Debounce: 1 second (not configurable)
- Batch threshold: 10 messages (not configurable)

### Cognition Timers
- Message threshold: 10 messages (configurable via `cognition.frequency`)
- Debounce: 1 second after reaching threshold (not configurable)
- Periodic: 3 minutes (not configurable)

## Migration Guide

No code changes required! The timer-based system is backwards compatible:
- Existing code continues to work
- New timer benefits apply automatically
- Event structure remains the same

## Technical Notes

- Timers use `setInterval` and `setTimeout` 
- Processing is async and non-blocking
- Events maintain chronological order
- Memory safety through proper cleanup
- Works with task resumption
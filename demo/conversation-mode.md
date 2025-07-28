# Demo Conversation Mode Fix

## Problem
The demo currently completes tasks in a single request, preventing metacognition from triggering.

## Solution
Modify the demo to use conversation mode:

1. Add a "conversation mode" toggle that uses `runIndefinitely: true`
2. Use `resumeTask` for follow-up messages instead of starting new tasks
3. Track request count across messages to show metacognition triggering

## Example Implementation:

```javascript
// In task-core.js
export function startConversation(initialPrompt, send, options = {}) {
  const taskLocalState = {
    cognition: {
      frequency: options.metaFrequency || 5
    },
    memory: {
      enabled: options.metamemoryEnabled !== false
    },
    runIndefinitely: true // Key: don't auto-complete
  };
  
  return runTask(agent, initialPrompt, taskLocalState);
}

// In the UI, continue conversation with:
export function continueConversation(finalState, newPrompt, send) {
  return resumeTask(agent, finalState, newPrompt);
}
```

## Benefits:
- Metacognition will trigger after 5 exchanges
- More realistic conversation flow
- Better demonstrates the framework's capabilities
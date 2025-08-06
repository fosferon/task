import { describe, it, expect } from 'vitest';
import { getTaskTools } from '../src/core/engine.js';

describe('Task Tools allowSummary Configuration', () => {
  it('should have allowSummary set to false for task_complete', () => {
    const tools = getTaskTools();
    
    const taskCompleteTool = tools.find(tool => 
      tool.definition?.function?.name === 'task_complete'
    );
    
    expect(taskCompleteTool).toBeDefined();
    expect(taskCompleteTool?.allowSummary).toBe(false);
  });

  it('should have allowSummary set to false for task_fatal_error', () => {
    const tools = getTaskTools();
    
    const taskFatalErrorTool = tools.find(tool => 
      tool.definition?.function?.name === 'task_fatal_error'
    );
    
    expect(taskFatalErrorTool).toBeDefined();
    expect(taskFatalErrorTool?.allowSummary).toBe(false);
  });
});
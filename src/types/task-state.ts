import type { ResponseInput } from '@just-every/ensemble';
import type { MetamemoryState } from '../metamemory/index.js';

export interface CognitionState {
    /** Whether cognition is enabled for this task */
    enabled?: boolean;

    /** Meta-cognition frequency for this task */
    frequency?: number;

    /** Thought delay for this task */
    thoughtDelay?: number;

    /** Models disabled for this task */
    disabledModels?: Set<string>;

    /** Model scores for this task */
    modelScores?: Record<string, number>;

    /** Whether cognition is currently processing */
    processing?: boolean;
    
    /** Timestamp when processing started (for detecting stuck states) */
    lastProcessingStartTime?: number;
}

// JSON-serializable version of CognitionState for events
export interface SerializedCognitionState {
    /** Whether cognition is enabled for this task */
    enabled?: boolean;

    /** Meta-cognition frequency for this task */
    frequency?: number;

    /** Thought delay for this task */
    thoughtDelay?: number;

    /** Models disabled for this task */
    disabledModels?: string[];

    /** Model scores for this task */
    modelScores?: Record<string, number>;

    /** Whether cognition is currently processing */
    processing?: boolean;
    
    /** Timestamp when processing started (for detecting stuck states) */
    lastProcessingStartTime?: number;
}

/**
 * Task-local state that is isolated per runTask invocation
 */
export interface TaskLocalState {
    /** Request counter for this task only */
    requestCount?: number;

    /** Abort controller for thought delays in this task */
    delayAbortController?: AbortController;

    /** For long running tasks which only end by being terminated */
    runIndefinitely?: boolean;

    /** Task message history */
    messages?: ResponseInput;

    cognition?: CognitionState;

    /** Metamemory for this task */
    memory?: {
        enabled?: boolean;

        /** Memory state for this task */
        state?: MetamemoryState;

        /** Whether memory is currently processing */
        processing?: boolean;
        
        /** Timestamp when processing started (for detecting stuck states) */
        lastProcessingStartTime?: number;
    }

    /** Error handling configuration */
    errorHandling?: {
        /** Maximum consecutive initialization errors before stopping (default: 3) */
        maxConsecutiveInitErrors?: number;
        
        /** Maximum total errors before stopping (default: 10) */
        maxTotalErrors?: number;
    }
}
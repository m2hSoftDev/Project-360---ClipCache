import { describe, it, expect } from 'vitest';
import { EditorHistory } from '@/sidepanel/lib/editorHistory';

describe('EditorHistory Undo/Redo Manager (CLAUDE.md Phase 4)', () => {
  it('initializes with empty stack and correct maxSteps (30)', () => {
    const history = new EditorHistory();
    expect(history.maxSteps).toBe(30);
    expect(history.count).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.current).toBeNull();
  });

  it('pushes states and tracks canUndo / canRedo correctly', () => {
    const history = new EditorHistory();

    history.push('state-1');
    expect(history.count).toBe(1);
    expect(history.canUndo).toBe(false); // Can't undo initial state
    expect(history.canRedo).toBe(false);
    expect(history.current).toBe('state-1');

    history.push('state-2');
    expect(history.count).toBe(2);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.current).toBe('state-2');

    history.push('state-3');
    expect(history.count).toBe(3);
    expect(history.canUndo).toBe(true);
    expect(history.current).toBe('state-3');
  });

  it('performs undo and redo operations', () => {
    const history = new EditorHistory();
    history.push('state-1');
    history.push('state-2');
    history.push('state-3');

    // Undo from 3 to 2
    expect(history.undo()).toBe('state-2');
    expect(history.current).toBe('state-2');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(true);

    // Undo from 2 to 1
    expect(history.undo()).toBe('state-1');
    expect(history.current).toBe('state-1');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    // Further undo returns null
    expect(history.undo()).toBeNull();

    // Redo back to 2
    expect(history.redo()).toBe('state-2');
    expect(history.current).toBe('state-2');
    expect(history.canUndo).toBe(true);

    // Redo back to 3
    expect(history.redo()).toBe('state-3');
    expect(history.current).toBe('state-3');
    expect(history.canRedo).toBe(false);
  });

  it('strictly respects the 30-step limit when more than 30 states are pushed', () => {
    const history = new EditorHistory(30);

    // Push 45 states
    for (let i = 1; i <= 45; i++) {
      history.push(`state-${i}`);
    }

    // Stack count must be clamped at exactly 30
    expect(history.count).toBe(30);
    expect(history.current).toBe('state-45');

    // Undo 29 times back to the oldest preserved state
    for (let i = 44; i >= 16; i--) {
      expect(history.canUndo).toBe(true);
      expect(history.undo()).toBe(`state-${i}`);
    }

    // Oldest state retained is state-16 (since 45 - 30 + 1 = 16)
    expect(history.current).toBe('state-16');
    expect(history.canUndo).toBe(false);
  });

  it('discards redo branch if new state is pushed after undo', () => {
    const history = new EditorHistory();
    history.push('state-1');
    history.push('state-2');
    history.push('state-3');

    history.undo(); // back to state-2
    expect(history.canRedo).toBe(true);

    history.push('state-new-branch');
    expect(history.current).toBe('state-new-branch');
    expect(history.canRedo).toBe(false); // Redo future was pruned
    expect(history.count).toBe(3); // [state-1, state-2, state-new-branch]
  });

  it('clears all history when clear is called', () => {
    const history = new EditorHistory();
    history.push('state-1');
    history.push('state-2');

    history.clear();
    expect(history.count).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.current).toBeNull();
  });

  it('undo after adding one object removes it, and undo after delete restores it', async () => {
    const { fabric } = await import('fabric');
    const el = document.createElement('canvas');
    const canvas = new fabric.Canvas(el, { width: 300, height: 200 });
    const history = new EditorHistory(30);

    // Initial blank canvas state
    history.push(JSON.stringify(canvas.toJSON()));
    expect(canvas.getObjects()).toHaveLength(0);

    // 1. Add one object
    const rect = new fabric.Rect({ left: 10, top: 10, width: 50, height: 50 });
    canvas.add(rect);
    history.push(JSON.stringify(canvas.toJSON()));
    expect(canvas.getObjects()).toHaveLength(1);

    // 2. Undo after adding one object removes it
    const undoState1 = history.undo()!;
    await new Promise<void>((resolve) => canvas.loadFromJSON(undoState1, () => resolve()));
    expect(canvas.getObjects()).toHaveLength(0);

    // Redo restores the added object
    const redoState1 = history.redo()!;
    await new Promise<void>((resolve) => canvas.loadFromJSON(redoState1, () => resolve()));
    expect(canvas.getObjects()).toHaveLength(1);

    // 3. Delete the object
    const objToDelete = canvas.getObjects()[0];
    canvas.remove(objToDelete);
    history.push(JSON.stringify(canvas.toJSON()));
    expect(canvas.getObjects()).toHaveLength(0);

    // 4. Undo after delete restores it
    const undoState2 = history.undo()!;
    await new Promise<void>((resolve) => canvas.loadFromJSON(undoState2, () => resolve()));
    expect(canvas.getObjects()).toHaveLength(1);

    canvas.dispose();
  });
});


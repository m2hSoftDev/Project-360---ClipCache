/**
 * In-memory history stack for undo and redo operations in the image editor.
 * Enforces a strict 30-step maximum capacity per CLAUDE.md Phase 4 requirements.
 */

export class EditorHistory {
  private stack: string[] = [];
  private index = -1;
  public readonly maxSteps: number;

  constructor(maxSteps = 30) {
    this.maxSteps = maxSteps;
  }

  /**
   * Pushes a new state (e.g. serialized Fabric JSON) onto the history stack.
   * Discards any future redo steps and clamps the stack length to maxSteps.
   */
  public push(state: string): void {
    // If pushing after an undo, discard subsequent redo history
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    this.stack.push(state);

    if (this.stack.length > this.maxSteps) {
      // Remove the oldest state to respect the 30-step capacity
      this.stack.shift();
      // Since we shifted the bottom element, index points to the new top
      this.index = this.stack.length - 1;
    } else {
      this.index = this.stack.length - 1;
    }
  }

  /**
   * Reverts to the previous state if available.
   */
  public undo(): string | null {
    if (!this.canUndo) return null;
    this.index--;
    return this.stack[this.index];
  }

  /**
   * Advances to the next state if available.
   */
  public redo(): string | null {
    if (!this.canRedo) return null;
    this.index++;
    return this.stack[this.index];
  }

  /**
   * Returns whether an undo operation can be performed.
   */
  public get canUndo(): boolean {
    return this.index > 0;
  }

  /**
   * Returns whether a redo operation can be performed.
   */
  public get canRedo(): boolean {
    return this.index >= 0 && this.index < this.stack.length - 1;
  }

  /**
   * Returns the current state string.
   */
  public get current(): string | null {
    if (this.index >= 0 && this.index < this.stack.length) {
      return this.stack[this.index];
    }
    return null;
  }

  /**
   * Returns the current number of steps in the stack.
   */
  public get count(): number {
    return this.stack.length;
  }

  /**
   * Returns the current index in the stack (0-indexed).
   */
  public get currentIndex(): number {
    return this.index;
  }

  /**
   * Clears the entire history stack.
   */
  public clear(): void {
    this.stack = [];
    this.index = -1;
  }
}

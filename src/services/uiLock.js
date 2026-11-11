/**
 * TV_Abdul: uiLock
 * A fullscreen overlay (image viewer, in-view dialog) takes the remote for itself by holding
 * a lock; the home-screen key handler stands down while any lock is held.
 */

let depth = 0;

export const uiLock = {
  acquire() {
    depth += 1;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        depth = Math.max(0, depth - 1);
      }
    };
  },
  isLocked() {
    return depth > 0;
  }
};

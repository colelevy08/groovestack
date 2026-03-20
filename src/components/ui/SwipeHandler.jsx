// Swipe gesture handler for mobile tab navigation.
// Improvements: multi-direction support, velocity-based actions, configurable thresholds.
import { useRef, useCallback } from 'react';

export default function SwipeHandler({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onVelocitySwipe,
  minSwipeDistance = 50,
  velocityThreshold = 0.8,
  children,
  className,
}) {
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const touchEndX = useRef(null);
  const touchEndY = useRef(null);
  const touchStartTime = useRef(null);

  const onTouchStart = useCallback((e) => {
    const touch = e.targetTouches[0];
    touchEndX.current = null;
    touchEndY.current = null;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
  }, []);

  const onTouchMove = useCallback((e) => {
    const touch = e.targetTouches[0];
    touchEndX.current = touch.clientX;
    touchEndY.current = touch.clientY;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      touchEndX.current === null ||
      touchEndY.current === null
    ) {
      return;
    }

    const distX = touchStartX.current - touchEndX.current;
    const distY = touchStartY.current - touchEndY.current;
    const absDistX = Math.abs(distX);
    const absDistY = Math.abs(distY);
    const elapsed = (Date.now() - (touchStartTime.current || Date.now())) / 1000;
    const totalDist = Math.sqrt(distX * distX + distY * distY);
    const velocity = elapsed > 0 ? totalDist / elapsed : 0;

    // Determine primary direction
    const isHorizontal = absDistX > absDistY;

    // Velocity-based fast swipe callback
    if (velocity > velocityThreshold * 1000 && onVelocitySwipe) {
      let direction = 'left';
      if (isHorizontal) {
        direction = distX > 0 ? 'left' : 'right';
      } else {
        direction = distY > 0 ? 'up' : 'down';
      }
      onVelocitySwipe({ direction, velocity, distance: totalDist });
    }

    // Standard swipe detection
    if (isHorizontal && absDistX > minSwipeDistance) {
      if (distX > 0 && onSwipeLeft) onSwipeLeft();
      if (distX < 0 && onSwipeRight) onSwipeRight();
    } else if (!isHorizontal && absDistY > minSwipeDistance) {
      if (distY > 0 && onSwipeUp) onSwipeUp();
      if (distY < 0 && onSwipeDown) onSwipeDown();
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchEndY.current = null;
    touchStartTime.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onVelocitySwipe, minSwipeDistance, velocityThreshold]);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={className}
    >
      {children}
    </div>
  );
}

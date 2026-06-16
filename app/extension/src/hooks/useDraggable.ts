import { useState, useEffect, useRef } from "react";

export function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;

      startPos.current = { x: e.clientX, y: e.clientY };

      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    const target = e.target as HTMLElement;
    // Don't drag if clicking a button or interactable elements
    if (target.closest("button") || target.closest(".no-drag")) return;

    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  return { offset, handleMouseDown, isDragging };
}

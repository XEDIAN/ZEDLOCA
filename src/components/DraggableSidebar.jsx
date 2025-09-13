import React, { useState, useRef, useEffect } from 'react';
import UserProfile from './UserProfile';

function DraggableSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleDragStart = (e) => {
    setIsDragging(true);
    startXRef.current = e.clientX || e.touches?.[0].clientX || 0;
    startWidthRef.current = sidebarRef.current?.offsetWidth || 0;
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none';
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    
    const clientX = e.clientX || e.touches?.[0].clientX || 0;
    const diff = startXRef.current - clientX;
    const newWidth = Math.max(250, Math.min(500, startWidthRef.current + diff));
    
    if (sidebarRef.current) {
      sidebarRef.current.style.width = `${newWidth}px`;
    }
    
    // Update open state based on width
    setIsOpen(newWidth > 250);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    
    // Reset styles
    document.body.style.userSelect = '';
    document.body.style.pointerEvents = '';
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('touchmove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div 
      ref={sidebarRef}
      className={`fixed top-0 right-0 h-full bg-white shadow-lg z-40 transition-all duration-300 ease-in-out ${
        isOpen ? 'w-80' : 'w-16'
      }`}
    >
      {/* Drag handle */}
      <div
  className="absolute top-0 left-0 h-full w-2 cursor-col-resize bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="w-1 h-12 bg-white rounded"></div>
      </div>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
  className="absolute top-4 -left-8 w-8 h-12 bg-gray-700 text-white flex items-center justify-center shadow-lg rounded-l-lg z-50"
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isOpen ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* Sidebar content */}
      <div className={`h-full overflow-y-auto transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
        <div className="p-4 pt-16">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Profile</h2>
          <UserProfile />
        </div>
      </div>
    </div>
  );
}

export default DraggableSidebar;
import { useEffect } from 'react';

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handleKeyPress = (event) => {
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;
      
      shortcuts.forEach(shortcut => {
        const matches = 
          shortcut.key === key &&
          (shortcut.ctrl === undefined || shortcut.ctrl === ctrl) &&
          (shortcut.shift === undefined || shortcut.shift === shift) &&
          (shortcut.alt === undefined || shortcut.alt === alt);
        
        if (matches) {
          event.preventDefault();
          shortcut.handler();
        }
      });
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [shortcuts]);
}
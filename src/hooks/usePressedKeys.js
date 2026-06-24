import React from 'react';

export function usePressedKeys() {
  const keys = React.useRef(new Set());

  React.useEffect(() => {
    const down = (event) => {
      keys.current.add(event.key.toLowerCase());
    };
    const up = (event) => {
      keys.current.delete(event.key.toLowerCase());
    };
    const clear = () => {
      keys.current.clear();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  return keys;
}

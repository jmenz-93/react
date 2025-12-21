import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface RabbitProps {
  imageUrl: string;
  altText: string;
}

const RabbitLogo: React.FC<RabbitProps> = ({ imageUrl, altText }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      globalThis.addEventListener('keydown', handleEsc);
    }
    return () => globalThis.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  return (
    <>
      <button 
        type="button"
        className="flex justify-center items-center cursor-pointer transition-transform hover:scale-105 border-none bg-transparent p-0"
        onClick={() => setIsOpen(true)}
      >
        <img
          className="inline-block rounded-2xl shadow-2xl"
          src={imageUrl}
          alt={altText}
          width={180}
          height={180}
          style={{ objectFit: 'cover', objectPosition: 'center top' }}
        />
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop Button */}
          <button
            type="button"
            className="absolute inset-0 w-full h-full bg-black/80 backdrop-blur-sm border-none cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close modal"
            tabIndex={-1}
          />
          
          {/* Modal Content */}
          <div 
            className="relative max-w-4xl w-full flex justify-center pointer-events-none"
            aria-modal="true"
          >
            <div className="relative pointer-events-auto">
              <img
                src={imageUrl}
                alt={altText}
                className="max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
              <button 
                type="button"
                className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors border-none cursor-pointer"
                onClick={() => setIsOpen(false)}
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default RabbitLogo;
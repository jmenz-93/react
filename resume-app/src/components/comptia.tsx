import React from 'react';

interface ComptiaProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
}

const ComptiaImage: React.FC<ComptiaProps> = ({ imageUrl, linkUrl, altText }) => {
  return (
    <div>
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          src={imageUrl}
          alt={altText}
          loading="lazy"
          className="transition-transform hover:scale-110 w-26 inline-block"
        />
      </a>
    </div>
  );
};

export default ComptiaImage;

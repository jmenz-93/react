interface AWSAIProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
}

const AWSAIImage: React.FC<AWSAIProps> = ({ imageUrl, linkUrl, altText }) => {

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
          className="transition-transform hover:scale-110 w-24 inline-block"
          style={{ display: 'block' }}
        />
      </a>
    </div>
  );
};

export default AWSAIImage;
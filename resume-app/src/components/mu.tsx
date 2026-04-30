

interface MUProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
}

const MUImage: React.FC<MUProps> = ({ imageUrl, linkUrl, altText }) => {

  return (
    <div>
      <a
        href={linkUrl}
        rel="noopener noreferrer"
      >
        <img
          src={imageUrl}
          alt={altText}
          loading="lazy"
          className="transition-transform hover:scale-110 items-center w-18"
          style={{ display: 'block'}}
        />
      </a>
    </div>
  );
};

export default MUImage;



interface MUProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
  toolTip: string;
}

const MUImage: React.FC<MUProps> = ({ imageUrl, linkUrl, altText, toolTip }) => {

  return (
    <div>
      <a
        href={linkUrl}
        rel="noopener noreferrer"
        title={toolTip}
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

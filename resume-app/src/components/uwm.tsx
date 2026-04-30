interface UWMProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
}

const UWMImage: React.FC<UWMProps> = ({ imageUrl, linkUrl, altText }) => {

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
          className="w-18 h-auto transition-transform hover:scale-110 items-center"
          style={{ display: 'block'}}
        />
      </a>
    </div>
  );
};

export default UWMImage;

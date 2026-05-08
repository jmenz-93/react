interface NMProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;

}

const NMLogo: React.FC<NMProps> = ({ imageUrl, linkUrl, altText}) => {

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
          className="w-12 h-auto hover:scale-110 items-center transition-transform"
          style={{ display: 'block'}}
        />
    </a>
    </div>
  );
};

export default NMLogo;

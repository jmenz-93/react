interface GitProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
  toolTip: string;
}

const GitImage: React.FC<GitProps> = ({ imageUrl, linkUrl, altText, toolTip }) => {
  return (
    <div>
      <a
        href={linkUrl}
        rel="noopener noreferrer"
        className="transition-transform hover:scale-120 w-12 inline-block"
        title={toolTip}
      >
        <img
          src={imageUrl}
          alt={altText}
          loading="lazy"
          style={{ display: 'block' }}
        />
      </a>
    </div>
  );
};

export default GitImage;
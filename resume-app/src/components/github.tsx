interface GitProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
}

const GitImage: React.FC<GitProps> = ({ imageUrl, linkUrl, altText }) => {
  return (
    <div>
      <a
        href={linkUrl}
        rel="noopener noreferrer"
        className="transition-transform hover:scale-120 w-12 inline-block"
      >
        <img
          src={imageUrl}
          alt={altText}
          loading="lazy"
          style={{ display: 'block' }}
          className="dark:invert"
        />
      </a>
    </div>
  );
};

export default GitImage;
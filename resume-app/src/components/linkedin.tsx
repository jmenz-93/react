interface LinkedInProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
  toolTip: string;
}

const LinkedInImage: React.FC<LinkedInProps> = ({ imageUrl, linkUrl, altText, toolTip }) => {
  return (
    <div>
      <a
        href={linkUrl}
        rel="noopener noreferrer"
        className="transition-transform hover:scale-110 items-center w-14 inline-block"
        title={toolTip}
      >
        <img
          src={imageUrl}
          alt={altText}
          loading="lazy"
          style={{ display: 'block' }}
          className="dark:brightness-0 dark:invert"
        />
      </a>
    </div>
  );
};

export default LinkedInImage;
